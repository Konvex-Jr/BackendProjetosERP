import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Usuario from "../../domain/entity/Usuario";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { exigirDominioKonvex, conferirCamposAlterados, exigirTraineeMembro, resolverPerfilPessoa } from "./dadosPessoa";
import EditarUsuarioInput from "./EditarUsuarioInput";

/**
 * RF-010: edita a pessoa. O status muda em AlterarStatusPessoa; área e cargo, nos períodos
 * (sessão 23a), e não aqui.
 */
export default class EditarUsuario {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: EditarUsuarioInput): Promise<Usuario> {
        const usuarios = this.factory.criarUsuarioRepository();
        const atual = await usuarios.buscarPorCodigo(input.codigo);
        if (!atual) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.USUARIO.NAO_ENCONTRADO);

        const email = String(input.email ?? atual.email)
            .trim()
            .toLowerCase();
        if (email !== atual.email) exigirDominioKonvex(email);
        const porEmail = await usuarios.buscarPorEmail(email);
        if (porEmail && porEmail.codigo !== atual.codigo) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.USUARIO.EMAIL_JA_CADASTRADO, "EMAIL_JA_CADASTRADO");
        }

        let senioridade = atual.senioridade;
        if (input.senioridade?.codigo) {
            senioridade = await this.factory.criarSenioridadeRepository().buscarPorCodigo(input.senioridade.codigo);
            if (!senioridade) throw new ErroNaoEncontrado("Senioridade não encontrada.");
        }
        if (!senioridade) {
            throw new ErroValidacao("Selecione uma senioridade cadastrada para o usuário.", "SENIORIDADE_OBRIGATORIA");
        }

        exigirTraineeMembro(atual.status, input.perfil ?? atual.perfil);

        const detalhes = resolverPerfilPessoa(input);
        conferirCamposAlterados(atual, detalhes);
        const editado = atual.copiar({
            nome: input.nome !== undefined ? String(input.nome).trim() : undefined,
            email,
            perfil: input.perfil ?? atual.perfil,
            senioridade,
            ...detalhes,
        });
        await usuarios.editar(editado);
        return editado;
    }
}
