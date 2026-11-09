import Anexo from "../../../domain/Entity/Anexo";
import { DonoAnexo } from "../../../domain/Enum/Anexo";
import AnexoRepositoryInterface from "../../../domain/Interfaces/AnexoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

const SELECT_ANEXO = `
    SELECT a.codigo, a.dono_tipo, a.dono_codigo, a.nome, a.tamanho_bytes, a.arquivo, a.enviado_em,
           u.codigo AS enviado_por_codigo, u.nome AS enviado_por_nome
    FROM anexos a
    LEFT JOIN usuarios u ON u.codigo = a.enviado_por
`;

function anexoDaLinha(l: any): Anexo {
    return new Anexo({
        codigo: l.codigo,
        donoTipo: l.dono_tipo,
        donoCodigo: l.dono_codigo,
        nome: l.nome,
        tamanhoBytes: Number(l.tamanho_bytes),
        arquivo: l.arquivo,
        enviadoPor: l.enviado_por_codigo ? { codigo: l.enviado_por_codigo, nome: l.enviado_por_nome } : null,
        enviadoEm: new Date(l.enviado_em),
    });
}

export default class AnexoRepositoryDatabase implements AnexoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async criar(anexo: Anexo): Promise<Anexo> {
        await this.conexao.consultar(
            `INSERT INTO anexos (codigo, dono_tipo, dono_codigo, nome, tipo_mime, tamanho_bytes, arquivo, enviado_por, enviado_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [anexo.codigo, anexo.donoTipo, anexo.donoCodigo, anexo.nome, anexo.tipoMime, anexo.tamanhoBytes,
                anexo.arquivo, anexo.enviadoPor?.codigo ?? null, anexo.enviadoEm],
        );
        return anexo;
    }

    async buscarPorCodigo(codigo: string): Promise<Anexo | null> {
        const linhas = await this.conexao.consultar(`${SELECT_ANEXO} WHERE a.codigo::text = $1`, [codigo]);
        return linhas[0] ? anexoDaLinha(linhas[0]) : null;
    }

    async listarPorDonos(tipo: DonoAnexo, codigosDonos: string[]): Promise<Anexo[]> {
        if (codigosDonos.length === 0) return [];
        const linhas = await this.conexao.consultar(
            `${SELECT_ANEXO} WHERE a.dono_tipo = $1 AND a.dono_codigo::text = ANY($2::text[]) ORDER BY a.enviado_em, a.nome`,
            [tipo, codigosDonos],
        );
        return linhas.map(anexoDaLinha);
    }

    async excluir(codigo: string): Promise<void> {
        await this.conexao.consultar("DELETE FROM anexos WHERE codigo::text = $1", [codigo]);
    }
}
