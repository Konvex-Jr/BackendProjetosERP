import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import ItemBiblioteca from "../../../domain/entity/ItemBiblioteca";
import { DonoAnexo } from "../../../domain/enum/Anexo";
import { exigirAutenticado, UsuarioAutenticado } from "../../../shared/seguranca/permissoes";
import { podeAlterarItem } from "../../../shared/seguranca/regrasBiblioteca";
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
        // Cada item diz se quem pediu pode alterá-lo e traz os anexos.
        const responder = async (usuario: UsuarioAutenticado, itens: ItemBiblioteca[]) => {
            const anexos = await new GerirAnexos(f).porDono(
                DonoAnexo.BIBLIOTECA,
                itens.map((i) => i.codigo),
            );
            return itens.map((item) => ({
                ...item,
                podeAlterar: podeAlterarItem(usuario, item),
                anexos: anexos.get(item.codigo) ?? [],
            }));
        };
        const responderUm = async (usuario: UsuarioAutenticado, item: ItemBiblioteca) => (await responder(usuario, [item]))[0];

        this.http.route("get", "/biblioteca", true, async (_p: any, body: any, query: any) =>
            responder(exigirAutenticado(body?.user), await new ListarItensBiblioteca(f).listar(body?.user, query ?? {})),
        );

        this.http.route("get", "/biblioteca/:codigo", true, async (params: any, body: any) =>
            responderUm(exigirAutenticado(body?.user), await new ListarItensBiblioteca(f).buscar(body?.user, params.codigo)),
        );

        this.http.route("post", "/biblioteca", true, async (_p: any, body: any) =>
            responderUm(exigirAutenticado(body?.user), await new SalvarItemBiblioteca(f).criar(body?.user, body ?? {})),
        );

        this.http.route("put", "/biblioteca/:codigo", true, async (params: any, body: any) =>
            responderUm(exigirAutenticado(body?.user), await new SalvarItemBiblioteca(f).editar(body?.user, params.codigo, body ?? {})),
        );

        this.http.route("delete", "/biblioteca/:codigo", true, async (params: any, body: any) => {
            await new ExcluirItemBiblioteca(f).executar(body?.user, params.codigo);
            return new RespostaSemConteudo();
        });
    }
}
