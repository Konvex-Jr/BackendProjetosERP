import Checkin from "../../../domain/Entity/Checkin";
import CheckinRepositoryInterface from "../../../domain/Interfaces/CheckinRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql, violacaoDeUnicidade } from "../../database/conversoes";
import { carregarUsuarios } from "./carregadores";

const SELECT_CHECKIN = `
    SELECT codigo, usuario_codigo, semana, humor, resumo, aprendizados, sentimento
    FROM checkins
`;

export default class CheckinRepositoryDatabase implements CheckinRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(checkin: Checkin): Promise<Checkin> {
        try {
            await this.conexao.consultar(
                `INSERT INTO checkins
                    (codigo, usuario_codigo, semana, humor, resumo, aprendizados, sentimento)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    checkin.codigo,
                    checkin.usuario.codigo,
                    dataParaSql(checkin.semana),
                    checkin.humor,
                    checkin.resumo,
                    checkin.aprendizados,
                    checkin.sentimento,
                ],
            );
        } catch (erro) {
            if (violacaoDeUnicidade(erro)) {
                throw new Error("Já existe check-in deste usuário para a semana");
            }
            throw erro;
        }

        return checkin;
    }

    async editar(checkin: Checkin): Promise<Checkin> {
        const linhas = await this.conexao.consultar(
            `UPDATE checkins
             SET humor = $2, resumo = $3, aprendizados = $4, sentimento = $5
             WHERE codigo = $1
             RETURNING codigo`,
            [
                checkin.codigo,
                checkin.humor,
                checkin.resumo,
                checkin.aprendizados,
                checkin.sentimento,
            ],
        );

        if (linhas.length === 0) {
            throw new Error("Check-in não encontrado");
        }

        return checkin;
    }

    async listar(): Promise<Checkin[]> {
        const linhas = await this.conexao.consultar(`${SELECT_CHECKIN} ORDER BY semana DESC`);
        return this.hidratar(linhas);
    }

    async listarPorUsuario(codigoUsuario: string): Promise<Checkin[]> {
        const linhas = await this.conexao.consultar(
            `${SELECT_CHECKIN} WHERE usuario_codigo = $1 ORDER BY semana DESC`,
            [codigoUsuario],
        );
        return this.hidratar(linhas);
    }

    async buscarPorUsuarioESemana(
        codigoUsuario: string,
        semana: Date,
    ): Promise<Checkin | null> {
        const linhas = await this.conexao.consultar(
            `${SELECT_CHECKIN} WHERE usuario_codigo = $1 AND semana = $2`,
            [codigoUsuario, dataParaSql(semana)],
        );
        const checkins = await this.hidratar(linhas);
        return checkins[0] ?? null;
    }

    private async hidratar(linhas: any[]): Promise<Checkin[]> {
        const usuarios = await carregarUsuarios(
            this.conexao,
            linhas.map((l) => l.usuario_codigo),
        );

        return linhas.map(
            (l) =>
                new Checkin(
                    usuarios.get(l.usuario_codigo)!,
                    l.semana,
                    l.resumo,
                    l.aprendizados,
                    l.humor,
                    l.sentimento,
                    l.codigo,
                ),
        );
    }
}
