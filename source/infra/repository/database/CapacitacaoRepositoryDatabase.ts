import Capacitacao from "../../../domain/Entity/Capacitacao";
import CapacitacaoRepositoryInterface from "../../../domain/Interfaces/CapacitacaoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";
import { carregarCapacitacoes } from "./carregadores";

export default class CapacitacaoRepositoryDatabase implements CapacitacaoRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(capacitacao: Capacitacao): Promise<Capacitacao> {
        await this.conexao.transacao(async (conexao) => {
            await conexao.consultar(
                `INSERT INTO capacitacoes (codigo, titulo, data, hora, instrutor_codigo, vagas, tipo, sala)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    capacitacao.codigo,
                    capacitacao.titulo,
                    dataParaSql(capacitacao.data),
                    capacitacao.hora,
                    capacitacao.instrutor.codigo,
                    capacitacao.vagas,
                    capacitacao.tipo,
                    capacitacao.sala,
                ],
            );
            await this.gravarInscritos(conexao, capacitacao);
        });

        return capacitacao;
    }

    async listar(): Promise<Capacitacao[]> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo FROM capacitacoes ORDER BY data, hora",
        );
        return this.hidratar(linhas.map((l) => l.codigo));
    }

    async buscarPorCodigo(codigo: string): Promise<Capacitacao | null> {
        const capacitacoes = await carregarCapacitacoes(this.conexao, [codigo]);
        return capacitacoes.get(codigo) ?? null;
    }

    async editar(capacitacao: Capacitacao): Promise<Capacitacao> {
        await this.conexao.transacao(async (conexao) => {
            const linhas = await conexao.consultar(
                `UPDATE capacitacoes
                 SET titulo = $2, data = $3, hora = $4, instrutor_codigo = $5,
                     vagas = $6, tipo = $7, sala = $8
                 WHERE codigo = $1
                 RETURNING codigo`,
                [
                    capacitacao.codigo,
                    capacitacao.titulo,
                    dataParaSql(capacitacao.data),
                    capacitacao.hora,
                    capacitacao.instrutor.codigo,
                    capacitacao.vagas,
                    capacitacao.tipo,
                    capacitacao.sala,
                ],
            );

            if (linhas.length === 0) {
                throw new Error("Capacitação não encontrada");
            }

            await conexao.consultar(
                "DELETE FROM capacitacao_inscricoes WHERE capacitacao_codigo = $1",
                [capacitacao.codigo],
            );
            await this.gravarInscritos(conexao, capacitacao);
        });

        return capacitacao;
    }

    private async gravarInscritos(
        conexao: ConexaoBanco,
        capacitacao: Capacitacao,
    ): Promise<void> {
        await conexao.consultar(
            `INSERT INTO capacitacao_inscricoes (capacitacao_codigo, usuario_codigo)
             SELECT $1::uuid, t.usuario
             FROM unnest($2::uuid[]) WITH ORDINALITY AS t(usuario, ordem)
             ORDER BY t.ordem`,
            [capacitacao.codigo, capacitacao.inscritos.map((i) => i.codigo)],
        );
    }

    private async hidratar(codigos: string[]): Promise<Capacitacao[]> {
        const capacitacoes = await carregarCapacitacoes(this.conexao, codigos);
        return codigos.map((codigo) => capacitacoes.get(codigo)!);
    }
}
