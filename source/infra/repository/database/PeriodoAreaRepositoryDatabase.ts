import Area from "../../../domain/entity/Area";
import Cargo from "../../../domain/entity/Cargo";
import PeriodoArea, { erroSobreposicao } from "../../../domain/entity/PeriodoArea";
import PeriodoAreaRepositoryInterface from "../../../domain/interfaces/PeriodoAreaRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql, dataParaSqlOuNulo } from "../../database/conversoes";

const SELECT = `
    SELECT p.codigo, p.usuario_codigo, p.inicio, p.fim, p.registrado_por,
           a.codigo AS area_codigo, a.nome AS area_nome, a.area_pai_codigo, a.ativa AS area_ativa, a.tem_geral AS area_tem_geral,
           c.codigo AS cargo_codigo, c.nome AS cargo_nome, c.ativo AS cargo_ativo, c.lidera_area AS cargo_lidera_area, c.teto_semanal_horas AS cargo_teto,
           c.posicao AS cargo_posicao,
           ARRAY(SELECT cp.permissao FROM cargo_permissoes cp WHERE cp.cargo_codigo = c.codigo ORDER BY cp.permissao) AS cargo_permissoes
    FROM periodos_area p
    JOIN areas a ON a.codigo = p.area_codigo
    LEFT JOIN cargos c ON c.codigo = p.cargo_codigo
`;

/** 23P01 é "exclusion_violation": a constraint periodos_area_sem_sobreposicao (migração 017). */
function violacaoDeExclusao(erro: unknown): boolean {
    return typeof erro === "object" && erro !== null && (erro as { code?: string }).code === "23P01";
}

function paraEntidade(l: any): PeriodoArea {
    return PeriodoArea.carregar(
        l.usuario_codigo,
        new Area(l.area_nome, l.area_pai_codigo ?? null, l.area_ativa, l.area_codigo, l.area_tem_geral),
        l.cargo_codigo
            ? new Cargo(
                  l.cargo_nome,
                  l.cargo_ativo,
                  l.cargo_codigo,
                  l.cargo_lidera_area,
                  l.cargo_teto,
                  l.cargo_posicao,
                  l.cargo_permissoes ?? [],
              )
            : null,
        l.inicio,
        l.fim ?? null,
        l.registrado_por ?? null,
        l.codigo,
    );
}

export default class PeriodoAreaRepositoryDatabase implements PeriodoAreaRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async listarDe(codigoUsuario: string): Promise<PeriodoArea[]> {
        const linhas = await this.conexao.consultar(
            `${SELECT} WHERE p.usuario_codigo = $1 ORDER BY (p.fim IS NULL) DESC, p.inicio DESC, a.nome`,
            [codigoUsuario],
        );
        return linhas.map(paraEntidade);
    }

    async listarAbertosDe(codigosUsuario: string[]): Promise<PeriodoArea[]> {
        if (codigosUsuario.length === 0) return [];
        const linhas = await this.conexao.consultar(
            `${SELECT} WHERE p.usuario_codigo = ANY($1::uuid[]) AND p.fim IS NULL ORDER BY p.inicio, a.nome`,
            [[...new Set(codigosUsuario)]],
        );
        return linhas.map(paraEntidade);
    }

    async listarDasAreas(codigosArea: string[]): Promise<PeriodoArea[]> {
        if (codigosArea.length === 0) return [];
        const linhas = await this.conexao.consultar(`${SELECT} WHERE p.area_codigo = ANY($1::uuid[]) ORDER BY p.inicio, p.codigo`, [
            [...new Set(codigosArea)],
        ]);
        return linhas.map(paraEntidade);
    }

    async listarAbertosQueLideram(): Promise<PeriodoArea[]> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE p.fim IS NULL AND c.lidera_area ORDER BY p.inicio, p.codigo`);
        return linhas.map(paraEntidade);
    }

    async buscarPorCodigo(codigo: string): Promise<PeriodoArea | null> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE p.codigo = $1`, [codigo]);
        return linhas.length ? paraEntidade(linhas[0]) : null;
    }

    async criar(periodo: PeriodoArea): Promise<PeriodoArea> {
        await this.gravar(
            periodo,
            `INSERT INTO periodos_area (codigo, usuario_codigo, area_codigo, cargo_codigo, inicio, fim, registrado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING codigo`,
            [periodo.codigoRegistradoPor],
        );
        return periodo;
    }

    async editar(periodo: PeriodoArea): Promise<PeriodoArea> {
        const linhas = await this.gravar(
            periodo,
            `UPDATE periodos_area SET usuario_codigo = $2, area_codigo = $3, cargo_codigo = $4, inicio = $5, fim = $6
             WHERE codigo = $1 RETURNING codigo`,
            [],
        );
        if (linhas.length === 0) throw new ErroNaoEncontrado("Período não encontrado.");
        return periodo;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar("DELETE FROM periodos_area WHERE codigo = $1 RETURNING codigo", [codigo]);
        if (linhas.length === 0) throw new ErroNaoEncontrado("Período não encontrado.");
    }

    async encerrarAbertosDe(codigoUsuario: string, fim: Date): Promise<number> {
        // GREATEST: encerrar no dia do início deixaria o período vazio (e o CHECK recusaria).
        const linhas = await this.conexao.consultar(
            `UPDATE periodos_area SET fim = GREATEST($2::date, inicio + 1)
             WHERE usuario_codigo = $1 AND fim IS NULL
             RETURNING codigo`,
            [codigoUsuario, dataParaSql(fim)],
        );
        return linhas.length;
    }

    /**
     * Grava e traduz a constraint de exclusão em 400 legível. Ela é a rede de segurança para
     * gravações simultâneas: o caso de uso confere antes, mas duas requisições podem passar juntas.
     */
    private async gravar(periodo: PeriodoArea, sql: string, extras: unknown[]): Promise<any[]> {
        try {
            return await this.conexao.consultar(sql, [
                periodo.codigo,
                periodo.codigoUsuario,
                periodo.area.codigo,
                periodo.cargo?.codigo ?? null,
                dataParaSql(periodo.inicio),
                dataParaSqlOuNulo(periodo.fim),
                ...extras,
            ]);
        } catch (erro) {
            if (violacaoDeExclusao(erro)) throw erroSobreposicao(await this.conflitoCom(periodo));
            throw erro;
        }
    }

    /** O período que bloqueou a gravação, para a mensagem citar as datas. */
    private async conflitoCom(periodo: PeriodoArea): Promise<PeriodoArea | null> {
        const linhas = await this.conexao.consultar(
            `${SELECT}
             WHERE p.usuario_codigo = $1 AND p.area_codigo = $2 AND p.codigo <> $3
               AND daterange(p.inicio, p.fim, '[)') && daterange($4::date, $5::date, '[)')
             ORDER BY p.inicio LIMIT 1`,
            [periodo.codigoUsuario, periodo.area.codigo, periodo.codigo, dataParaSql(periodo.inicio), dataParaSqlOuNulo(periodo.fim)],
        );
        return linhas.length ? paraEntidade(linhas[0]) : null;
    }
}
