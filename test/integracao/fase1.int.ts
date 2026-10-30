/**
 * Teste de integração da fase 1 contra PostgreSQL de verdade.
 * Uso: DATABASE_URL_TESTE=postgresql://... npm run test:integracao
 * ATENÇÃO: apaga e recria o schema "public" do banco informado. Nunca aponte para o banco da VPS.
 */
import { Pool } from "pg";
import { hash } from "bcrypt";
import { aplicarMigracoes } from "../../source/infra/database/migracoes";
import PgConexao from "../../source/infra/database/PgConexao";
import DatabaseRepositoryFactory from "../../source/infra/repository/DatabaseRepositoryFactory";
import ExpressHttp from "../../source/infra/http/ExpressHttp";
import ExpressAuth from "../../source/infra/http/Middleware/AuthExpress";
import Router from "../../source/infra/http/Router";

const URL_TESTE = process.env.DATABASE_URL_TESTE;
const descrever = URL_TESTE ? describe : describe.skip;

descrever("fase 1 contra PostgreSQL", () => {
    let pool: Pool;
    let conexao: PgConexao;
    let http: ExpressHttp;
    let base = "";

    async function chamar(metodo: string, caminho: string, token?: string, corpo?: unknown) {
        const headers: Record<string, string> = {};
        if (token) headers["access-token"] = token;
        if (corpo !== undefined) headers["Content-Type"] = "application/json";
        const r = await fetch(base + caminho, {
            method: metodo,
            headers,
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        });
        const texto = await r.text();
        return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
    }

    async function entrar(email: string, senha: string) {
        const r = await chamar("POST", "/auth/login", undefined, { email, senha });
        return r;
    }

    beforeAll(async () => {
        pool = new Pool({ connectionString: URL_TESTE });
        await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await aplicarMigracoes(pool);
        await aplicarMigracoes(pool); // rodar de novo não pode quebrar nem duplicar
        await pool.query(
            `INSERT INTO usuarios (codigo, nome, email, perfil, senioridade_codigo, ativo, senha_hash)
             VALUES (gen_random_uuid(), 'Diretora', 'diretora@teste.com', 'diretor', NULL, TRUE, $1)`,
            [await hash("SenhaDiretora1", 4)],
        );

        conexao = PgConexao.criar(URL_TESTE!);
        const factory = new DatabaseRepositoryFactory(conexao);
        http = new ExpressHttp(new ExpressAuth(factory));
        new Router(http, factory).init();
        await http.listen(0);
        base = `http://127.0.0.1:${http.porta()}`;
    }, 60000);

    afterAll(async () => {
        await http?.close();
        await conexao?.encerrar();
        await pool?.end();
    });

    test("migrações registradas uma vez só", async () => {
        const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM senioridades WHERE codigo = 'trainee'");
        expect(rows[0].n).toBe(1);
    });

    test("fluxo completo: sessão, pessoas, configurações, projetos, equipe e saída da EJ", async () => {
        // Sessão da diretora
        const login = await entrar("diretora@teste.com", "SenhaDiretora1");
        expect(login.status).toBe(200);
        const dir = login.corpo.token as string;
        expect(login.corpo.refreshToken).toBeTruthy();

        const renovado = await chamar("POST", "/auth/refresh", undefined, { refreshToken: login.corpo.refreshToken });
        expect(renovado.status).toBe(200);
        // refresh token antigo foi rotacionado
        expect((await chamar("POST", "/auth/refresh", undefined, { refreshToken: login.corpo.refreshToken })).status).toBe(401);

        const perms = await chamar("GET", "/auth/permissoes", dir);
        expect(perms.status).toBe(200);
        expect(perms.corpo.menu.map((m: any) => m.chave)).toEqual(expect.arrayContaining(["configuracoes", "usuarios", "perfil"]));

        // Configurações
        const area = await chamar("POST", "/areas", dir, { nome: "Inovação" });
        expect(area.status).toBe(200);
        const cargo = await chamar("POST", "/cargos", dir, { nome: "Assessor" });
        expect(cargo.status).toBe(200);

        // Pessoas: membro com acesso e trainee sem login
        const membro = await chamar("POST", "/usuarios", dir, {
            nome: "Membro", email: "membro@teste.com", senha: "SenhaMembro1", perfil: "membro",
            codigoSenioridade: "junior", codigoArea: area.corpo.codigo, codigoCargo: cargo.corpo.codigo,
        });
        expect(membro.status).toBe(200);
        const trainee = await chamar("POST", "/usuarios", dir, {
            nome: "Trainee", email: "trainee@teste.com", senha: "SenhaTrainee1", perfil: "membro",
            codigoSenioridade: "trainee", status: "trainee",
        });
        expect(trainee.status).toBe(200);
        expect((await entrar("trainee@teste.com", "SenhaTrainee1")).status).not.toBe(200);

        const loginMembro = await entrar("membro@teste.com", "SenhaMembro1");
        expect(loginMembro.status).toBe(200);
        const mem = loginMembro.corpo.token as string;
        expect((await chamar("POST", "/areas", mem, { nome: "X" })).status).toBe(403);
        expect((await chamar("POST", "/projetos", mem, { nome: "X" })).status).toBe(403);

        // Perfil próprio
        const perfil = await chamar("PUT", "/auth/perfil", mem, { curso: "Eng. de Software", perfil: "diretor" });
        expect(perfil.status).toBe(200);
        expect((await chamar("GET", "/auth/me", mem)).corpo.perfil).toBe("membro");

        // Projetos e equipe com alerta de alocação
        const p1 = await chamar("POST", "/projetos", dir, { nome: "Projeto A", descricao: "Teste", dataInicio: "2026-10-01", dataFim: "2026-12-31", status: "em_execucao", codigoArea: area.corpo.codigo });
        expect(p1.status).toBe(200);
        const p2 = await chamar("POST", "/projetos", dir, { nome: "Projeto B", descricao: "Teste", dataInicio: "2026-10-01", dataFim: "2026-12-31", status: "em_execucao" });
        const cod1 = p1.corpo.codigo, cod2 = p2.corpo.codigo;

        const e1 = await chamar("POST", `/projetos/${cod1}/membros`, dir, { codigoUsuario: membro.corpo.codigo, funcao: "Dev", alocacao: 70 });
        expect(e1.status).toBe(200);
        expect(e1.corpo.alocacao.excedeu).toBe(false);
        const e2 = await chamar("POST", `/projetos/${cod2}/membros`, dir, { codigoUsuario: membro.corpo.codigo, funcao: "Dev", alocacao: 50 });
        expect(e2.corpo.alocacao.total).toBe(120);
        expect(e2.corpo.alocacao.excedeu).toBe(true);
        expect((await chamar("POST", `/projetos/${cod1}/membros`, dir, { codigoUsuario: trainee.corpo.codigo, funcao: "Apoio", alocacao: 20 })).status).toBe(200);

        // Projeto fora dos status ativos não conta na alocação
        expect((await chamar("PATCH", `/projetos/${cod2}/status`, dir, { status: "concluido" })).status).toBe(200);

        // Membro vê os projetos de que participa
        const meus = await chamar("GET", `/projetos?codigoUsuario=${membro.corpo.codigo}`, mem);
        expect(meus.corpo.map((p: any) => p.nome).sort()).toEqual(["Projeto A", "Projeto B"]);

        // Saída da EJ encerra participações e preserva histórico
        const saida = await chamar("PATCH", `/usuarios/${membro.corpo.codigo}/status`, dir, { status: "alumni" });
        expect(saida.status).toBe(200);
        const projeto = await chamar("GET", `/projetos/${cod1}`, dir);
        const part = projeto.corpo.participacoes.find((x: any) => x.usuario.codigo === membro.corpo.codigo);
        expect(part.ativa).toBe(false);
        expect(part.dataSaida).toBeTruthy();
        expect((await chamar("GET", `/usuarios/${membro.corpo.codigo}/perfil`, dir)).status).toBe(200);
        expect((await entrar("membro@teste.com", "SenhaMembro1")).status).not.toBe(200);

        // Logout revoga o refresh token
        const novo = await entrar("diretora@teste.com", "SenhaDiretora1");
        expect((await chamar("POST", "/auth/logout", novo.corpo.token, { refreshToken: novo.corpo.refreshToken })).status).toBe(200);
        expect((await chamar("POST", "/auth/refresh", undefined, { refreshToken: novo.corpo.refreshToken })).status).toBe(401);
    }, 60000);
});
