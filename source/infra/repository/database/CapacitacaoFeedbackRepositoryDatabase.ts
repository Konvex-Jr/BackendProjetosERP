import CapacitacaoFeedback from "../../../domain/Entity/CapacitacaoFeedback";
import CapacitacaoFeedbackRepositoryInterface, { ResumoAvaliacao } from "../../../domain/Interfaces/CapacitacaoFeedbackRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";

const SELECT = `
    SELECT f.codigo, f.capacitacao_codigo, f.usuario_codigo, COALESCE(NULLIF(u.nome_exibicao, ''), u.nome) AS usuario_nome,
           f.nota, f.bom, f.melhorar, f.data
    FROM capacitacao_feedbacks f JOIN usuarios u ON u.codigo = f.usuario_codigo
`;

const deLinha = (l: any) => new CapacitacaoFeedback({
    codigo: l.codigo,
    codigoCapacitacao: l.capacitacao_codigo,
    usuario: { codigo: l.usuario_codigo, nome: l.usuario_nome },
    nota: l.nota,
    bom: l.bom,
    melhorar: l.melhorar,
    data: l.data,
});

export default class CapacitacaoFeedbackRepositoryDatabase implements CapacitacaoFeedbackRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async salvar(f: CapacitacaoFeedback): Promise<CapacitacaoFeedback> {
        await this.conexao.consultar(
            `INSERT INTO capacitacao_feedbacks (codigo, capacitacao_codigo, usuario_codigo, nota, bom, melhorar, data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (capacitacao_codigo, usuario_codigo)
             DO UPDATE SET nota = EXCLUDED.nota, bom = EXCLUDED.bom, melhorar = EXCLUDED.melhorar, data = EXCLUDED.data`,
            [f.codigo, f.codigoCapacitacao, f.usuario.codigo, f.nota, f.bom, f.melhorar, dataParaSql(f.data)],
        );
        return (await this.buscarPorCapacitacaoEUsuario(f.codigoCapacitacao, f.usuario.codigo))!;
    }

    async listarPorCapacitacao(codigo: string): Promise<CapacitacaoFeedback[]> {
        return (await this.conexao.consultar(`${SELECT} WHERE f.capacitacao_codigo::text = $1 ORDER BY f.data DESC, f.codigo`, [codigo])).map(deLinha);
    }

    async buscarPorCapacitacaoEUsuario(codigo: string, codigoUsuario: string): Promise<CapacitacaoFeedback | null> {
        const linhas = await this.conexao.consultar(
            `${SELECT} WHERE f.capacitacao_codigo::text = $1 AND f.usuario_codigo::text = $2`, [codigo, codigoUsuario]);
        return linhas[0] ? deLinha(linhas[0]) : null;
    }

    async resumos(codigos: string[]): Promise<Map<string, ResumoAvaliacao>> {
        const mapa = new Map<string, ResumoAvaliacao>(codigos.map((c) => [c, { media: null, total: 0 }]));
        if (codigos.length === 0) return mapa;
        const linhas = await this.conexao.consultar(
            `SELECT capacitacao_codigo::text AS codigo, count(*)::int AS total, round(avg(nota)::numeric, 1) AS media
             FROM capacitacao_feedbacks WHERE capacitacao_codigo::text = ANY($1::text[]) GROUP BY capacitacao_codigo`,
            [codigos],
        );
        for (const l of linhas) mapa.set(l.codigo, { total: l.total, media: l.media === null ? null : Number(l.media) });
        return mapa;
    }
}
