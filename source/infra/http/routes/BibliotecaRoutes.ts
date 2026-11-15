import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import ItemBiblioteca from "../../../domain/entity/ItemBiblioteca";
import { DonoAnexo } from "../../../domain/enum/Anexo";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import { exigirNaoTrainee, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import { ContextoProjetos, contextoProjetos, podeAlterarItem, podeVerProjetoDoItem } from "../../../shared/seguranca/regrasBiblioteca";
import GerirAnexos from "../../../useCases/anexos/GerirAnexos";
import ExcluirItemBiblioteca from "../../../useCases/biblioteca/ExcluirItemBiblioteca";
import ListarItensBiblioteca from "../../../useCases/biblioteca/ListarItensBiblioteca";
import SalvarItemBiblioteca from "../../../useCases/biblioteca/SalvarItemBiblioteca";
import Http from "../Http";
import RespostaSemConteudo from "../RespostaSemConteudo";
import ModelRoutes from "./ModelRoutes";

/**
 * Biblioteca (sessão 17): substitui pastas/documentos, Base de Inteligência e iniciativas.
 * Item que a pessoa não pode ver responde 404 (lista, ficha, edição, exclusão e anexos).
 * O envio de anexo fica em AnexoRoutes (POST /biblioteca/:codigo/anexos).
 */
export default class BibliotecaRoutes implements ModelRoutes {
    constructor(
        private readonly http: Http,
        private readonly factory: RepositoryFactoryInterface,
    ) {}

    init(): void {
        const f = this.factory;
        // Trainee (sessão 20) não usa a Biblioteca: 403 em toda rota, antes de qualquer leitura.
        const exigirSemTrainee = (usuario: UsuarioAutenticado | undefined) =>
            exigirNaoTrainee(usuario, MENSAGENS_DE_ERRO.USUARIO.TRAINEE_SEM_BIBLIOTECA);
        // Cada item diz se quem pediu pode alterá-lo e traz os anexos. Projeto que a pessoa não vê
        // sai como null (Ruling 8), com os projetos dela lidos uma vez por requisição.
        const responder = async (usuario: UsuarioAutenticado, itens: ItemBiblioteca[], contexto?: ContextoProjetos) => {
            const ctx = contexto ?? (await contextoProjetos(usuario, f));
            const anexos = await new GerirAnexos(f).porDono(
                DonoAnexo.BIBLIOTECA,
                itens.map((i) => i.codigo),
            );
            return itens.map((item) => ({
                ...item,
                projeto: item.projeto && podeVerProjetoDoItem(usuario, item.projeto.codigo, ctx) ? item.projeto : null,
                podeAlterar: podeAlterarItem(usuario, item),
                anexos: anexos.get(item.codigo) ?? [],
            }));
        };
        const responderUm = async (usuario: UsuarioAutenticado, item: ItemBiblioteca) => (await responder(usuario, [item]))[0];

        this.http.route("get", "/biblioteca", true, async (_p: any, body: any, query: any) => {
            const usuario = exigirSemTrainee(body?.user);
            const ctx = await contextoProjetos(usuario, f);
            return responder(usuario, await new ListarItensBiblioteca(f).listar(usuario, query ?? {}, ctx), ctx);
        });

        this.http.route("get", "/biblioteca/:codigo", true, async (params: any, body: any) =>
            responderUm(exigirSemTrainee(body?.user), await new ListarItensBiblioteca(f).buscar(body?.user, params.codigo)),
        );

        this.http.route("post", "/biblioteca", true, async (_p: any, body: any) =>
            responderUm(exigirSemTrainee(body?.user), await new SalvarItemBiblioteca(f).criar(body?.user, body ?? {})),
        );

        this.http.route("put", "/biblioteca/:codigo", true, async (params: any, body: any) =>
            responderUm(exigirSemTrainee(body?.user), await new SalvarItemBiblioteca(f).editar(body?.user, params.codigo, body ?? {})),
        );

        this.http.route("delete", "/biblioteca/:codigo", true, async (params: any, body: any) => {
            exigirSemTrainee(body?.user);
            await new ExcluirItemBiblioteca(f).executar(body?.user, params.codigo);
            return new RespostaSemConteudo();
        });
    }
}
