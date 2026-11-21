import Projeto from "../../../domain/entity/Projeto";
import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import Http from "../Http";
import ModelRoutes from "./ModelRoutes";
import StatusProjeto from "../../../domain/enum/StatusProjeto";
import PrioridadeProjeto from "../../../domain/enum/PrioridadeProjeto";
import TipoProjeto from "../../../domain/enum/TipoProjeto";
import { ErroValidacao } from "../../../shared/erros/ErroValidacao";
import ListarProjetos from "../../../useCases/projetos/ListarProjetos";
import CriarProjeto from "../../../useCases/projetos/CriarProjeto";
import EditarProjeto from "../../../useCases/projetos/EditarProjeto";
import ExcluirProjeto from "../../../useCases/projetos/ExcluirProjeto";
import AlternarStatusProjeto from "../../../useCases/projetos/AlternarStatusProjeto";
import { AdicionarParticipante, DefinirLider, EditarParticipacao, EncerrarParticipacao } from "../../../useCases/projetos/Equipe";
import { EntradaDetalhesProjeto } from "../../../useCases/projetos/dadosProjeto";
import { exigirAutenticado, exigirPermissao, Permissao, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import { acessoAoProjeto, exigirAcessoCompleto, exigirNaoSeTrancar } from "../../../shared/seguranca/visibilidadeProjetos";
import { lerBooleano, lerData, lerDataObrigatoria, lerEnum, lerInteiro, lerLista } from "../../../shared/entradas";
import { cartaoProjeto } from "../../../useCases/projetos/cartaoProjeto";
import { hoje } from "../../../shared/datas";
import { normalizarBusca } from "../../../shared/texto";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../../shared/erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import GerirColunasProjeto from "../../../useCases/projetos/GerirColunasProjeto";
import { papelNoProjeto } from "../../../shared/seguranca/regrasTarefa";

/** Tipo vindo da API (ausente = não informado); outro valor é 400 TIPO_PROJETO_INVALIDO. */
function lerTipo(valor: unknown): TipoProjeto | undefined {
    if (valor === undefined || valor === null || valor === "") return undefined;
    if (!Object.values(TipoProjeto).includes(valor as TipoProjeto)) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.TIPO_INVALIDO, "TIPO_PROJETO_INVALIDO");
    }
    return valor as TipoProjeto;
}

function lerDetalhes(body: any): EntradaDetalhesProjeto {
    return {
        referencia: body.referencia,
        objetivo: body.objetivo,
        clienteNome: body.clienteNome,
        prioridade: lerEnum(body.prioridade, PrioridadeProjeto, "prioridade"),
        tipo: lerTipo(body.tipo),
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
     * Monta a resposta de cada projeto conforme o acesso da pessoa (sessão 27a): completo (`toJSON` + contagem
     * de tarefas) ou cartão (`cartaoProjeto`, lista fechada).
     * O frontend calcula o progresso com a contagem de todas as tarefas do projeto; antes usava só as
     * carregadas, e o membro, que recebe só as dele, via outro % (revisão de 12/11/2026).
     * Cartão: filtros de pessoa e responsável o descartam (revelariam a equipe); o de área vale só para o
     * interno (só ele mostra a área no cartão); a busca só vale pelo nome (referência e cliente não podem servir de pista).
     */
    private async paraResposta(
        usuario: UsuarioAutenticado,
        projetos: Projeto[],
        filtro: { codigoUsuario?: string; codigoArea?: string; codigoResponsavel?: string; busca?: string } = {},
    ) {
        const acessos = projetos.map((p) => ({ projeto: p, acesso: acessoAoProjeto(usuario, p) }));
        const busca = normalizarBusca(filtro.busca);
        const cartaoServe = (p: Projeto) =>
            !filtro.codigoUsuario &&
            !filtro.codigoResponsavel &&
            (!filtro.codigoArea || p.tipo === TipoProjeto.INTERNO) &&
            (!busca || normalizarBusca(p.nome).includes(busca));
        const visiveis = acessos.filter((a) => a.acesso === "completo" || cartaoServe(a.projeto));
        const completos = visiveis.filter((a) => a.acesso === "completo").map((a) => a.projeto.codigo);
        const contagem = await this.factory.criarTarefaRepository().contarPorProjetos(completos, hoje());
        return visiveis.map(({ projeto, acesso }) => {
            if (acesso !== "completo") return cartaoProjeto(projeto);
            const tarefas = contagem.get(projeto.codigo) ?? { total: 0, concluidas: 0, atrasadas: 0, semana: 0 };
            return { ...projeto.toJSON(), tarefas };
        });
    }

    /**
     * Rotas de escrita: carrega o projeto (404 se não existe) e exige o acesso completo, depois da
     * permissão da ação. Quem só tem o cartão recebe 403 PROJETO_SEM_ACESSO.
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
            const tipo = lerTipo(query?.tipo);
            // Todos os projetos (sessão 27a): cada um sai completo ou como cartão. O filtro de pessoa vale
            // como veio; os cartões que ele traria são descartados em paraResposta.
            const projetos = await new ListarProjetos(f).execute({
                status: lerLista(query?.status).map((s) => lerEnum(s, StatusProjeto, "status")!),
                ...filtro,
                tipo,
            });
            return this.paraResposta(usuario, projetos, filtro);
        });

        this.http.route("get", "/projetos/:codigo", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            const projeto = await f.criarProjetoRepository().buscarPorCodigo(params.codigo);
            if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
            // Completo ou cartão, sempre 200: o nome do projeto é público para quem está logado.
            return (await this.paraResposta(usuario, [projeto]))[0];
        });

        this.http.route("post", "/projetos", true, async (_p: any, body: any) => {
            const usuario = exigirPermissao(body.user, Permissao.PROJETOS_EDITAR);
            const sigiloso = lerBooleano(body.sigiloso, "sigiloso");
            // A equipe inicial do corpo; lerLista não deixa um texto passar por lista (includes de substring).
            if (sigiloso) exigirNaoSeTrancar(usuario, lerLista(body.codigosMembros));
            return new CriarProjeto(f).execute({
                criadoPor: usuario.codigo,
                sigiloso,
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
            const projeto = await this.carregarParaEscrita(usuario, params.codigo);
            const sigiloso = lerBooleano(body.sigiloso, "sigiloso");
            // Só quando liga o sigilo: mexer em outro campo de um sigiloso existente (ou sair da equipe dele)
            // não barra ninguém. A equipe que vale é a que fica depois da gravação: a do corpo, se veio.
            if (sigiloso === true && !projeto.sigiloso) {
                const equipe = body.codigosMembros !== undefined ? lerLista(body.codigosMembros) : projeto.membros.map((m) => m.codigo);
                exigirNaoSeTrancar(usuario, equipe);
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

        // Colunas do quadro (sessão 21): o líder e a gestão. `destinos` diz para onde vão as tarefas das colunas excluídas.
        this.http.route("put", "/projetos/:codigo/colunas", true, async (params: any, body: any) => {
            const usuario = exigirAutenticado(body?.user);
            const projeto = await this.carregarParaEscrita(usuario, params.codigo);
            const papel = papelNoProjeto(usuario, projeto);
            if (papel !== "gestao" && papel !== "lider") throw new ErroProibido(MENSAGENS_DE_ERRO.COLUNA.SEM_PERMISSAO);
            return new GerirColunasProjeto(f).execute({
                codigoProjeto: params.codigo,
                colunas: body.colunas,
                destinos: body.destinos,
                quem: await f.criarUsuarioRepository().buscarPorCodigo(usuario.codigo),
            });
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
