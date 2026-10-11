import Projeto from "../../../domain/Entity/Projeto";
import ProjetoRepositoryInterface from "../../../domain/Interfaces/ProjetoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";
import { carregarProjetos } from "./carregadores";

export default class ProjetoRepositoryDatabase implements ProjetoRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(projeto: Projeto): Promise<Projeto> {
        await this.conexao.transacao(async (conexao) => {
            await conexao.consultar(
                `INSERT INTO projetos (codigo, nome, descricao, data_inicio, data_fim, status)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    projeto.codigo,
                    projeto.nome,
                    projeto.descricao,
                    dataParaSql(projeto.dataInicio),
                    dataParaSql(projeto.dataFim),
                    projeto.status,
                ],
            );
            await this.gravarMembros(conexao, projeto);
        });

        return projeto;
    }

    async listar(): Promise<Projeto[]> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo FROM projetos ORDER BY data_inicio, nome",
        );
        return this.hidratar(linhas.map((l) => l.codigo));
    }

    async listarPorMembro(codigoUsuario: string): Promise<Projeto[]> {
        const linhas = await this.conexao.consultar(
            `SELECT p.codigo
             FROM projetos p
             JOIN projeto_membros pm ON pm.projeto_codigo = p.codigo
             WHERE pm.usuario_codigo = $1
             ORDER BY p.data_inicio, p.nome`,
            [codigoUsuario],
        );
        return this.hidratar(linhas.map((l) => l.codigo));
    }

    async buscarPorCodigo(codigo: string): Promise<Projeto | null> {
        const projetos = await carregarProjetos(this.conexao, [codigo]);
        return projetos.get(codigo) ?? null;
    }

    async editar(projeto: Projeto): Promise<Projeto> {
        await this.conexao.transacao(async (conexao) => {
            const linhas = await conexao.consultar(
                `UPDATE projetos
                 SET nome = $2, descricao = $3, data_inicio = $4, data_fim = $5, status = $6
                 WHERE codigo = $1
                 RETURNING codigo`,
                [
                    projeto.codigo,
                    projeto.nome,
                    projeto.descricao,
                    dataParaSql(projeto.dataInicio),
                    dataParaSql(projeto.dataFim),
                    projeto.status,
                ],
            );

            if (linhas.length === 0) {
                throw new Error("Projeto não encontrado");
            }

            await conexao.consultar(
                "DELETE FROM projeto_membros WHERE projeto_codigo = $1",
                [projeto.codigo],
            );
            await this.gravarMembros(conexao, projeto);
        });

        return projeto;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar(
            "DELETE FROM projetos WHERE codigo = $1 RETURNING codigo",
            [codigo],
        );

        if (linhas.length === 0) {
            throw new Error("Projeto não encontrado");
        }
    }

    private async gravarMembros(conexao: ConexaoBanco, projeto: Projeto): Promise<void> {
        await conexao.consultar(
            `INSERT INTO projeto_membros (projeto_codigo, usuario_codigo)
             SELECT $1::uuid, unnest($2::uuid[])`,
            [projeto.codigo, projeto.membros.map((m) => m.codigo)],
        );
    }

    private async hidratar(codigos: string[]): Promise<Projeto[]> {
        const projetos = await carregarProjetos(this.conexao, codigos);
        return codigos.map((codigo) => projetos.get(codigo)!);
    }
}
