import ClasseProjeto from "../../domain/entity/ClasseProjeto";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { slug } from "../../shared/texto";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/**
 * Sessão 31b: cria uma classe de projeto ou altera nome e ordem. Sem exclusão: os projetos guardam a classe
 * (a FK é RESTRICT); para tirar uma de uso, renomeie.
 */
export default class SalvarClasseProjeto {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: { codigo?: string; nome: unknown; ordem?: number }): Promise<ClasseProjeto> {
        const repo = this.factory.criarClasseProjetoRepository();
        const ordem = input.ordem === undefined ? undefined : Number(input.ordem);
        if (ordem !== undefined && (!Number.isInteger(ordem) || ordem < 0 || ordem > 100)) {
            throw new ErroValidacao("A ordem deve ser um número inteiro entre 0 e 100.", "ORDEM_INVALIDA");
        }
        const nome = typeof input.nome === "string" ? input.nome.trim() : "";
        if (input.codigo) {
            const atual = await repo.buscarPorCodigo(input.codigo);
            if (!atual) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CLASSE.NAO_ENCONTRADA);
            return repo.editar(new ClasseProjeto(atual.codigo, nome, ordem ?? atual.ordem));
        }
        const codigo = slug(nome);
        if (!codigo) throw new ErroValidacao(MENSAGENS_DE_ERRO.CLASSE.NOME_INVALIDO, "CLASSE_NOME_INVALIDO");
        const existentes = await repo.listar();
        return repo.criar(new ClasseProjeto(codigo, nome, ordem ?? existentes.length + 1));
    }
}
