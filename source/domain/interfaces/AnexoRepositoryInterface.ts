import Anexo from "../entity/Anexo";
import { DonoAnexo } from "../enum/Anexo";

export default interface AnexoRepositoryInterface {
    criar(anexo: Anexo): Promise<Anexo>;
    buscarPorCodigo(codigo: string): Promise<Anexo | null>;
    /** Anexos dos donos informados, do mais antigo ao mais novo. */
    listarPorDonos(tipo: DonoAnexo, codigosDonos: string[]): Promise<Anexo[]>;
    excluir(codigo: string): Promise<void>;
}
