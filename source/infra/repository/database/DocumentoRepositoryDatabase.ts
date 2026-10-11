import Documento from "../../../domain/Entity/Documento";
import Pasta from "../../../domain/Entity/Pasta";
import DocumentoRepositoryInterface from "../../../domain/Interfaces/DocumentoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";
import { carregarUsuarios } from "./carregadores";

const SELECT_DOCUMENTO = `
    SELECT codigo, pasta_codigo, nome, extensao, tamanho_bytes, data_envio,
           autor_codigo, arquivo_url
    FROM documentos
`;

export default class DocumentoRepositoryDatabase implements DocumentoRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(documento: Documento): Promise<Documento> {
        await this.conexao.consultar(
            `INSERT INTO documentos
                (codigo, pasta_codigo, nome, extensao, tamanho_bytes, data_envio, autor_codigo, arquivo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                documento.codigo,
                documento.pasta.codigo,
                documento.nome,
                documento.extensao,
                documento.tamanhoBytes,
                dataParaSql(documento.dataEnvio),
                documento.autor.codigo,
                documento.arquivoUrl,
            ],
        );
        return documento;
    }

    async listarPorPasta(codigoPasta: string): Promise<Documento[]> {
        const linhas = await this.conexao.consultar(
            `${SELECT_DOCUMENTO} WHERE pasta_codigo = $1 ORDER BY data_envio DESC, nome`,
            [codigoPasta],
        );
        return this.hidratar(linhas);
    }

    async contarPorPasta(codigoPasta: string): Promise<number> {
        const linhas = await this.conexao.consultar(
            "SELECT count(*)::int AS total FROM documentos WHERE pasta_codigo = $1",
            [codigoPasta],
        );
        return Number(linhas[0].total);
    }

    async buscarPorCodigo(codigo: string): Promise<Documento | null> {
        const linhas = await this.conexao.consultar(
            `${SELECT_DOCUMENTO} WHERE codigo = $1`,
            [codigo],
        );
        const documentos = await this.hidratar(linhas);
        return documentos[0] ?? null;
    }

    async editar(documento: Documento): Promise<Documento> {
        const linhas = await this.conexao.consultar(
            `UPDATE documentos
             SET nome = $2, extensao = $3, pasta_codigo = $4
             WHERE codigo = $1
             RETURNING codigo`,
            [documento.codigo, documento.nome, documento.extensao, documento.pasta.codigo],
        );

        if (linhas.length === 0) {
            throw new Error("Documento não encontrado");
        }

        return documento;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar(
            "DELETE FROM documentos WHERE codigo = $1 RETURNING codigo",
            [codigo],
        );

        if (linhas.length === 0) {
            throw new Error("Documento não encontrado");
        }
    }

    async excluirPorPasta(codigoPasta: string): Promise<void> {
        await this.conexao.consultar(
            "DELETE FROM documentos WHERE pasta_codigo = $1",
            [codigoPasta],
        );
    }

    private async hidratar(linhas: any[]): Promise<Documento[]> {
        if (linhas.length === 0) {
            return [];
        }

        const codigosPastas = [...new Set<string>(linhas.map((l) => l.pasta_codigo))];
        const pastasLinhas = await this.conexao.consultar(
            "SELECT codigo, nome FROM pastas WHERE codigo = ANY($1::uuid[])",
            [codigosPastas],
        );
        const pastas = new Map<string, Pasta>(
            pastasLinhas.map((p) => [p.codigo, new Pasta(p.nome, p.codigo)]),
        );

        const autores = await carregarUsuarios(
            this.conexao,
            linhas.map((l) => l.autor_codigo),
        );

        return linhas.map(
            (l) =>
                new Documento(
                    pastas.get(l.pasta_codigo)!,
                    l.nome,
                    Number(l.tamanho_bytes),
                    l.data_envio,
                    autores.get(l.autor_codigo)!,
                    l.arquivo_url,
                    l.extensao,
                    l.codigo,
                ),
        );
    }
}
