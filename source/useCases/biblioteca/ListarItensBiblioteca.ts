import ItemBiblioteca from "../../domain/entity/ItemBiblioteca";
import { FiltrosBiblioteca } from "../../domain/interfaces/BibliotecaRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import { lerEnum } from "../../shared/entradas";
import { exigirAutenticado, UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { exigirVerItem, podeVerItem, podeVerProjetoDoItem, projetosDoUsuario } from "../../shared/seguranca/regrasBiblioteca";

/** Query de GET /biblioteca. */
export interface ConsultaBiblioteca {
    q?: unknown;
    tag?: unknown;
    projeto?: unknown;
    sigilo?: unknown;
    autor?: unknown;
}

function texto(valor: unknown): string | undefined {
    return String(valor ?? "").trim() || undefined;
}

/**
 * Lista e abre itens da Biblioteca (sessão 17). O repositório não filtra por visibilidade:
 * o filtro é aplicado aqui, com os projetos da pessoa lidos uma vez por requisição.
 */
export default class ListarItensBiblioteca {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    /** `meusProjetos` pode vir de quem chama (a rota usa o mesmo conjunto para esconder projetos). */
    async listar(
        usuario: UsuarioAutenticado | null | undefined,
        consulta: ConsultaBiblioteca = {},
        meusProjetos?: ReadonlySet<string>,
    ): Promise<ItemBiblioteca[]> {
        const autenticado = exigirAutenticado(usuario);
        const filtros: FiltrosBiblioteca = {
            busca: texto(consulta.q),
            tag: texto(consulta.tag)?.replace(/^#+/, "") || undefined,
            codigoProjeto: texto(consulta.projeto),
            sigilo: lerEnum(texto(consulta.sigilo), SigiloBiblioteca, "sigilo"),
            codigoAutor: texto(consulta.autor),
        };
        const meus = meusProjetos ?? (await projetosDoUsuario(autenticado, this.factory));
        // Filtrar por projeto que a pessoa não vê não revela itens ligados a ele (Ruling 8).
        if (filtros.codigoProjeto && !podeVerProjetoDoItem(autenticado, filtros.codigoProjeto, meus)) return [];
        const itens = await this.factory.criarBibliotecaRepository().listar(filtros);
        return itens.filter((item) => podeVerItem(autenticado, item, meus));
    }

    /** Item invisível ou inexistente: 404 (mesma resposta). */
    async buscar(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<ItemBiblioteca> {
        const item = await this.factory.criarBibliotecaRepository().buscarPorCodigo(codigo);
        return exigirVerItem(usuario, item, this.factory);
    }
}
