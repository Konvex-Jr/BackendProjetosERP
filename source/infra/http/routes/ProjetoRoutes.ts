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
import { exigirAutenticado, exigirPermissao, Permissao, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import {
    acessoAoProjeto,
    exigirAcessoCompleto,
    podeGerirAcesso,
    projetosVisiveisPara,
} from "../../../shared/seguranca/visibilidadeProjetos";
import { lerBooleano, lerData, lerDataObrigatoria, lerEnum, lerInteiro, lerLista } from "../../../shared/entradas";
import { resumoProjeto } from "../../../useCases/projetos/resumoProjeto";
import { hoje } from "../../../shared/datas";
import { normalizarBusca } from "../../../shared/texto";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../../shared/erros/ErroProibido";
import { ErroAplicacao } from "../../../shared/erros/ErroAplicacao";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import DefinirAcessoProjeto from "../../../useCases/projetos/DefinirAcessoProjeto";

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
     * Monta a resposta de cada projeto conforme o acesso da pessoa: completo (`toJSON` + contagem de
     * tarefas + `podeGerirAcesso`), resumo (gerente fora de projeto sigiloso) ou nada (some da lista).
     * O frontend calcula o progresso com a contagem de todas as tarefas do projeto; antes usava só as
     * carregadas, e o membro, que recebe só as dele, via outro % (revisão de 12/11/2026).
     * Resumo não tem área, responsável nem pessoa (filtrar por pessoa revelaria a lista de acesso), e a busca só vale pelo nome (referência e cliente não
     * podem servir de pista), então esses filtros o descartam.
     */
    private async paraResposta(
        usuario: UsuarioAutenticado,
        projetos: Projeto[],
        filtro: { codigoUsuario?: string; codigoArea?: string; codigoResponsavel?: string; busca?: string } = {},
    ) {
        const acessos = projetos.map((p) => ({ projeto: p, acesso: acessoAoProjeto(usuario, p) }));
        const busca = normalizarBusca(filtro.busca);
        const resumoServe = (p: Projeto) =>
            !filtro.codigoUsuario && !filtro.codigoArea && !filtro.codigoResponsavel && (!busca || normalizarBusca(p.nome).includes(busca));
        const visiveis = acessos.filter((a) => a.acesso === "completo" || (a.acesso === "resumo" && resumoServe(a.projeto)));
        const contagem = await this.factory.criarTarefaRepository().contarPorProjetos(
            visiveis.map((a) => a.projeto.codigo),
            hoje(),
        );
        return visiveis.map(({ projeto, acesso }) => {
            const tarefas = contagem.get(projeto.codigo) ?? { total: 0, concluidas: 0, atrasadas: 0, semana: 0 };
            return acesso === "resumo"
                ? resumoProjeto(projeto, tarefas)
                : { ...projeto.toJSON(), tarefas, podeGerirAcesso: podeGerirAcesso(usuario, projeto) };
        });
    }

    /**
     * Rotas de escrita: carrega o projeto (404 se não existe) e exige o acesso completo, depois da
     * permissão da ação. Sigiloso: fora da lista o membro recebe 404 e o gerente, 403.
     */
    private async carregarParaEscrita(usuario: UsuarioAutenticado, codigo: string): Promise<Projeto> {
        const projeto = await this.factory.criarProjetoRepository().buscarPorCodigo(codigo);
        if (!projeto) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
        exigirAcessoCompleto(usuario, projeto);
        return projeto;
    }

    init(): void {
        const f = this.factory;

        this.http.route("get", "/projetos", true, async (_p: any, body: any, query: any) => {
            const usuario = exigirAutenticado(body?.user);
            const filtro = {
                codigoUsuario: query?.codigoUsuario || undefined,
                codigoArea: query?.codigoArea || undefined,
                codigoResponsavel: query?.codigoResponsavel || undefined,
                busca: query?.busca || undefined,
            };
            const projetos = await new ListarProjetos(f).execute({
                status: lerLista(query?.status).map((s) => lerEnum(s, StatusProjeto, "status")!),
                ...filtro,
                codigoUsuario: projetosVisiveisPara(usuario, filtro.codigoUsuario),
            });
            return this.paraResposta(usuario, projetos, filtro);
        });

        this.http.route("get", "/projetos/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            const projeto = await f.criarProjetoRepository().buscarPorCodigo(params.codigo);
            if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
            // Quem não vê nada recebe 404 (sigiloso) ou 403 (normal), pela regra central.
            if (acessoAoProjeto(usuario, projeto) === "nada") exigirAcessoCompleto(usuario, projeto);
            return (await this.paraResposta(usuario, [projeto]))[0];
        });

        this.http.route("post", "/projetos", true, async (_p: any, body: any) => {
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            return new CriarProjeto(f).execute({
                criadoPor: usuario.codigo,
                sigiloso: lerBooleano(body.sigiloso, "sigiloso"),
                acesso: body.acesso,
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
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            const atual = await this.carregarParaEscrita(usuario, params.codigo);
            const sigiloso = lerBooleano(body.sigiloso, "sigiloso");
            if (sigiloso !== undefined && sigiloso !== atual.sigiloso && !podeGerirAcesso(usuario, atual)) {
                throw new ErroAplicacao(MENSAGENS_DE_ERRO.PROJETO.SIGILO_SEM_PERMISSAO, "SIGILO_SEM_PERMISSAO", 403);
            }
            return new EditarProjeto(f).execute({
                codigo: params.codigo,
                sigiloso,
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
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            await this.carregarParaEscrita(usuario, params.codigo);
            return new AlternarStatusProjeto(f).execute(params.codigo, lerEnum(body.status, StatusProjeto, "status"));
        });

        // Excluir apaga também as tarefas; prefira o status Arquivado. Só diretores.
        this.http.route("delete", "/projetos/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirPermissao(
                body.user,
                Permissao.PROJETOS_EXCLUIR,
                "Somente diretores excluem projetos. Use o status Arquivado.",
            );
            await this.carregarParaEscrita(usuario, params.codigo);
            return new ExcluirProjeto(f).execute(params.codigo);
        });

        // Lista de acesso do projeto sigiloso (sessão 20): só o diretor e quem criou o projeto.
        this.http.route("put", "/projetos/:codigo/acesso", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            const projeto = await this.carregarParaEscrita(usuario, params.codigo);
            if (!podeGerirAcesso(usuario, projeto)) throw new ErroProibido(MENSAGENS_DE_ERRO.PROJETO.ACESSO_SEM_PERMISSAO);
            return new DefinirAcessoProjeto(f).execute({ codigoProjeto: params.codigo, codigos: body.codigos });
        });

        // Equipe (PR-06)
        this.http.route("post", "/projetos/:codigo/membros", true, async (params: any, body: any) => {
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            await this.carregarParaEscrita(usuario, params.codigo);
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
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            await this.carregarParaEscrita(usuario, params.codigo);
            return new EditarParticipacao(f).execute({
                codigoProjeto: params.codigo,
                codigoParticipacao: params.codigoParticipacao,
                funcao: body.funcao,
                responsabilidades: body.responsabilidades,
                alocacao: lerInteiro(body.alocacao, "alocacao"),
            });
        });

        this.http.route("post", "/projetos/:codigo/membros/:codigoParticipacao/encerrar", true, async (params: any, body: any) => {
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            await this.carregarParaEscrita(usuario, params.codigo);
            return new EncerrarParticipacao(f).execute({
                codigoProjeto: params.codigo,
                codigoParticipacao: params.codigoParticipacao,
                dataSaida: lerData(body.dataSaida, "dataSaida"),
            });
        });

        // Líder do projeto (sessão 8b): { codigoUsuario } da equipe atual, ou null para tirar.
        this.http.route("put", "/projetos/:codigo/lider", true, async (params: any, body: any) => {
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            await this.carregarParaEscrita(usuario, params.codigo);
            return new DefinirLider(f).execute({ codigoProjeto: params.codigo, codigoUsuario: body.codigoUsuario ?? null });
        });
    }
}
