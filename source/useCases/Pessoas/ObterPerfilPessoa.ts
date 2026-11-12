import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Usuario from "../../domain/Entity/Usuario";
import { calcularAlocacao, ResumoAlocacao } from "../../domain/Service/alocacao";
import { MudancaArea, MudancaCargo } from "../../domain/Interfaces/HistoricoPessoaRepositoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";

export interface ProjetoNoPerfil {
    codigo: string;
    nome: string;
    referencia: string | null;
    status: string;
    funcao: string | null;
    alocacao: number;
    dataEntrada: Date;
    dataSaida: Date | null;
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
    historico: { cargos: MudancaCargo[]; areas: MudancaArea[] };
    capacitacoes: { proximas: CapacitacaoNoPerfil[]; realizadas: CapacitacaoNoPerfil[]; horasCumpridas: number };
    alocacao: ResumoAlocacao;
}

/** RF-013: perfil com projetos atuais e anteriores, habilidades, histórico e capacitações. */
export default class ObterPerfilPessoa {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(codigo: string): Promise<PerfilPessoa> {
        const usuario = await this.factory.criarUsuarioRepository().buscarPorCodigo(codigo);
        if (!usuario) throw new ErroNaoEncontrado("Pessoa não encontrada.");

        const projetos = await this.factory.criarProjetoRepository().listarPorMembro(codigo);
        const projetosAtuais: ProjetoNoPerfil[] = [];
        const projetosAnteriores: ProjetoNoPerfil[] = [];
        for (const projeto of projetos) {
            for (const p of projeto.participacoes.filter((x) => x.usuario.codigo === codigo)) {
                const item: ProjetoNoPerfil = {
                    codigo: projeto.codigo,
                    nome: projeto.nome,
                    referencia: projeto.referencia,
                    status: projeto.status,
                    funcao: p.funcao,
                    alocacao: p.alocacao,
                    dataEntrada: p.dataEntrada,
                    dataSaida: p.dataSaida,
                };
                (p.ativa ? projetosAtuais : projetosAnteriores).push(item);
            }
        }
        projetosAnteriores.sort((a, b) => (b.dataSaida?.getTime() ?? 0) - (a.dataSaida?.getTime() ?? 0));

        const historicoRepo = this.factory.criarHistoricoPessoaRepository();
        const historico = {
            cargos: await historicoRepo.listarCargos(codigo),
            areas: await historicoRepo.listarAreas(codigo),
        };

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
            historico,
            capacitacoes: { proximas, realizadas, horasCumpridas },
            alocacao: calcularAlocacao(projetos, codigo),
        };
    }
}
