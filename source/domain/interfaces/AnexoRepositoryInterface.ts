import Anexo from "../entity/Anexo";
import { DonoAnexo } from "../enum/Anexo";

/** Registros dos anexos (dono, nome, tamanho). Os bytes ficam no ArmazenamentoAnexosInterface. */
export default interface AnexoRepositoryInterface {
    criar(anexo: Anexo): Promise<Anexo>;
    buscarPorCodigo(codigo: string): Promise<Anexo | null>;
    /** Anexos dos donos informados, do mais antigo ao mais novo. */
    listarPorDonos(tipo: DonoAnexo, codigosDonos: string[]): Promise<Anexo[]>;
    /** Quantidade de anexos por dono (donos sem anexo ficam fora do mapa); lista vazia não consulta. */
    contarPorDonos(tipo: DonoAnexo, codigosDonos: string[]): Promise<Map<string, number>>;
    excluir(codigo: string): Promise<void>;
}
