import Reuniao, { ParticipanteReuniao } from "../../domain/entity/Reuniao";
import Usuario from "../../domain/entity/Usuario";
import StatusTarefa from "../../domain/enum/StatusTarefa";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { hoje as hojeEmSaoPaulo } from "../../shared/datas";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../shared/erros/ErroProibido";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { acessoAoProjeto } from "../../shared/seguranca/visibilidadeProjetos";
import { Permissao, temPermissao, UsuarioAutenticado } from "../../shared/seguranca/permissoes";

const M = MENSAGENS_DE_ERRO.REUNIAO;
const A = MENSAGENS_DE_ERRO.AGENDA;
const DIA = 86_400_000;
export const MAXIMO_DIAS_AGENDA = 62;

export interface EntradaReuniao {
    titulo?: string;
    descricao?: string;
    data?: Date;
    hora?: string;
    duracaoMinutos?: number;
    local?: string;
    participantes?: unknown;
}

const dia = (d: Date) => d.toISOString().slice(0, 10);
const nomeDe = (u: Usuario) => u.nomeExibicao || u.nome;

/**
 * Agenda unificada e reuniões (sessão 28b). A agenda junta, num período, as reuniões e os prazos
 * das tarefas da pessoa e todas as capacitações. Cada um vê a própria; quem tem agenda.gerirTodas
 * pode ver a de outra pessoa. Prazo de tarefa de projeto sem acesso completo aparece sem título.
 */
export default class GerirAgenda {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async agenda(usuario: UsuarioAutenticado, de: Date, ate: Date, codigoPessoa?: string) {
        if (ate.getTime() < de.getTime() || (ate.getTime() - de.getTime()) / DIA > MAXIMO_DIAS_AGENDA) {
            throw new ErroValidacao(A.PERIODO_INVALIDO, "AGENDA_PERIODO_INVALIDO");
        }
        const gestao = temPermissao(usuario, Permissao.AGENDA_GERIR_TODAS);
        const alvoCodigo = codigoPessoa || usuario.codigo;
        if (alvoCodigo !== usuario.codigo && !gestao) throw new ErroProibido(A.OUTRA_PESSOA);
        const alvo = await this.factory.criarUsuarioRepository().buscarPorCodigo(alvoCodigo);
        if (!alvo) throw new ErroNaoEncontrado(A.PESSOA_NAO_ENCONTRADA);

        const [reunioes, tarefas, projetos, capacitacoes] = await Promise.all([
            this.factory.criarReuniaoRepository().listarDaPessoa(alvo.codigo, de, ate),
            this.factory.criarTarefaRepository().listarPorResponsavel(alvo.codigo),
            this.factory.criarProjetoRepository().listar(),
            this.factory.criarCapacitacaoRepository().listar(),
        ]);
        const porProjeto = new Map(projetos.map((p) => [p.codigo, p]));
        const hoje = hojeEmSaoPaulo();
        const noPeriodo = (d: Date) => d.getTime() >= de.getTime() && d.getTime() <= ate.getTime();

        const itens = [
            ...reunioes.map((r) => ({
                tipo: "reuniao" as const,
                codigo: r.codigo,
                titulo: r.titulo,
                data: dia(r.data),
                hora: r.hora,
                duracaoMinutos: r.duracaoMinutos,
                local: r.local,
            })),
            ...tarefas
                .filter((t) => noPeriodo(t.dataFim))
                .flatMap((t) => {
                    const projeto = porProjeto.get(t.projeto.codigo);
                    if (!projeto) return [];
                    const completo = acessoAoProjeto(usuario, projeto) === "completo";
                    const concluida = t.status === StatusTarefa.CONCLUIDA;
                    return [
                        {
                            tipo: "prazo" as const,
                            codigo: completo ? t.codigo : null,
                            titulo: completo ? t.titulo : null,
                            data: dia(t.dataFim),
                            projeto: { codigo: projeto.codigo, nome: projeto.nome },
                            concluida,
                            atrasada: !concluida && t.dataFim.getTime() < hoje.getTime(),
                        },
                    ];
                }),
            ...capacitacoes
                .filter((c) => noPeriodo(c.data))
                .map((c) => ({
                    tipo: "capacitacao" as const,
                    codigo: c.codigo,
                    titulo: c.titulo,
                    data: dia(c.data),
                    hora: c.hora,
                    duracaoHoras: c.duracaoHoras,
                    sala: c.sala,
                    inscrito: Boolean(c.inscricaoDe(alvo.codigo)),
                    ministra: c.instrutor.codigo === alvo.codigo,
                })),
        ].sort((a, b) => a.data.localeCompare(b.data) || ("hora" in a ? a.hora : "").localeCompare("hora" in b ? b.hora : ""));

        return { pessoa: { codigo: alvo.codigo, nome: nomeDe(alvo) }, de: dia(de), ate: dia(ate), itens };
    }

    async ficha(usuario: UsuarioAutenticado, codigo: string) {
        return this.resposta(usuario, await this.buscarVisivel(usuario, codigo));
    }

