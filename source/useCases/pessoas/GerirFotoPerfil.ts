import { v4 as uuidv4 } from "uuid";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { converterFoto, formatoDaFoto } from "../../shared/foto";

export const TAMANHO_MAXIMO_FOTO = 300 * 1024;

export default class GerirFotoPerfil {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async trocar(codigoUsuario: string, conteudo: Buffer): Promise<{ foto: string }> {
        const formatoInvalido = () => new ErroValidacao(MENSAGENS_DE_ERRO.FOTO.FORMATO_INVALIDO, "FOTO_FORMATO_INVALIDO");
        if (!Buffer.isBuffer(conteudo) || !formatoDaFoto(conteudo)) throw formatoInvalido();
        if (conteudo.length > TAMANHO_MAXIMO_FOTO) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.FOTO.GRANDE_DEMAIS, "FOTO_GRANDE_DEMAIS");
        }
        // Arquivo com assinatura certa mas corrompido (ou grande demais em pixels): 400, nunca 500.
        const webp = await converterFoto(conteudo).catch(() => {
            throw formatoInvalido();
        });
        const usuarios = this.factory.criarUsuarioRepository();
        if (!(await usuarios.buscarPorCodigo(codigoUsuario))) throw new ErroNaoEncontrado("Usuário não encontrado.");

        const armazenamento = this.factory.criarArmazenamentoFotos();
        const foto = `${uuidv4()}.webp`;
        await armazenamento.salvar(foto, webp);
        let antiga: string | null;
        try {
            antiga = await usuarios.definirFoto(codigoUsuario, foto);
        } catch (erro) {
            await armazenamento.excluir(foto).catch((e) => console.warn("Foto nova não apagada:", e?.message ?? e));
            throw erro;
        }
        await this.excluirSemFalhar(antiga);
        return { foto };
    }

    async remover(codigoUsuario: string): Promise<void> {
        const antiga = await this.factory.criarUsuarioRepository().definirFoto(codigoUsuario, null);
        await this.excluirSemFalhar(antiga);
    }

    /** O arquivo antigo sobrando é só lixo no disco; não pode desfazer a troca. */
    private async excluirSemFalhar(arquivo: string | null): Promise<void> {
        if (!arquivo) return;
        try {
            await this.factory.criarArmazenamentoFotos().excluir(arquivo);
        } catch (erro: any) {
            console.warn("Foto antiga não apagada:", arquivo, erro?.message ?? erro);
        }
    }
}
