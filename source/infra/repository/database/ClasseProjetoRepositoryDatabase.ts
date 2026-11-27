import ClasseProjeto from "../../../domain/entity/ClasseProjeto";
import ClasseProjetoRepositoryInterface from "../../../domain/interfaces/ClasseProjetoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { violacaoDeUnicidade } from "../../database/conversoes";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

export default class ClasseProjetoRepositoryDatabase implements ClasseProjetoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async listar(): Promise<ClasseProjeto[]> {
        const linhas = await this.conexao.consultar("SELECT codigo, nome, ordem FROM classes_projeto ORDER BY ordem, nome");
        return linhas.map((l) => new ClasseProjeto(l.codigo, l.nome, Number(l.ordem)));
    }

    async buscarPorCodigo(codigo: string): Promise<ClasseProjeto | null> {
        const linhas = await this.conexao.consultar("SELECT codigo, nome, ordem FROM classes_projeto WHERE codigo = $1", [codigo]);
        return linhas.length ? new ClasseProjeto(linhas[0].codigo, linhas[0].nome, Number(linhas[0].ordem)) : null;
    }

    async criar(classe: ClasseProjeto): Promise<ClasseProjeto> {
        await this.unico(() =>
            this.conexao.consultar("INSERT INTO classes_projeto (codigo, nome, ordem) VALUES ($1, $2, $3)", [
                classe.codigo,
                classe.nome,
                classe.ordem,
            ]),
        );
        return classe;
    }

    async editar(classe: ClasseProjeto): Promise<ClasseProjeto> {
        const linhas = await this.unico(() =>
            this.conexao.consultar("UPDATE classes_projeto SET nome = $2, ordem = $3 WHERE codigo = $1 RETURNING codigo", [
                classe.codigo,
                classe.nome,
                classe.ordem,
            ]),
        );
        if (linhas.length === 0) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CLASSE.NAO_ENCONTRADA);
        return classe;
    }

    private async unico<T>(acao: () => Promise<T>): Promise<T> {
        try {
            return await acao();
        } catch (erro) {
            if (violacaoDeUnicidade(erro)) throw new ErroConflito(MENSAGENS_DE_ERRO.CLASSE.DUPLICADA, "CLASSE_DUPLICADA");
            throw erro;
        }
    }
}
