import Capacitacao from "../../domain/Entity/Capacitacao";
import CapacitacaoFeedback from "../../domain/Entity/CapacitacaoFeedback";
import { DonoAnexo } from "../../domain/Enum/Anexo";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import { ResumoAvaliacao } from "../../domain/Interfaces/CapacitacaoFeedbackRepositoryInterface";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../shared/erros/ErroProibido";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { exigirAutenticado, UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { acessoAosFeedbacks, ehInstrutor, podeGerirCapacitacoes } from "../../shared/seguranca/regrasCapacitacao";
import GerirAnexos from "../GerirAnexos/GerirAnexos";

const M = MENSAGENS_DE_ERRO.CAPACITACAO;

export interface EntradaCapacitacao {
    titulo?: string;
    descricao?: string;
    data?: Date;
    hora?: string;
    duracaoHoras?: number;
    codigoInstrutor?: string;
    vagas?: number;
    tipo?: string;
    sala?: string;
}

export interface EntradaFeedback {
    nota: number;
    bom?: string | null;
    melhorar?: string | null;
}

type Usuario = UsuarioAutenticado | null | undefined;

/** Capacitações, inscrições, presença e avaliações (sessão 13). Regras em shared/seguranca/regrasCapacitacao.ts. */
export default class GerirCapacitacoes {
    constructor(private readonly factory: RepositoryFactoryInterface, private readonly agora: () => Date = () => new Date()) {}

    private get repo() { return this.factory.criarCapacitacaoRepository(); }
    private get feedbacks() { return this.factory.criarCapacitacaoFeedbackRepository(); }

    private async buscar(codigo: string): Promise<Capacitacao> {
        const c = await this.repo.buscarPorCodigo(codigo);
        if (!c) throw new ErroNaoEncontrado(M.NAO_ENCONTRADA);
        return c;
    }

    private exigirGestao(usuario: Usuario): UsuarioAutenticado {
        const autenticado = exigirAutenticado(usuario);
        if (!podeGerirCapacitacoes(autenticado)) throw new ErroProibido(M.SEM_PERMISSAO);
        return autenticado;
    }

    /** Resposta da API para quem pediu: inscritos só para a gestão e para quem ministra. */
    private resposta(usuario: UsuarioAutenticado, c: Capacitacao, resumo: ResumoAvaliacao | undefined, anexos: unknown[]) {
        const gestao = podeGerirCapacitacoes(usuario);
        const instrutor = ehInstrutor(usuario, c);
        const minha = c.inscricaoDe(usuario.codigo);
        const comecou = c.jaComecou(this.agora());
        return {
            codigo: c.codigo,
            titulo: c.titulo,
            descricao: c.descricao,
            data: c.data.toISOString().slice(0, 10),
            hora: c.hora,
            inicio: c.inicio,
            duracaoHoras: c.duracaoHoras,
            instrutor: c.instrutor,
            vagas: c.vagas,
            tipo: c.tipo,
            sala: c.sala,
            totalInscritos: c.inscricoes.length,
            vagasRestantes: c.vagasRestantes,
            situacao: comecou ? "realizada" : c.vagasRestantes === 0 ? "lotada" : "aberta",
            inscrito: Boolean(minha),
            presente: minha?.presente ?? null,
            inscritos: gestao || instrutor ? c.inscricoes.map((i) => ({ ...i.usuario, presente: i.presente })) : undefined,
            avaliacao: resumo ?? { media: null, total: 0 },
            podeGerir: gestao,
            podeInscrever: !minha && !comecou && c.vagasRestantes > 0,
            podeCancelar: Boolean(minha) && !comecou,
            podeAvaliar: comecou && minha?.presente === true,
            podeVerAvaliacoes: acessoAosFeedbacks(usuario, c) !== null,
            anexos,
        };
    }

