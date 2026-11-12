import Pasta from "../../../domain/Entity/Pasta";
import PastaRepositoryInterface from "../../../domain/Interfaces/PastaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

/** SELECT de pastas com o projeto ligado (sigilo "projeto"). Reaproveitado pelo repositório de documentos. */
export const SELECT_PASTA = `
    SELECT pa.codigo, pa.nome, pa.sigilo, pa.projeto_codigo, pr.nome AS projeto_nome
    FROM pastas pa
    LEFT JOIN projetos pr ON pr.codigo = pa.projeto_codigo
`;

export function pastaDaLinha(l: any): Pasta {
    const projeto = l.projeto_codigo ? { codigo: l.projeto_codigo, nome: l.projeto_nome } : null;
    return new Pasta(l.nome, l.codigo, l.sigilo, projeto);
}

export default class PastaRepositoryDatabase implements PastaRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(pasta: Pasta): Promise<Pasta> {
        await this.conexao.consultar("INSERT INTO pastas (codigo, nome, sigilo, projeto_codigo) VALUES ($1, $2, $3, $4)", [
            pasta.codigo,
            pasta.nome,
            pasta.sigilo,
            pasta.projeto?.codigo ?? null,
        ]);
        return pasta;
    }

    async listar(): Promise<Pasta[]> {
        const linhas = await this.conexao.consultar(`${SELECT_PASTA} ORDER BY pa.nome`);
        return linhas.map(pastaDaLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<Pasta | null> {
        const linhas = await this.conexao.consultar(`${SELECT_PASTA} WHERE pa.codigo = $1`, [codigo]);
        return linhas.length > 0 ? pastaDaLinha(linhas[0]) : null;
    }

    async editar(pasta: Pasta): Promise<Pasta> {
        const linhas = await this.conexao.consultar(
            "UPDATE pastas SET nome = $2, sigilo = $3, projeto_codigo = $4 WHERE codigo = $1 RETURNING codigo",
            [pasta.codigo, pasta.nome, pasta.sigilo, pasta.projeto?.codigo ?? null],
        );

        if (linhas.length === 0) {
            throw new Error("Pasta não encontrada");
        }

        return pasta;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar("DELETE FROM pastas WHERE codigo = $1 RETURNING codigo", [codigo]);

        if (linhas.length === 0) {
            throw new Error("Pasta não encontrada");
        }
    }
}
