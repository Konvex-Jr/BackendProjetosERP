import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/entity/Projeto";
import Usuario from "../../domain/entity/Usuario";
import { calcularAlocacao, ResumoAlocacao } from "../../domain/service/alocacao";
import PeriodoArea from "../../domain/entity/PeriodoArea";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { acessoAoProjeto, podeVerTodosProjetos } from "../../shared/seguranca/visibilidadeProjetos";
import { comAreasAtuais } from "./areasAtuais";

export interface ProjetoNoPerfil {
    codigo: string;
    nome: string;
    referencia: string | null;
    status: string;
    funcao: string | null;
    alocacao: number;
    dataEntrada: Date;
    dataSaida: Date | null;
    sigiloso: boolean;
    tipo: Projeto["tipo"];
    geralDaArea: boolean;
    /** Sem acesso completo ao projeto: nome e datas aparecem, referência e função saem nulas. */
    restrito: boolean;
}

export interface CapacitacaoNoPerfil {
    codigo: string;
    titulo: string;
    data: Date;
    hora: string;
    duracaoHoras: number;
    papel: "instrutor" | "participante";
    /** Participante: presença marcada pela gestão (nulo = ainda não marcada). */
    presente: boolean | null;
}

export interface PerfilPessoa {
    usuario: Usuario;
    projetosAtuais: ProjetoNoPerfil[];
    projetosAnteriores: ProjetoNoPerfil[];
    /** Trajetória nas áreas: todos os períodos, abertos primeiro (sessão 23a). */
    periodos: PeriodoArea[];
    capacitacoes: { proximas: CapacitacaoNoPerfil[]; realizadas: CapacitacaoNoPerfil[]; horasCumpridas: number };
    alocacao: ResumoAlocacao;
}

/**
 * RF-013: perfil com projetos atuais e anteriores, períodos nas áreas e capacitações.
 * Projetos seguem a visibilidade (decisão de 30/10/2026): o membro que olha o perfil de outra
 * pessoa só vê os projetos de que ele mesmo participa ou participou.
 * Projeto sigiloso: quem não tem acesso completo vê só o nome e as datas (item `restrito`), se a
 * gestão ou a própria pessoa olha; o membro olhando outra pessoa não vê o projeto.
 */
export default class ObterPerfilPessoa {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(codigo: string, quemPede?: UsuarioAutenticado | null): Promise<PerfilPessoa> {
        const lido = await this.factory.criarUsuarioRepository().buscarPorCodigo(codigo);
        if (!lido) throw new ErroNaoEncontrado("Pessoa não encontrada.");
        const usuario = await comAreasAtuais(this.factory, lido);

        const todosOsProjetos = await this.factory.criarProjetoRepository().listarPorMembro(codigo);
        const veTudo = !quemPede || quemPede.codigo === codigo || podeVerTodosProjetos(quemPede);
        const acessoDe = (projeto: Projeto) => (quemPede ? acessoAoProjeto(quemPede, projeto) : "completo");
        const projetos = veTudo ? todosOsProjetos : todosOsProjetos.filter((p) => acessoDe(p) === "completo");
        const projetosAtuais: ProjetoNoPerfil[] = [];
        const projetosAnteriores: ProjetoNoPerfil[] = [];
        for (const projeto of projetos) {
            const restrito = acessoDe(projeto) !== "completo";
            for (const p of projeto.participacoes.filter((x) => x.usuario.codigo === codigo)) {
                const item: ProjetoNoPerfil = {
                    codigo: projeto.codigo,
                    nome: projeto.nome,
                    referencia: restrito ? null : projeto.referencia,
                    status: projeto.status,
                    funcao: restrito ? null : p.funcao,
                    alocacao: p.alocacao,
                    dataEntrada: p.dataEntrada,
                    dataSaida: p.dataSaida,
                    sigiloso: projeto.sigiloso,
                    tipo: projeto.tipo,
                    geralDaArea: projeto.geralDaArea,
                    restrito,
                };
                (p.ativa ? projetosAtuais : projetosAnteriores).push(item);
            }
        }
        projetosAnteriores.sort((a, b) => (b.dataSaida?.getTime() ?? 0) - (a.dataSaida?.getTime() ?? 0));

        const periodos = await this.factory.criarPeriodoAreaRepository().listarDe(codigo);

        const agora = Date.now();
        let horasCumpridas = 0;
        const proximas: CapacitacaoNoPerfil[] = [];
        const realizadas: CapacitacaoNoPerfil[] = [];
        for (const c of await this.factory.criarCapacitacaoRepository().listar()) {
            const instrutor = c.instrutor?.codigo === codigo;
            const inscricao = c.inscricaoDe(codigo);
            if (!instrutor && !inscricao) continue;
            const item: CapacitacaoNoPerfil = {
                codigo: c.codigo,
                titulo: c.titulo,
                data: c.data,
                hora: c.hora,
                duracaoHoras: c.duracaoHoras,
                papel: instrutor ? "instrutor" : "participante",
                presente: instrutor ? null : inscricao!.presente,
            };
            if (!instrutor && inscricao!.presente === true) horasCumpridas += c.duracaoHoras;
            (c.inicio.getTime() > agora ? proximas : realizadas).push(item);
        }
        proximas.sort((a, b) => a.data.getTime() - b.data.getTime());
        realizadas.sort((a, b) => b.data.getTime() - a.data.getTime());

        return {
            usuario,
            projetosAtuais,
            projetosAnteriores,
            periodos,
            capacitacoes: { proximas, realizadas, horasCumpridas },
            // O total considera todos os projetos (o alerta de 100% vale igual); a lista, só os visíveis.
            alocacao: { ...calcularAlocacao(todosOsProjetos, codigo), projetos: calcularAlocacao(projetos, codigo).projetos },
        };
    }
}
