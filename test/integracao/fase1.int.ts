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
    test("sessão 9: pastas com sigilo e documentos como link no banco", async () => {
        const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
        const pessoa = await chamar("POST", "/usuarios", dir, {
            nome: "Leitora", email: "leitora@teste.com", senha: "SenhaLeitora1", perfil: "membro", codigoSenioridade: "junior",
        });
        expect(pessoa.status).toBe(200);
        const proj = await chamar("POST", "/projetos", dir, { nome: "Projeto Docs", descricao: "d", dataInicio: "2026-11-01", dataFim: "2026-12-01" });
        expect(proj.status).toBe(200);
        const publica = await chamar("POST", "/pastas", dir, { nome: "Modelos" });
        const restrita = await chamar("POST", "/pastas", dir, { nome: "Financeiro", sigilo: "gestao" });
        const doProjeto = await chamar("POST", "/pastas", dir, { nome: "Entregas", sigilo: "projeto", codigoProjeto: proj.corpo.codigo });
        expect(doProjeto.status).toBe(200);
        expect(doProjeto.corpo.projeto.nome).toBe("Projeto Docs");
        const doc = await chamar("POST", `/pastas/${restrita.corpo.codigo}/documentos`, dir, { nome: "Balanço", arquivoUrl: "https://drive.google.com/b" });
        expect(doc.status).toBe(200);
        expect(doc.corpo.pasta.sigilo).toBe("gestao");

        const leitora = (await entrar("leitora@teste.com", "SenhaLeitora1")).corpo.token as string;
        const visiveis = (await chamar("GET", "/pastas", leitora)).corpo.map((p: any) => p.codigo);
        expect(visiveis).toContain(publica.corpo.codigo);
        expect(visiveis).not.toContain(restrita.corpo.codigo);
        expect(visiveis).not.toContain(doProjeto.corpo.codigo);
        expect((await chamar("GET", `/pastas/${restrita.corpo.codigo}/documentos`, leitora)).status).toBe(404);

        await chamar("POST", `/projetos/${proj.corpo.codigo}/membros`, dir, { codigoUsuario: pessoa.corpo.codigo, funcao: "Dev", alocacao: 10, dataEntrada: "2026-11-01" });
        expect((await chamar("GET", "/pastas", leitora)).corpo.map((p: any) => p.codigo)).toContain(doProjeto.corpo.codigo);

        // O banco também barra pasta de projeto sem projeto.
        await expect(pool.query(
            "INSERT INTO pastas (codigo, nome, sigilo) VALUES (gen_random_uuid(), 'x', 'projeto')",
        )).rejects.toThrow(/pastas_projeto_conforme_sigilo/);
        // Excluir o projeto leva a pasta dele junto.
        expect((await chamar("DELETE", `/projetos/${proj.corpo.codigo}`, dir)).status).toBeLessThan(300);
        expect((await chamar("GET", "/pastas", dir)).corpo.map((p: any) => p.codigo)).not.toContain(doProjeto.corpo.codigo);
    }, 60000);

    test("sessão 12a: Base de Inteligência com busca, filtros e projetos no banco", async () => {
        const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
        const pessoa = await chamar("POST", "/usuarios", dir, {
            nome: "Autora", email: "autora@teste.com", senha: "SenhaAutora1", perfil: "membro", codigoSenioridade: "junior",
        });
        expect(pessoa.status).toBe(200);
        const autora = (await entrar("autora@teste.com", "SenhaAutora1")).corpo.token as string;
        const proj = await chamar("POST", "/projetos", dir, { nome: "Projeto Base", descricao: "d", dataInicio: "2026-11-01", dataFim: "2026-12-01" });

        const item = await chamar("POST", "/conhecimento", autora, {
            titulo: "Pesquisa 100% de mercado", categoria: "pesquisa", resumo: "Concorrentes",
            conteudo: "**iFood** domina", tags: ["Delivery"], links: ["https://exemplo.com"],
            codigosProjetos: [proj.corpo.codigo], data: "2026-10-20",
        });
        expect(item.status).toBe(200);
        expect(item.corpo.autor.nome).toBe("Autora");
        expect(item.corpo.data).toBe("2026-10-20T00:00:00.000Z"); // DATE sem deslocar pelo fuso
        expect(item.corpo.projetos).toEqual([{ codigo: proj.corpo.codigo, nome: "Projeto Base" }]);
        await chamar("POST", "/conhecimento", dir, { titulo: "Decisão de stack", categoria: "decisao", resumo: "React", data: "2026-01-05" });

        const titulos = async (q: string) => (await chamar("GET", `/conhecimento${q}`, dir)).corpo.map((i: any) => i.titulo);
        expect(await titulos("")).toEqual(["Pesquisa 100% de mercado", "Decisão de stack"]);
        expect(await titulos("?busca=IFOOD")).toEqual(["Pesquisa 100% de mercado"]);
        expect(await titulos("?busca=100%25")).toEqual(["Pesquisa 100% de mercado"]);
        expect(await titulos("?busca=_")).toEqual([]);
        expect(await titulos("?tag=delivery")).toEqual(["Pesquisa 100% de mercado"]);
        expect(await titulos(`?codigoProjeto=${proj.corpo.codigo}`)).toEqual(["Pesquisa 100% de mercado"]);
        expect(await titulos(`?codigoAutor=${pessoa.corpo.codigo}`)).toEqual(["Pesquisa 100% de mercado"]);
        expect(await titulos("?categoria=decisao&de=2026-01-01&ate=2026-01-31")).toEqual(["Decisão de stack"]);
        expect(await titulos("?codigoProjeto=nao-e-uuid")).toEqual([]);
        expect((await chamar("GET", "/conhecimento/nao-e-uuid", dir)).status).toBe(404);

        // Autor edita (troca os projetos); a diretora exclui; excluir o projeto não apaga o item.
        const editado = await chamar("PUT", `/conhecimento/${item.corpo.codigo}`, autora, { ...item.corpo, codigosProjetos: [] });
        expect(editado.status).toBe(200);
        expect(editado.corpo.projetos).toEqual([]);
        expect(new Date(editado.corpo.atualizadoEm).getTime()).toBeGreaterThanOrEqual(new Date(item.corpo.criadoEm).getTime());
        await chamar("PUT", `/conhecimento/${item.corpo.codigo}`, autora, { ...item.corpo, codigosProjetos: [proj.corpo.codigo] });
        expect((await chamar("DELETE", `/projetos/${proj.corpo.codigo}`, dir)).status).toBeLessThan(300);
        const depois = await chamar("GET", `/conhecimento/${item.corpo.codigo}`, autora);
        expect(depois.corpo.projetos).toEqual([]);
        expect((await chamar("DELETE", `/conhecimento/${item.corpo.codigo}`, dir)).status).toBe(200);
        expect((await chamar("GET", `/conhecimento/${item.corpo.codigo}`, dir)).status).toBe(404);
    }, 60000);
    test("sessão 12b: iniciativas com projetos, itens da Base e tarefas de Inovação no banco", async () => {
        const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
        // A área "Inovação" foi criada no teste da fase 1, acima.
        const area = { corpo: (await chamar("GET", "/areas", dir)).corpo.find((a: any) => a.nome === "Inovação") };
        expect(area.corpo).toBeTruthy();
        const inov = await chamar("POST", "/usuarios", dir, {
            nome: "Inovadora", email: "inov@teste.com", senha: "SenhaInov1", perfil: "membro", codigoSenioridade: "junior", codigoArea: area.corpo.codigo,
        });
        expect(inov.status).toBe(200);
        await chamar("POST", "/usuarios", dir, { nome: "Comum", email: "comum@teste.com", senha: "SenhaComum1", perfil: "membro", codigoSenioridade: "junior" });
        const tokenInov = (await entrar("inov@teste.com", "SenhaInov1")).corpo.token as string;
        const tokenComum = (await entrar("comum@teste.com", "SenhaComum1")).corpo.token as string;

        expect((await chamar("GET", "/iniciativas/opcoes", tokenInov)).corpo.podeCriar).toBe(true);
        expect((await chamar("GET", "/iniciativas/opcoes", tokenComum)).corpo.podeCriar).toBe(false);
        expect((await chamar("POST", "/iniciativas", tokenComum, { titulo: "X", tipo: "produto", frente: "lab" })).status).toBe(403);

        const proj = await chamar("POST", "/projetos", dir, { nome: "Projeto Inov", descricao: "d", dataInicio: "2026-11-01", dataFim: "2026-12-01" });
        const k1 = await chamar("POST", "/conhecimento", tokenComum, { titulo: "Pesquisa A", categoria: "pesquisa", resumo: "r" });
        const k2 = await chamar("POST", "/conhecimento", tokenComum, { titulo: "Pesquisa B", categoria: "pesquisa", resumo: "r" });

        const ini = await chamar("POST", "/iniciativas", tokenInov, {
            titulo: "Chatbot 100%", tipo: "servico", frente: "radar", status: "andamento",
            dataInicio: "2026-11-03", dataFim: "2026-12-20", descricao: "**IA** no atendimento",
            codigosProjetos: [proj.corpo.codigo], codigosConhecimentos: [k1.corpo.codigo, k2.corpo.codigo],
        });
        expect(ini.status).toBe(200);
        expect(ini.corpo.dataInicio).toBe("2026-11-03T00:00:00.000Z"); // DATE sem deslocar pelo fuso
        expect(ini.corpo.dataFim).toBe("2026-12-20T00:00:00.000Z");
        expect(ini.corpo.responsavel.nome).toBe("Inovadora");
        expect(ini.corpo.criadoPor.nome).toBe("Inovadora");
        expect(ini.corpo.projetos).toEqual([{ codigo: proj.corpo.codigo, nome: "Projeto Inov" }]);
        expect(ini.corpo.conhecimentos.map((c: any) => c.nome)).toEqual(["Pesquisa A", "Pesquisa B"]);
        expect((await chamar("GET", `/conhecimento/${k1.corpo.codigo}`, tokenComum)).corpo.iniciativas)
            .toEqual([{ codigo: ini.corpo.codigo, nome: "Chatbot 100%" }]);

        const tarefa = await chamar("POST", "/tarefas", dir, {
            categoria: "inovacao", titulo: "Protótipo", dataInicio: "2026-11-03", dataFim: "2026-11-10", prioridade: "P2",
            codigosResponsaveis: [inov.corpo.codigo], codigoIniciativa: ini.corpo.codigo,
        });
        expect(tarefa.status).toBe(200);
        expect(tarefa.corpo.iniciativa).toEqual({ codigo: ini.corpo.codigo, nome: "Chatbot 100%" });
        const ficha = await chamar("GET", `/iniciativas/${ini.corpo.codigo}`, tokenInov);
        expect(ficha.corpo.tarefas.map((t: any) => t.titulo)).toEqual(["Protótipo"]);
        expect((await chamar("GET", `/iniciativas/${ini.corpo.codigo}`, tokenComum)).corpo.tarefas).toEqual([]);

        const titulos = async (q: string) => (await chamar("GET", `/iniciativas${q}`, dir)).corpo.map((i: any) => i.titulo);
        expect(await titulos("?busca=100%25")).toEqual(["Chatbot 100%"]);
        expect(await titulos("?busca=_")).toEqual([]);
        expect(await titulos(`?codigoProjeto=${proj.corpo.codigo}&status=andamento&frente=radar`)).toEqual(["Chatbot 100%"]);
        expect(await titulos(`?codigoConhecimento=${k2.corpo.codigo}`)).toEqual(["Chatbot 100%"]);
        expect(await titulos("?codigoResponsavel=nao-e-uuid")).toEqual([]);
        expect((await chamar("GET", "/iniciativas/nao-e-uuid", dir)).status).toBe(404);

        // Renomear aparece na tarefa; outro membro não edita; excluir deixa a tarefa e o item sem a ligação.
        const corpo = { ...ini.corpo, titulo: "Chatbot", codigosProjetos: [], codigosConhecimentos: [k1.corpo.codigo] };
        expect((await chamar("PUT", `/iniciativas/${ini.corpo.codigo}`, tokenComum, corpo)).status).toBe(403);
        const editada = await chamar("PUT", `/iniciativas/${ini.corpo.codigo}`, tokenInov, corpo);
        expect(editada.status).toBe(200);
        expect(editada.corpo.projetos).toEqual([]);
        expect(editada.corpo.conhecimentos).toHaveLength(1);
        const daTarefa = async () => (await chamar("GET", "/tarefas?categoria=inovacao", dir)).corpo.find((t: any) => t.codigo === tarefa.corpo.codigo);
        expect((await daTarefa()).iniciativa.nome).toBe("Chatbot");
        expect((await chamar("DELETE", `/iniciativas/${ini.corpo.codigo}`, dir)).status).toBe(200);
        expect((await daTarefa()).iniciativa).toBeNull();
        expect((await chamar("GET", `/conhecimento/${k1.corpo.codigo}`, dir)).corpo.iniciativas).toEqual([]);
    }, 60000);
});
