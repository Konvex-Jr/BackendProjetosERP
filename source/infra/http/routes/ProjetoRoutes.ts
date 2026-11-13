import Projeto from "../../../domain/entity/Projeto";
import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import StatusProjeto from "../../../domain/enum/StatusProjeto";
import PrioridadeProjeto from "../../../domain/enum/PrioridadeProjeto";
import ListarProjetos from "../../../useCases/projetos/ListarProjetos";
import CriarProjeto from "../../../useCases/projetos/CriarProjeto";
import EditarProjeto from "../../../useCases/projetos/EditarProjeto";
import ExcluirProjeto from "../../../useCases/projetos/ExcluirProjeto";
import AlternarStatusProjeto from "../../../useCases/projetos/AlternarStatusProjeto";
import { AdicionarParticipante, DefinirLider, EditarParticipacao, EncerrarParticipacao } from "../../../useCases/projetos/Equipe";
import { EntradaDetalhesProjeto } from "../../../useCases/projetos/dadosProjeto";
import { exigirPermissao, Permissao } from "../../../shared/seguranca/permissoes";
import { exigirVerProjeto, projetosVisiveisPara } from "../../../shared/seguranca/visibilidadeProjetos";
import { lerData, lerDataObrigatoria, lerEnum, lerInteiro, lerLista } from "../../../shared/entradas";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

function lerDetalhes(body: any): EntradaDetalhesProjeto {
    return {
        referencia: body.referencia,
        objetivo: body.objetivo,
        clienteNome: body.clienteNome,
        prioridade: lerEnum(body.prioridade, PrioridadeProjeto, "prioridade"),
        progresso: lerInteiro(body.progresso, "progresso"),
        codigoResponsavel: body.codigoResponsavel,
        codigoArea: body.codigoArea,
        tags: body.tags === undefined ? undefined : lerLista(body.tags),
    };
}

/** Projetos e equipe (RF-020 a RF-024). Gestores veem todos; membro vê os de que participa ou participou. Escrita para gestores. */
export default class ProjetoRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    /**
     * Acrescenta `tarefas: { total, concluidas }` de todas as tarefas do projeto. O frontend calcula
     * o progresso com isso; antes usava só as tarefas carregadas, e o membro, que recebe só as
     * dele, via outro % (revisão de 12/11/2026).
     */
    private async comContagem(projetos: Projeto[]) {
        const contagem = await this.factory.criarTarefaRepository().contarPorProjetos(projetos.map((p) => p.codigo));
        return projetos.map((p) => ({ ...p.toJSON(), tarefas: contagem.get(p.codigo) ?? { total: 0, concluidas: 0 } }));
    }

    init(): void {
        const f = this.factory;

        this.http.route("get", "/projetos", true, async (_p: any, body: any, query: any) =>
            this.comContagem(
                await new ListarProjetos(f).execute({
                    codigoUsuario: projetosVisiveisPara(body?.user, query?.codigoUsuario || undefined),
                    status: lerLista(query?.status).map((s) => lerEnum(s, StatusProjeto, "status")!),
                    codigoArea: query?.codigoArea || undefined,
                    codigoResponsavel: query?.codigoResponsavel || undefined,
                    busca: query?.busca || undefined,
                }),
            ),
        );

        this.http.route("get", "/projetos/:codigo", true, async (params: any, body: any) => {
            const projeto = await f.criarProjetoRepository().buscarPorCodigo(params.codigo);
            if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
            exigirVerProjeto(body?.user, projeto);
            return (await this.comContagem([projeto]))[0];
        });

        this.http.route("post", "/projetos", true, async (_p: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new CriarProjeto(f).execute({
                nome: body.nome,
                descricao: body.descricao,
                dataInicio: lerDataObrigatoria(body.dataInicio, "dataInicio"),
                dataFim: lerDataObrigatoria(body.dataFim, "dataFim"),
                status: lerEnum(body.status, StatusProjeto, "status"),
                codigosMembros: body.codigosMembros ?? [],
                ...lerDetalhes(body),
            });
        });

        this.http.route("put", "/projetos/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new EditarProjeto(f).execute({
                codigo: params.codigo,
                nome: body.nome,
                descricao: body.descricao,
                dataInicio: lerDataObrigatoria(body.dataInicio, "dataInicio"),
                dataFim: lerDataObrigatoria(body.dataFim, "dataFim"),
                status: lerEnum(body.status, StatusProjeto, "status"),
                codigosMembros: body.codigosMembros,
                ...lerDetalhes(body),
            });
        });

        this.http.route("patch", "/projetos/:codigo/status", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new AlternarStatusProjeto(f).execute(params.codigo, lerEnum(body.status, StatusProjeto, "status"));
        });

        // Excluir apaga também as tarefas; prefira o status Arquivado. Só diretores.
        this.http.route("delete", "/projetos/:codigo", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EXCLUIR, "Somente diretores excluem projetos. Use o status Arquivado.");
            return new ExcluirProjeto(f).execute(params.codigo);
        });

        // Equipe (PR-06)
        this.http.route("post", "/projetos/:codigo/membros", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new AdicionarParticipante(f).execute({
                codigoProjeto: params.codigo,
                codigoUsuario: body.codigoUsuario,
                funcao: body.funcao,
                responsabilidades: body.responsabilidades,
                alocacao: lerInteiro(body.alocacao, "alocacao"),
                dataEntrada: lerData(body.dataEntrada, "dataEntrada"),
            });
        });

        this.http.route("put", "/projetos/:codigo/membros/:codigoParticipacao", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new EditarParticipacao(f).execute({
                codigoProjeto: params.codigo,
                codigoParticipacao: params.codigoParticipacao,
                funcao: body.funcao,
                responsabilidades: body.responsabilidades,
                alocacao: lerInteiro(body.alocacao, "alocacao"),
            });
        });

        this.http.route("post", "/projetos/:codigo/membros/:codigoParticipacao/encerrar", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new EncerrarParticipacao(f).execute({
                codigoProjeto: params.codigo,
                codigoParticipacao: params.codigoParticipacao,
                dataSaida: lerData(body.dataSaida, "dataSaida"),
            });
        });

        // Líder do projeto (sessão 8b): { codigoUsuario } da equipe atual, ou null para tirar.
        this.http.route("put", "/projetos/:codigo/lider", true, async (params: any, body: any) => {
            exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new DefinirLider(f).execute({ codigoProjeto: params.codigo, codigoUsuario: body.codigoUsuario ?? null });
        });
    }
}
