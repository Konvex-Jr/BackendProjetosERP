import { config } from "dotenv";
import { Pool } from "pg";
import { hash } from "bcrypt";
import { stringConexao } from "../infra/database/stringConexao";

config();

async function seedAdmin(): Promise<void> {
    const nome = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const senha = process.env.ADMIN_PASSWORD;

    if (!nome || !email || !senha) {
        throw new Error("Configure ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD no .env.");
    }

    if (senha.length < 6) {
        throw new Error("A senha deve possuir pelo menos 6 caracteres.");
    }

    const pool = new Pool({ connectionString: stringConexao() });

    try {
        const existente = await pool.query(
            `SELECT codigo FROM usuarios
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [email],
        );

        if (existente.rowCount && existente.rowCount > 0) {
            console.log(`O usuário ${email} já está cadastrado.`);
            return;
        }

        const senhaHash = await hash(senha, 10);

        // Sessão 31a: sem perfil fixo, o administrador inicial entra como presidente (cargo de posição 1,
        // que sempre pode tudo), num período aberto na área "Presidência".
        const cliente = await pool.connect();
        try {
            await cliente.query("BEGIN");
            const usuario = await cliente.query(
                `INSERT INTO usuarios (codigo, nome, email, senioridade_codigo, ativo, senha_hash)
                 VALUES (gen_random_uuid(), $1, $2, NULL, TRUE, $3) RETURNING codigo`,
                [nome, email, senhaHash],
            );
            const area = await cliente.query(
                `WITH nova AS (INSERT INTO areas (nome) VALUES ('Presidência') ON CONFLICT (nome) DO NOTHING RETURNING codigo)
                 SELECT codigo FROM nova UNION ALL SELECT codigo FROM areas WHERE nome = 'Presidência' LIMIT 1`,
            );
            let cargo = await cliente.query("SELECT codigo FROM cargos WHERE posicao = 1");
            if (!cargo.rowCount) {
                cargo = await cliente.query(
                    `INSERT INTO cargos (nome, posicao, lidera_area) VALUES ('Presidente', 1, TRUE)
                     ON CONFLICT (nome) DO UPDATE SET posicao = 1 RETURNING codigo`,
                );
            }
            await cliente.query(
                "INSERT INTO periodos_area (usuario_codigo, area_codigo, cargo_codigo, inicio) VALUES ($1, $2, $3, CURRENT_DATE)",
                [usuario.rows[0].codigo, area.rows[0].codigo, cargo.rows[0].codigo],
            );
            await cliente.query("COMMIT");
        } catch (erro) {
            await cliente.query("ROLLBACK");
            throw erro;
        } finally {
            cliente.release();
        }

        console.log(`Administrador ${email} criado com sucesso.`);
    } finally {
        await pool.end();
    }
}

seedAdmin().catch((erro: unknown) => {
    console.error("Erro ao criar administrador:", erro);
    process.exitCode = 1;
});
