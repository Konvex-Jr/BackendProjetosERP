import { Pool } from "pg";
import { PADRAO_DIRETOR, PADRAO_GERENTE } from "../../source/shared/seguranca/catalogoPermissoes";

/*
 * Cargo de verdade no banco para os testes de integração (sessão 31a: sem perfil fixo, quem pode o quê vem do
 * cargo do período aberto). Cria a área e o cargo na primeira vez e abre o período da pessoa.
 */
type PapelBanco = "presidente" | "diretor" | "gerente";

const CARGOS: Record<PapelBanco, { nome: string; posicao: number; permissoes: readonly string[] }> = {
    presidente: { nome: "Presidente", posicao: 1, permissoes: [] },
    diretor: { nome: "Diretor de teste", posicao: 2, permissoes: PADRAO_DIRETOR },
    gerente: { nome: "Gerente de teste", posicao: 3, permissoes: PADRAO_GERENTE },
};

export async function darCargoNoBanco(pool: Pool, codigoUsuario: string, papel: PapelBanco, nomeArea = "Área de teste"): Promise<void> {
    const c = CARGOS[papel];
    const area = (
        await pool.query(
            `WITH nova AS (INSERT INTO areas (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING RETURNING codigo)
             SELECT codigo FROM nova UNION ALL SELECT codigo FROM areas WHERE nome = $1 LIMIT 1`,
            [nomeArea],
        )
    ).rows[0].codigo;
    const cargo = (
        await pool.query(
            `WITH novo AS (INSERT INTO cargos (nome, posicao) VALUES ($1, $2) ON CONFLICT (nome) DO NOTHING RETURNING codigo)
             SELECT codigo FROM novo UNION ALL SELECT codigo FROM cargos WHERE nome = $1 LIMIT 1`,
            [c.nome, c.posicao],
        )
    ).rows[0].codigo;
    await pool.query("INSERT INTO cargo_permissoes (cargo_codigo, permissao) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING", [
        cargo,
        [...c.permissoes],
    ]);
    await pool.query("INSERT INTO periodos_area (usuario_codigo, area_codigo, cargo_codigo, inicio) VALUES ($1, $2, $3, '2026-01-01')", [
        codigoUsuario,
        area,
        cargo,
    ]);
}