    private async respostas(usuario: UsuarioAutenticado, itens: Capacitacao[]) {
        const codigos = itens.map((c) => c.codigo);
        const resumos = await this.feedbacks.resumos(codigos);
        const anexos = await new GerirAnexos(this.factory).porDono(DonoAnexo.CAPACITACAO, codigos);
        return itens.map((c) => this.resposta(usuario, c, resumos.get(c.codigo), anexos.get(c.codigo) ?? []));
    }

    async listar(usuario: Usuario) {
        return this.respostas(exigirAutenticado(usuario), await this.repo.listar());
    }

    /** Ficha: a lista + a avaliação da própria pessoa. */
    async ficha(usuario: Usuario, codigo: string) {
        const autenticado = exigirAutenticado(usuario);
        const [item] = await this.respostas(autenticado, [await this.buscar(codigo)]);
        const meu = await this.feedbacks.buscarPorCapacitacaoEUsuario(codigo, autenticado.codigo);
        return { ...item, minhaAvaliacao: meu ? { nota: meu.nota, bom: meu.bom, melhorar: meu.melhorar, data: meu.data } : null };
    }

    async salvar(usuario: Usuario, entrada: EntradaCapacitacao, codigo?: string) {
        const autenticado = this.exigirGestao(usuario);
        const atual = codigo ? await this.buscar(codigo) : null;
        let instrutor = atual?.instrutor;
        if (entrada.codigoInstrutor !== undefined || !atual) {
            if (!entrada.codigoInstrutor) throw new ErroValidacao(M.INSTRUTOR_OBRIGATORIO, "INSTRUTOR_OBRIGATORIO");
            const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(String(entrada.codigoInstrutor));
            if (!pessoa || !pessoa.ativo) throw new ErroNaoEncontrado(M.INSTRUTOR_INVALIDO);
            instrutor = { codigo: pessoa.codigo, nome: pessoa.nomeExibicao || pessoa.nome };
        }
        const definidos = Object.fromEntries(Object.entries(entrada).filter(([k, v]) => v !== undefined && k !== "codigoInstrutor"));
        const nova = atual
            ? atual.com({ ...definidos, instrutor })
            : new Capacitacao({ ...(definidos as any), instrutor: instrutor! });
        const salva = atual ? await this.repo.editar(nova) : await this.repo.criar(nova);
        return this.ficha(autenticado, salva.codigo);
    }

