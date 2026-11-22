import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/entity/Projeto";
import Usuario from "../../domain/entity/Usuario";
import ConsultarOcupacao, { OcupacaoDetalhe } from "../tarefas/ConsultarOcupacao";
import { segundaDaSemana } from "../../domain/service/ocupacao";
import { hoje } from "../../shared/datas";
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
    /** Ocupação da semana atual (horas, teto, percentual e itens que o leitor pode ver). */
    ocupacao: OcupacaoDetalhe;
}

/**
 * RF-013: perfil com projetos atuais e anteriores, períodos nas áreas e capacitações.
 * Todos veem os projetos da pessoa (sessão 27b; antes o membro só via os que ele mesmo via completos).
 * Projeto que quem lê não vê completo sai `restrito`: nome e datas aparecem, referência e função não;
 * a passagem antiga por ele só aparece à gestão e à própria pessoa.
 */
export default class ObterPerfilPessoa {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(codigo: string, quemPede: UsuarioAutenticado): Promise<PerfilPessoa> {
        const lido = await this.factory.criarUsuarioRepository().buscarPorCodigo(codigo);
        if (!lido) throw new ErroNaoEncontrado("Pessoa não encontrada.");
        const usuario = await comAreasAtuais(this.factory, lido);

        const todosOsProjetos = await this.factory.criarProjetoRepository().listarPorMembro(codigo);
        const acessoDe = (projeto: Projeto) => acessoAoProjeto(quemPede, projeto);
        // Como no cartão (sem ex-membros): passagem antiga por projeto restrito só aparece à gestão e à própria pessoa.
        const veAnteriores = quemPede.codigo === codigo || podeVerTodosProjetos(quemPede);
        const projetosAtuais: ProjetoNoPerfil[] = [];
        const projetosAnteriores: ProjetoNoPerfil[] = [];
        for (const projeto of todosOsProjetos) {
            const restrito = acessoDe(projeto) !== "completo";
            for (const p of projeto.participacoes.filter((x) => x.usuario.codigo === codigo && (x.ativa || !restrito || veAnteriores))) {
                const item: ProjetoNoPerfil = {
                    codigo: projeto.codigo,
                    nome: projeto.nome,
                    referencia: restrito ? null : projeto.referencia,
                    status: projeto.status,
                    funcao: restrito ? null : p.funcao,
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
            // As horas contam tudo; os itens seguem o acesso de quem lê (projeto sem acesso vira "outras").
            ocupacao: await new ConsultarOcupacao(this.factory).dePessoa(quemPede, codigo, segundaDaSemana(hoje())),
        };
    }
}
