import ItemBiblioteca from "../../domain/entity/ItemBiblioteca";
import { FiltrosBiblioteca } from "../../domain/interfaces/BibliotecaRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import SigiloBiblioteca from "../../domain/enum/SigiloBiblioteca";
import { lerEnum } from "../../shared/entradas";
import { exigirAutenticado, UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { exigirVerItem, podeVerItem, projetosDoUsuario } from "../../shared/seguranca/regrasBiblioteca";

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

    async listar(usuario: UsuarioAutenticado | null | undefined, consulta: ConsultaBiblioteca = {}): Promise<ItemBiblioteca[]> {
        const autenticado = exigirAutenticado(usuario);
        const filtros: FiltrosBiblioteca = {
            busca: texto(consulta.q),
            tag: texto(consulta.tag)?.replace(/^#+/, "") || undefined,
            codigoProjeto: texto(consulta.projeto),
            sigilo: lerEnum(texto(consulta.sigilo), SigiloBiblioteca, "sigilo"),
            codigoAutor: texto(consulta.autor),
        };
        const itens = await this.factory.criarBibliotecaRepository().listar(filtros);
        const meusProjetos = await projetosDoUsuario(autenticado, this.factory);
        return itens.filter((item) => podeVerItem(autenticado, item, meusProjetos));
    }

    /** Item invisível ou inexistente: 404 (mesma resposta). */
    async buscar(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<ItemBiblioteca> {
        const item = await this.factory.criarBibliotecaRepository().buscarPorCodigo(codigo);
        return exigirVerItem(usuario, item, this.factory);
    }
}