    async excluir(usuario: Usuario, codigo: string) {
        this.exigirGestao(usuario);
        await this.buscar(codigo);
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.CAPACITACAO, [codigo]);
        await this.repo.excluir(codigo);
        return { codigo };
    }

    /**
     * A própria pessoa se inscreve até a hora de início. A gestão inscreve qualquer pessoa ativa,
     * mesmo depois do início (quem apareceu sem inscrição, ou capacitação registrada depois).
     */
    async inscrever(usuario: Usuario, codigo: string, codigoPessoa?: string) {
        const autenticado = exigirAutenticado(usuario);
        const alvo = codigoPessoa && codigoPessoa !== autenticado.codigo ? (this.exigirGestao(autenticado), codigoPessoa) : autenticado.codigo;
        const c = await this.buscar(codigo);
        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(alvo);
        if (!pessoa) throw new ErroNaoEncontrado("Pessoa não encontrada.");
        if (!pessoa.ativo) throw new ErroValidacao(M.PESSOA_INATIVA, "PESSOA_INATIVA");
        if (!podeGerirCapacitacoes(autenticado) && c.jaComecou(this.agora())) throw new ErroConflito(M.JA_COMECOU, "CAPACITACAO_JA_COMECOU");
        if (c.inscricaoDe(alvo)) throw new ErroConflito(M.JA_INSCRITO, "USUARIO_JA_INSCRITO");
        const ok = await this.repo.inscrever(codigo, { codigo: pessoa.codigo, nome: pessoa.nomeExibicao || pessoa.nome });
        if (!ok) throw new ErroConflito(M.LOTADA, "CAPACITACAO_LOTADA");
        return this.ficha(autenticado, codigo);
    }

    /** A própria pessoa cancela até o início; a gestão tira qualquer inscrito a qualquer momento. */
    async cancelar(usuario: Usuario, codigo: string, codigoPessoa: string) {
        const autenticado = exigirAutenticado(usuario);
        const gestao = podeGerirCapacitacoes(autenticado);
        if (codigoPessoa !== autenticado.codigo && !gestao) throw new ErroProibido(M.SEM_PERMISSAO);
        const c = await this.buscar(codigo);
        if (!c.inscricaoDe(codigoPessoa)) throw new ErroValidacao(M.NAO_INSCRITO, "USUARIO_NAO_INSCRITO");
        if (!gestao && c.jaComecou(this.agora())) throw new ErroConflito(M.JA_COMECOU, "CAPACITACAO_JA_COMECOU");
        await this.repo.cancelarInscricao(codigo, codigoPessoa);
        return this.ficha(autenticado, codigo);
    }

    /** A gestão marca quem compareceu (os demais inscritos ficam como ausentes). */
    async marcarPresencas(usuario: Usuario, codigo: string, presentes: unknown) {
        const autenticado = this.exigirGestao(usuario);
        const c = await this.buscar(codigo);
        if (!Array.isArray(presentes) || presentes.some((p) => typeof p !== "string")) {
            throw new ErroValidacao("Envie `presentes` como uma lista de códigos de pessoas.", "PRESENTES_INVALIDOS");
        }
        if (!c.jaComecou(this.agora())) throw new ErroConflito(M.PRESENCA_ANTES, "PRESENCA_ANTES_DO_INICIO");
        if (presentes.some((p) => !c.inscricaoDe(p))) throw new ErroValidacao(M.PRESENCA_FORA_DOS_INSCRITOS, "PRESENCA_FORA_DOS_INSCRITOS");
        await this.repo.marcarPresencas(codigo, presentes as string[]);
        return this.ficha(autenticado, codigo);
    }

    /** Só quem compareceu avalia, depois do início; avaliar de novo substitui a anterior. */
    async avaliar(usuario: Usuario, codigo: string, entrada: EntradaFeedback) {
        const autenticado = exigirAutenticado(usuario);
        const c = await this.buscar(codigo);
        if (!c.jaComecou(this.agora())) throw new ErroConflito(M.AVALIAR_ANTES, "FEEDBACK_CAPACITACAO_NAO_REALIZADA");
        const inscricao = c.inscricaoDe(autenticado.codigo);
        if (inscricao?.presente !== true) throw new ErroProibido(M.AVALIAR_SEM_PRESENCA);
        await this.feedbacks.salvar(new CapacitacaoFeedback({
            codigoCapacitacao: codigo, usuario: inscricao.usuario, nota: entrada.nota, bom: entrada.bom, melhorar: entrada.melhorar,
        }));
        return this.ficha(autenticado, codigo);
    }

    /** Avaliações individuais: com nome para a gestão, sem nome para quem ministrou. */
    async avaliacoes(usuario: Usuario, codigo: string) {
        const autenticado = exigirAutenticado(usuario);
        const c = await this.buscar(codigo);
        const acesso = acessoAosFeedbacks(autenticado, c);
        if (!acesso) throw new ErroProibido(M.FEEDBACKS_SEM_PERMISSAO);
        const lista = await this.feedbacks.listarPorCapacitacao(codigo);
        // Sem nome: ordem pela nota, para a ordem não denunciar quem respondeu primeiro.
        if (acesso === "sem-nome") lista.sort((a, b) => b.nota - a.nota);
        return lista.map((f) => ({
            ...(acesso === "com-nome" ? { usuario: f.usuario, data: f.data } : {}),
            nota: f.nota, bom: f.bom, melhorar: f.melhorar,
        }));
    }
}
