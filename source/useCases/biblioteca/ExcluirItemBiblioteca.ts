import { DonoAnexo } from "../../domain/enum/Anexo";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { exigirAlterarItem, exigirVerItem } from "../../shared/seguranca/regrasBiblioteca";
import GerirAnexos from "../anexos/GerirAnexos";

/** Exclui um item da Biblioteca e os anexos (registros e arquivos). Invisível: 404; sem permissão: 403. */
export default class ExcluirItemBiblioteca {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async executar(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<void> {
        const repo = this.factory.criarBibliotecaRepository();
        const item = await exigirVerItem(usuario, await repo.buscarPorCodigo(codigo), this.factory);
        exigirAlterarItem(usuario, item);
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.BIBLIOTECA, [codigo]);
        await repo.excluir(codigo);
    }
}
