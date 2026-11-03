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

    test("sessão 8b: líder, concluída por e comentários gravados no banco", async () => {
        const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
        const lider = await chamar("POST", "/usuarios", dir, {
            nome: "Lider", email: "lider@teste.com", senha: "SenhaLider1", perfil: "membro", codigoSenioridade: "junior",
        });
        const p = await chamar("POST", "/projetos", dir, { nome: "Projeto C", descricao: "Teste", dataInicio: "2026-10-01", dataFim: "2026-12-31", status: "em_execucao" });
        const cod = p.corpo.codigo;
        await chamar("POST", `/projetos/${cod}/membros`, dir, { codigoUsuario: lider.corpo.codigo, funcao: "Dev", alocacao: 10 });
        const definido = await chamar("PUT", `/projetos/${cod}/lider`, dir, { codigoUsuario: lider.corpo.codigo });
        expect(definido.status).toBe(200);
        expect((await chamar("GET", `/projetos/${cod}`, dir)).corpo.lider.codigo).toBe(lider.corpo.codigo);

        const lid = (await entrar("lider@teste.com", "SenhaLider1")).corpo.token as string;
        const t = await chamar("POST", "/tarefas", lid, { codigoProjeto: cod, titulo: "T1", dataInicio: "2026-10-02", dataFim: "2026-10-05", prioridade: "P2", codigosResponsaveis: [lider.corpo.codigo] });
        expect(t.status).toBe(200);
        const concluida = await chamar("PATCH", `/tarefas/${t.corpo.codigo}/status`, lid, { status: "concluida" });
        expect(concluida.status).toBe(200);
        const lida = (await chamar("GET", `/tarefas?codigoProjeto=${cod}`, dir)).corpo[0];
        expect(lida.concluidaPor.codigo).toBe(lider.corpo.codigo);

        const c = await chamar("POST", `/tarefas/${t.corpo.codigo}/comentarios`, lid, { texto: "Feito" });
        expect(c.status).toBe(200);
        const lista = await chamar("GET", `/tarefas/${t.corpo.codigo}/comentarios`, dir);
        expect(lista.corpo.map((x: any) => x.texto)).toEqual(["Feito"]);
        expect((await chamar("DELETE", `/tarefas/${t.corpo.codigo}/comentarios/${c.corpo.codigo}`, dir)).status).toBe(200);
        // Excluir a tarefa leva os comentários junto
        await chamar("POST", `/tarefas/${t.corpo.codigo}/comentarios`, lid, { texto: "Outro" });
        expect((await chamar("DELETE", `/tarefas/${t.corpo.codigo}`, lid)).status).toBeLessThan(300);
    }, 60000);
    test("sessão 8c: tarefa avulsa gravada no banco, com categoria e quem criou", async () => {
        const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
        const pessoa = await chamar("POST", "/usuarios", dir, {
            nome: "Assessor", email: "assessor@teste.com", senha: "SenhaAssessor1", perfil: "membro", codigoSenioridade: "junior",
        });
        const t = await chamar("POST", "/tarefas", dir, {
            categoria: "inovacao", titulo: "Pesquisa", dataInicio: "2026-11-02", dataFim: "2026-11-06", prioridade: "P2",
            codigosResponsaveis: [pessoa.corpo.codigo],
        });
        expect(t.status).toBe(200);
        const ass = (await entrar("assessor@teste.com", "SenhaAssessor1")).corpo.token as string;
        const minhas = (await chamar("GET", "/tarefas?minhas=true", ass)).corpo;
        expect(minhas).toHaveLength(1);
        expect(minhas[0].projeto).toBeNull();
        expect(minhas[0].categoria).toBe("inovacao");
        expect(minhas[0].criadaPor.nome).toBeTruthy();
        expect((await chamar("PATCH", `/tarefas/${t.corpo.codigo}/status`, ass, { status: "concluida" })).status).toBe(200);
        const editada = await chamar("PUT", `/tarefas/${t.corpo.codigo}`, dir, {
            categoria: "execucao", titulo: "Pesquisa", dataInicio: "2026-11-02", dataFim: "2026-11-06", prioridade: "P1",
            status: "concluida", codigosResponsaveis: [pessoa.corpo.codigo],
        });
        expect(editada.status).toBe(200);
        expect((await chamar("GET", "/tarefas?categoria=execucao", dir)).corpo.map((x: any) => x.codigo)).toEqual([t.corpo.codigo]);
        // O banco também barra tarefa sem projeto e sem categoria.
        await expect(pool.query(
            "INSERT INTO tarefas (codigo, titulo, data_inicio, data_fim) VALUES (gen_random_uuid(), 'x', '2026-11-02', '2026-11-03')",
        )).rejects.toThrow(/tarefas_projeto_ou_categoria/);
        expect((await chamar("DELETE", `/tarefas/${t.corpo.codigo}`, dir)).status).toBeLessThan(300);
    }, 60000);
});
