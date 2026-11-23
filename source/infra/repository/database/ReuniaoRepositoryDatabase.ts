import Reuniao from "../../../domain/entity/Reuniao";
import ReuniaoRepositoryInterface from "../../../domain/interfaces/ReuniaoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";

const NOME = "COALESCE(NULLIF(u.nome_exibicao, ''), u.nome)";

const SELECT = `
    SELECT r.codigo, r.titulo, r.descricao, r.data, to_char(r.hora, 'HH24:MI') AS hora, r.duracao_minutos, r.local,
           r.criado_por, (SELECT ${NOME} FROM usuarios u WHERE u.codigo = r.criado_por) AS criado_por_nome,
           COALESCE((
               SELECT json_agg(json_build_object('codigo', u.codigo, 'nome', ${NOME}, 'foto', u.foto, 'email', u.email) ORDER BY ${NOME})
               FROM reuniao_participantes p JOIN usuarios u ON u.codigo = p.usuario_codigo
               WHERE p.reuniao_codigo = r.codigo
           ), '[]'::json) AS participantes
    FROM reunioes r
`;

function deLinha(l: any): Reuniao {
    return new Reuniao({
        codigo: l.codigo,
        titulo: l.titulo,
        descricao: l.descricao,
        data: l.data,
        hora: l.hora,
        duracaoMinutos: l.duracao_minutos,
        local: l.local,
        criadoPor: { codigo: l.criado_por, nome: l.criado_por_nome ?? "" },
        participantes: (l.participantes ?? []).map((p: any) => ({ codigo: p.codigo, nome: p.nome, foto: p.foto ?? null, email: p.email })),
    });
}

/** Reuniões no PostgreSQL. Buscas por código comparam como texto: código que não é UUID dá 404, não 500. */
export default class ReuniaoRepositoryDatabase implements ReuniaoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async listarDaPessoa(codigoUsuario: string, de: Date, ate: Date): Promise<Reuniao[]> {
        const linhas = await this.conexao.consultar(
            `${SELECT}
             WHERE r.data BETWEEN $2 AND $3
               AND (r.criado_por::text = $1
                    OR EXISTS (SELECT 1 FROM reuniao_participantes p WHERE p.reuniao_codigo = r.codigo AND p.usuario_codigo::text = $1))
             ORDER BY r.data, r.hora, r.titulo`,
            [codigoUsuario, dataParaSql(de), dataParaSql(ate)],
        );
        return linhas.map(deLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<Reuniao | null> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE r.codigo::text = $1`, [codigo]);
        return linhas[0] ? deLinha(linhas[0]) : null;
    }

    async criar(r: Reuniao): Promise<Reuniao> {
        await this.conexao.transacao(async (c) => {
            await c.consultar(
                `INSERT INTO reunioes (codigo, titulo, descricao, data, hora, duracao_minutos, local, criado_por)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [r.codigo, r.titulo, r.descricao, dataParaSql(r.data), r.hora, r.duracaoMinutos, r.local, r.criadoPor.codigo],
            );
            await this.gravarParticipantes(c, r);
        });
        return (await this.buscarPorCodigo(r.codigo))!;
    }

    async editar(r: Reuniao): Promise<Reuniao> {
        await this.conexao.transacao(async (c) => {
            await c.consultar(
                `UPDATE reunioes SET titulo = $2, descricao = $3, data = $4, hora = $5, duracao_minutos = $6, local = $7
                 WHERE codigo = $1`,
                [r.codigo, r.titulo, r.descricao, dataParaSql(r.data), r.hora, r.duracaoMinutos, r.local],
            );
            await c.consultar("DELETE FROM reuniao_participantes WHERE reuniao_codigo = $1", [r.codigo]);
            await this.gravarParticipantes(c, r);
        });
        return (await this.buscarPorCodigo(r.codigo))!;
    }

    async excluir(codigo: string): Promise<void> {
        await this.conexao.consultar("DELETE FROM reunioes WHERE codigo::text = $1", [codigo]);
    }

    private async gravarParticipantes(c: ConexaoBanco, r: Reuniao): Promise<void> {
        if (!r.participantes.length) return;
        await c.consultar(
            `INSERT INTO reuniao_participantes (reuniao_codigo, usuario_codigo)
             SELECT $1::uuid, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
            [r.codigo, r.participantes.map((p) => p.codigo)],
        );
    }
}
