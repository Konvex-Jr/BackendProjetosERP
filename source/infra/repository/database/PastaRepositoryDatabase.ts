import Pasta from "../../../domain/Entity/Pasta";
import PastaRepositoryInterface from "../../../domain/Interfaces/PastaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

export default class PastaRepositoryDatabase implements PastaRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(pasta: Pasta): Promise<Pasta> {
        await this.conexao.consultar(
            "INSERT INTO pastas (codigo, nome) VALUES ($1, $2)",
            [pasta.codigo, pasta.nome],
        );
        return pasta;
    }

    async listar(): Promise<Pasta[]> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo, nome FROM pastas ORDER BY nome",
        );
        return linhas.map((l) => new Pasta(l.nome, l.codigo));
    }

    async buscarPorCodigo(codigo: string): Promise<Pasta | null> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo, nome FROM pastas WHERE codigo = $1",
            [codigo],
        );
        return linhas.length > 0 ? new Pasta(linhas[0].nome, linhas[0].codigo) : null;
    }

    async editar(pasta: Pasta): Promise<Pasta> {
        const linhas = await this.conexao.consultar(
            "UPDATE pastas SET nome = $2 WHERE codigo = $1 RETURNING codigo",
            [pasta.codigo, pasta.nome],
        );

        if (linhas.length === 0) {
            throw new Error("Pasta não encontrada");
        }

        return pasta;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar(
            "DELETE FROM pastas WHERE codigo = $1 RETURNING codigo",
            [codigo],
        );

        if (linhas.length === 0) {
            throw new Error("Pasta não encontrada");
        }
    }
}