    async criar(usuario: UsuarioAutenticado, entrada: EntradaReuniao) {
        const criador = await this.factory.criarUsuarioRepository().buscarPorCodigo(usuario.codigo);
        if (!criador) throw new ErroNaoEncontrado(A.PESSOA_NAO_ENCONTRADA);
        const participantes = await this.lerParticipantes(entrada.participantes ?? [], []);
        // Quem cria sempre participa.
        if (!participantes.some((p) => p.codigo === criador.codigo)) {
            participantes.unshift({ codigo: criador.codigo, nome: nomeDe(criador), foto: criador.foto, email: criador.email });
        }
        const nova = new Reuniao({
            ...(this.definidos(entrada) as any),
            criadoPor: { codigo: criador.codigo, nome: nomeDe(criador) },
            participantes,
        });
        return this.resposta(usuario, await this.factory.criarReuniaoRepository().criar(nova));
    }

    async editar(usuario: UsuarioAutenticado, codigo: string, entrada: EntradaReuniao) {
        const atual = await this.buscarAlteravel(usuario, codigo);
        const alteracoes: Record<string, unknown> = this.definidos(entrada);
        if (entrada.participantes !== undefined) {
            const participantes = await this.lerParticipantes(entrada.participantes, atual.participantes);
            // Quem criou não sai da própria reunião.
            if (!participantes.some((p) => p.codigo === atual.criadoPor.codigo)) {
                const ja = atual.participantes.find((p) => p.codigo === atual.criadoPor.codigo);
                if (ja) participantes.unshift(ja);
            }
            alteracoes.participantes = participantes;
        }
        const nova = atual.com(alteracoes as any);
        return this.resposta(usuario, await this.factory.criarReuniaoRepository().editar(nova));
    }

    async excluir(usuario: UsuarioAutenticado, codigo: string) {
        await this.buscarAlteravel(usuario, codigo);
        await this.factory.criarReuniaoRepository().excluir(codigo);
    }

    private definidos(entrada: EntradaReuniao): Record<string, unknown> {
        return Object.fromEntries(Object.entries(entrada).filter(([k, v]) => v !== undefined && k !== "participantes"));
    }

    private podeAlterar(usuario: UsuarioAutenticado, r: Reuniao): boolean {
        return r.criadoPor.codigo === usuario.codigo || temPermissao(usuario, Permissao.AGENDA_GERIR_TODAS);
    }

    /** Quem não participa e não é da gestão recebe 404, como se a reunião não existisse. */
    private async buscarVisivel(usuario: UsuarioAutenticado, codigo: string): Promise<Reuniao> {
        const r = await this.factory.criarReuniaoRepository().buscarPorCodigo(codigo);
        if (!r || !(r.participa(usuario.codigo) || temPermissao(usuario, Permissao.AGENDA_GERIR_TODAS)))
            throw new ErroNaoEncontrado(M.NAO_ENCONTRADA);
        return r;
    }

    private async buscarAlteravel(usuario: UsuarioAutenticado, codigo: string): Promise<Reuniao> {
        const r = await this.buscarVisivel(usuario, codigo);
        if (!this.podeAlterar(usuario, r)) throw new ErroProibido(M.SEM_PERMISSAO);
        return r;
    }

    /**
     * Lista de códigos, sem repetir. Só quem é novo na lista precisa estar ativo na EJ: quem já
     * participava e saiu da EJ pode continuar (a regra só vale para o que muda).
     */
    private async lerParticipantes(valor: unknown, atuais: ParticipanteReuniao[]): Promise<ParticipanteReuniao[]> {
        if (!Array.isArray(valor) || valor.some((c) => typeof c !== "string")) {
            throw new ErroValidacao(M.PARTICIPANTES_INVALIDOS, "PARTICIPANTES_INVALIDOS");
        }
        const codigos = [...new Set(valor as string[])];
        const usuarios = this.factory.criarUsuarioRepository();
        const lista: ParticipanteReuniao[] = [];
        for (const codigo of codigos) {
            const ja = atuais.find((p) => p.codigo === codigo);
            if (ja) {
                lista.push(ja);
                continue;
            }
            const u = await usuarios.buscarPorCodigo(codigo);
            if (!u || !u.naEj) throw new ErroValidacao(M.PARTICIPANTE_INVALIDO, "PARTICIPANTE_INVALIDO");
            lista.push({ codigo: u.codigo, nome: nomeDe(u), foto: u.foto, email: u.email });
        }
        return lista;
    }

    private resposta(usuario: UsuarioAutenticado, r: Reuniao) {
        return {
            codigo: r.codigo,
            titulo: r.titulo,
            descricao: r.descricao,
            data: dia(r.data),
            hora: r.hora,
            inicio: r.inicio,
            duracaoMinutos: r.duracaoMinutos,
            local: r.local,
            criadoPor: r.criadoPor,
            participantes: r.participantes,
            podeAlterar: this.podeAlterar(usuario, r),
        };
    }
}
