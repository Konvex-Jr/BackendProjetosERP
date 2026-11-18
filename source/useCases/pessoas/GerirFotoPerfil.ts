import { v4 as uuidv4 } from "uuid";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

export const TAMANHO_MAXIMO_FOTO = 300 * 1024;

/** Assinatura WebP: "RIFF", 4 bytes de tamanho, "WEBP". */
function ehWebp(conteudo: Buffer): boolean {
    return conteudo.length >= 12 && conteudo.toString("latin1", 0, 4) === "RIFF" && conteudo.toString("latin1", 8, 12) === "WEBP";
}

export default class GerirFotoPerfil {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async trocar(codigoUsuario: string, conteudo: Buffer): Promise<{ foto: string }> {
        if (!Buffer.isBuffer(conteudo) || !ehWebp(conteudo)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.FOTO.FORMATO_INVALIDO, "FOTO_FORMATO_INVALIDO");
        }
        if (conteudo.length > TAMANHO_MAXIMO_FOTO) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.FOTO.GRANDE_DEMAIS, "FOTO_GRANDE_DEMAIS");
        }
        const usuarios = this.factory.criarUsuarioRepository();
        if (!(await usuarios.buscarPorCodigo(codigoUsuario))) throw new ErroNaoEncontrado("Usuário não encontrado.");

        const armazenamento = this.factory.criarArmazenamentoFotos();
        const foto = `${uuidv4()}.webp`;
        await armazenamento.salvar(foto, conteudo);
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
