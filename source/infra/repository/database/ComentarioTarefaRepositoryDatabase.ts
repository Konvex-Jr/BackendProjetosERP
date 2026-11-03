import ComentarioTarefa from "../../../domain/Entity/ComentarioTarefa";
import ComentarioTarefaRepositoryInterface from "../../../domain/Interfaces/ComentarioTarefaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { carregarUsuarios } from "./carregadores";

export default class ComentarioTarefaRepositoryDatabase implements ComentarioTarefaRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async criar(comentario: ComentarioTarefa): Promise<ComentarioTarefa> {
        await this.conexao.consultar(
            `INSERT INTO tarefa_comentarios (codigo, tarefa_codigo, autor_codigo, texto, criado_em)
             VALUES ($1, $2, $3, $4, $5)`,
            [comentario.codigo, comentario.codigoTarefa, comentario.autor.codigo, comentario.texto, comentario.criadoEm],
        );
        return comentario;
    }

    async listarPorTarefa(codigoTarefa: string): Promise<ComentarioTarefa[]> {
        const linhas = await this.conexao.consultar(
            `SELECT codigo, tarefa_codigo, autor_codigo, texto, criado_em
             FROM tarefa_comentarios WHERE tarefa_codigo = $1 ORDER BY criado_em, codigo`,
            [codigoTarefa],
        );
        return this.montar(linhas);
    }

    async buscarPorCodigo(codigo: string): Promise<ComentarioTarefa | null> {
        const linhas = await this.conexao.consultar(
            `SELECT codigo, tarefa_codigo, autor_codigo, texto, criado_em
             FROM tarefa_comentarios WHERE codigo = $1`,
            [codigo],
        );
        return (await this.montar(linhas))[0] ?? null;
    }

    async excluir(codigo: string): Promise<void> {
        await this.conexao.consultar("DELETE FROM tarefa_comentarios WHERE codigo = $1", [codigo]);
    }

    private async montar(linhas: any[]): Promise<ComentarioTarefa[]> {
        const usuarios = await carregarUsuarios(this.conexao, linhas.map((l) => l.autor_codigo));
        return linhas.map((l) => new ComentarioTarefa(l.tarefa_codigo, usuarios.get(l.autor_codigo)!, l.texto, new Date(l.criado_em), l.codigo));
    }
}
