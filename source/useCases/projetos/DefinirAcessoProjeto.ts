import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/entity/Projeto";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/**
 * Confere a lista de acesso antes de gravar: só pessoas com login (Ativo ou Trainee). Código
 * desconhecido ou pessoa sem login vira 400 com o nome/código, nunca uma violação de chave estrangeira.
 * Devolve a lista sem repetidos.
 */
export async function validarCodigosAcesso(factory: RepositoryFactoryInterface, codigos: unknown): Promise<string[]> {
    if (!Array.isArray(codigos) || codigos.some((c) => typeof c !== "string")) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.ACESSO_LISTA_INVALIDA, "ACESSO_LISTA_INVALIDA");
    }
    const unicos = [...new Set(codigos as string[])];
    const usuarios = factory.criarUsuarioRepository();
    for (const codigo of unicos) {
        const usuario = await usuarios.buscarPorCodigo(codigo);
        if (!usuario || !usuario.ativo) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.ACESSO_PESSOA_SEM_LOGIN(codigo, usuario?.nome), "ACESSO_PESSOA_SEM_LOGIN");
        }
    }
    return unicos;
}

/** Sessão 20: troca a lista de acesso do projeto (além da equipe). Quem pode é decidido na rota. */
export default class DefinirAcessoProjeto {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: { codigoProjeto: string; codigos: string[] }): Promise<Projeto> {
        const projetos = this.factory.criarProjetoRepository();
        const projeto = await projetos.buscarPorCodigo(input.codigoProjeto);
        if (!projeto) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
        const acesso = await validarCodigosAcesso(this.factory, input.codigos);
        return projetos.editar(projeto.copiar({ acesso }));
    }
}
