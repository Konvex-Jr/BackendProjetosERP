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
import ExpressAuth from "../../source/infra/http/middleware/AuthExpress";
import Router from "../../source/infra/http/Router";
import { mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

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

    /** Cadastra sem senha (como a API faz) e grava a senha direto no banco, para o teste poder entrar. */
    async function criarPessoa(token: string, { senha, ...dados }: Record<string, unknown> & { senha: string; email: string }) {
        const r = await chamar("POST", "/usuarios", token, dados);
        await pool.query("UPDATE usuarios SET senha_hash = $1 WHERE email = $2", [await hash(senha, 4), dados.email]);
        return r;
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
        expect(perms.corpo.menu.map((m: any) => m.chave)).toEqual(expect.arrayContaining(["configuracoes", "usuarios"]));
        // "Meu perfil" abre pelo avatar do topo (sessão 22), fora do menu.
        expect(perms.corpo.menu.map((m: any) => m.chave)).not.toContain("perfil");

        // Configurações
        const area = await chamar("POST", "/areas", dir, { nome: "Inovação" });
        expect(area.status).toBe(200);
        const cargo = await chamar("POST", "/cargos", dir, { nome: "Assessor" });
        expect(cargo.status).toBe(200);

        // Pessoas: membro e trainee, os dois com login
        const membro = await criarPessoa(dir, {
            nome: "Membro",
            email: "membro@teste.com",
            senha: "SenhaMembro@1",
            perfil: "membro",
            codigoSenioridade: "junior",
            codigoArea: area.corpo.codigo,
            codigoCargo: cargo.corpo.codigo,
        });
        expect(membro.status).toBe(200);
        const trainee = await criarPessoa(dir, {
            nome: "Trainee",
            email: "trainee@teste.com",
            senha: "SenhaTrainee@1",
            perfil: "membro",
            codigoSenioridade: "trainee",
            status: "trainee",
        });
        expect(trainee.status).toBe(200);
        expect((await entrar("trainee@teste.com", "SenhaTrainee@1")).status).toBe(200);

        const loginMembro = await entrar("membro@teste.com", "SenhaMembro@1");
        expect(loginMembro.status).toBe(200);
        const mem = loginMembro.corpo.token as string;
        expect((await chamar("POST", "/areas", mem, { nome: "X" })).status).toBe(403);
        expect((await chamar("POST", "/projetos", mem, { nome: "X" })).status).toBe(403);

        // Perfil próprio
        const perfil = await chamar("PUT", "/auth/perfil", mem, { curso: "Engenharia Elétrica", perfil: "diretor" });
        expect(perfil.status).toBe(200);
        expect((await chamar("GET", "/auth/me", mem)).corpo.perfil).toBe("membro");

        // Projetos e equipe (a alocação manual saiu na 24a: o corpo ignora `alocacao` e não devolve)
        const p1 = await chamar("POST", "/projetos", dir, {
            nome: "Projeto A",
            descricao: "Teste",
            dataInicio: "2026-10-01",
            dataFim: "2026-12-31",
            status: "em_execucao",
            codigoArea: area.corpo.codigo,
        });
        expect(p1.status).toBe(200);
        const p2 = await chamar("POST", "/projetos", dir, {
            nome: "Projeto B",
            descricao: "Teste",
            dataInicio: "2026-10-01",
            dataFim: "2026-12-31",
            status: "em_execucao",
        });
        const cod1 = p1.corpo.codigo,
            cod2 = p2.corpo.codigo;

        const e1 = await chamar("POST", `/projetos/${cod1}/membros`, dir, {
            codigoUsuario: membro.corpo.codigo,
            funcao: "Dev",
            alocacao: 70,
        });
        expect(e1.status).toBe(200);
        expect(e1.corpo.alocacao).toBeUndefined();
        expect(e1.corpo.projeto.participacoes.every((x: any) => x.alocacao === undefined)).toBe(true);
        const e2 = await chamar("POST", `/projetos/${cod2}/membros`, dir, {
            codigoUsuario: membro.corpo.codigo,
            funcao: "Dev",
            alocacao: 50,
        });
        expect(e2.status).toBe(200);
        expect(
            (await chamar("POST", `/projetos/${cod1}/membros`, dir, { codigoUsuario: trainee.corpo.codigo, funcao: "Apoio", alocacao: 20 }))
                .status,
        ).toBe(200);

        // Mudar a situação do projeto
        expect((await chamar("PATCH", `/projetos/${cod2}/status`, dir, { status: "concluido" })).status).toBe(200);

        // Membro vê os projetos de que participa
        const meus = await chamar("GET", `/projetos?codigoUsuario=${membro.corpo.codigo}`, mem);
        expect(meus.corpo.map((p: any) => p.nome).sort()).toEqual(["Projeto A", "Projeto B"]);

        // Saída da EJ encerra participações e preserva histórico
        const saida = await chamar("PATCH", `/usuarios/${membro.corpo.codigo}/status`, dir, { status: "inativo" });
        expect(saida.status).toBe(200);
        const projeto = await chamar("GET", `/projetos/${cod1}`, dir);
        const part = projeto.corpo.participacoes.find((x: any) => x.usuario.codigo === membro.corpo.codigo);
        expect(part.ativa).toBe(false);
        expect(part.dataSaida).toBeTruthy();
        expect((await chamar("GET", `/usuarios/${membro.corpo.codigo}/perfil`, dir)).status).toBe(200);
        expect((await entrar("membro@teste.com", "SenhaMembro@1")).status).not.toBe(200);

        // Logout revoga o refresh token
        const novo = await entrar("diretora@teste.com", "SenhaDiretora1");
        expect((await chamar("POST", "/auth/logout", novo.corpo.token, { refreshToken: novo.corpo.refreshToken })).status).toBe(200);
        expect((await chamar("POST", "/auth/refresh", undefined, { refreshToken: novo.corpo.refreshToken })).status).toBe(401);
    }, 60000);

    test("sessão 8b: líder, concluída por e comentários gravados no banco", async () => {
        const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
        const lider = await criarPessoa(dir, {
            nome: "Lider",
            email: "lider@teste.com",
            senha: "SenhaLider@1",
            perfil: "membro",
            codigoSenioridade: "junior",
        });
        const p = await chamar("POST", "/projetos", dir, {
            nome: "Projeto C",
            descricao: "Teste",
            dataInicio: "2026-10-01",
            dataFim: "2026-12-31",
            status: "em_execucao",
        });
        const cod = p.corpo.codigo;
        await chamar("POST", `/projetos/${cod}/membros`, dir, { codigoUsuario: lider.corpo.codigo, funcao: "Dev", alocacao: 10 });
        const definido = await chamar("PUT", `/projetos/${cod}/lider`, dir, { codigoUsuario: lider.corpo.codigo });
        expect(definido.status).toBe(200);
        expect((await chamar("GET", `/projetos/${cod}`, dir)).corpo.lider.codigo).toBe(lider.corpo.codigo);

        const lid = (await entrar("lider@teste.com", "SenhaLider@1")).corpo.token as string;
        const t = await chamar("POST", "/tarefas", lid, {
            codigoProjeto: cod,
            titulo: "T1",
            dataInicio: "2026-10-02",
            dataFim: "2026-10-05",
            prioridade: "P2",
            codigosResponsaveis: [lider.corpo.codigo],
        });
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
    test("sessão 12c/17: anexos da Biblioteca gravados no banco e no disco, com sigilo do item", async () => {
        const pasta = mkdtempSync(path.join(tmpdir(), "anexos-"));
        process.env.ANEXOS_DIR = pasta;
        try {
            const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
            await criarPessoa(dir, {
                nome: "Anexadora",
                email: "anexadora@teste.com",
                senha: "SenhaAnexa@1",
                perfil: "membro",
                codigoSenioridade: "junior",
            });
            const membro = (await entrar("anexadora@teste.com", "SenhaAnexa@1")).corpo.token as string;
            const enviar = async (token: string, caminho: string, nome: string, bytes = Buffer.from("%PDF-1.4 teste")) => {
                const r = await fetch(base + caminho, {
                    method: "POST",
                    headers: {
                        "access-token": token,
                        "Content-Type": "application/octet-stream",
                        "X-Nome-Arquivo": encodeURIComponent(nome),
                    },
                    body: new Uint8Array(bytes),
                });
                return { status: r.status, corpo: await r.json() };
            };
            const baixar = async (token: string, codigo: string) => {
                const r = await fetch(`${base}/anexos/${codigo}`, { headers: { "access-token": token } });
                return { status: r.status, texto: await r.text() };
            };

            // Sessão 17: o dono é um item da Biblioteca (o CHECK de anexos aceita 'biblioteca' no banco).
            const item = await chamar("POST", "/biblioteca", membro, { titulo: "Estudo" });
            const anexo = await enviar(membro, `/biblioteca/${item.corpo.codigo}/anexos`, "Estudo ação.pdf");
            expect(anexo.status).toBe(200);
            expect(anexo.corpo.enviadoPor.nome).toBe("Anexadora");
            expect(readdirSync(pasta)).toHaveLength(1);
            expect((await chamar("GET", `/biblioteca/${item.corpo.codigo}`, dir)).corpo.anexos[0].nome).toBe("Estudo ação.pdf");
            expect(await baixar(dir, anexo.corpo.codigo)).toEqual({ status: 200, texto: "%PDF-1.4 teste" });
            expect((await baixar(dir, "nao-e-uuid")).status).toBe(404);

            const restrito = await chamar("POST", "/biblioteca", dir, { titulo: "Contratos", sigilo: "gestao" });
            const doc = await enviar(dir, `/biblioteca/${restrito.corpo.codigo}/anexos`, "contrato.pdf");
            expect(doc.status).toBe(200);
            expect((await pool.query("SELECT dono_tipo FROM anexos WHERE codigo = $1", [doc.corpo.codigo])).rows[0].dono_tipo).toBe(
                "biblioteca",
            );
            expect((await baixar(membro, doc.corpo.codigo)).status).toBe(404);
            expect((await baixar(dir, doc.corpo.codigo)).status).toBe(200);

            expect((await chamar("DELETE", `/biblioteca/${restrito.corpo.codigo}`, dir)).status).toBe(204);
            expect((await chamar("DELETE", `/biblioteca/${item.corpo.codigo}`, membro)).status).toBe(204);
            expect(readdirSync(pasta)).toHaveLength(0);
            expect((await pool.query("SELECT count(*)::int AS n FROM anexos")).rows[0].n).toBe(0);
        } finally {
            delete process.env.ANEXOS_DIR;
            rmSync(pasta, { recursive: true, force: true });
        }
    }, 60000);
    test("sessão 13: capacitações com presença, avaliações e perfil completo no banco", async () => {
        const dir = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo.token as string;
        const pessoa = async (nome: string, email: string) => {
            const r = await criarPessoa(dir, {
                nome,
                email,
                senha: "SenhaCap@123",
                perfil: "membro",
                codigoSenioridade: "junior",
            });
            return { codigo: r.corpo.codigo as string, token: (await entrar(email, "SenhaCap@123")).corpo.token as string };
        };
        const ines = await pessoa("Inês Instrutora", "ines@teste.com");
        const bia = await pessoa("Bia Cap", "bia.cap@teste.com");
        const caio = await pessoa("Caio Cap", "caio.cap@teste.com");
        const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        const corpo = {
            titulo: "Git",
            data: amanha,
            hora: "18:30",
            duracaoHoras: 2.5,
            codigoInstrutor: ines.codigo,
            vagas: 1,
            tipo: "computacao",
            sala: "Lab",
        };

        const futura = await chamar("POST", "/capacitacoes", dir, corpo);
        expect(futura.status).toBe(200);
        expect(futura.corpo).toMatchObject({ data: amanha, hora: "18:30", duracaoHoras: 2.5, instrutor: { nome: "Inês Instrutora" } });
        expect((await chamar("POST", `/capacitacoes/${futura.corpo.codigo}/inscricoes`, bia.token, {})).status).toBe(200);
        const lotada = await chamar("POST", `/capacitacoes/${futura.corpo.codigo}/inscricoes`, caio.token, {});
        expect(lotada.corpo.codigo).toBe("CAPACITACAO_LOTADA");
        expect(
            (await chamar("DELETE", `/capacitacoes/${futura.corpo.codigo}/inscricoes/${bia.codigo}`, bia.token)).corpo.totalInscritos,
        ).toBe(0);

        const passada = await chamar("POST", "/capacitacoes", dir, { ...corpo, data: ontem, vagas: 5 });
        const cod = passada.corpo.codigo;
        for (const p of [bia, caio]) await chamar("POST", `/capacitacoes/${cod}/inscricoes`, dir, { codigoUsuario: p.codigo });
        const presenca = await chamar("PUT", `/capacitacoes/${cod}/presencas`, dir, { presentes: [bia.codigo] });
        expect(presenca.corpo.inscritos.map((i: any) => [i.nome, i.presente])).toEqual([
            ["Bia Cap", true],
            ["Caio Cap", false],
        ]);
        await chamar("PUT", `/capacitacoes/${cod}/avaliacao`, bia.token, { nota: 3 });
        const avaliou = await chamar("PUT", `/capacitacoes/${cod}/avaliacao`, bia.token, { nota: 5, bom: "Prático" });
        expect(avaliou.corpo.avaliacao).toEqual({ media: 5, total: 1 });
        expect((await chamar("GET", `/capacitacoes/${cod}/avaliacoes`, ines.token)).corpo).toEqual([
            { nota: 5, bom: "Prático", melhorar: null },
        ]);
        expect((await chamar("GET", `/capacitacoes/${cod}/avaliacoes`, dir)).corpo[0].usuario.nome).toBe("Bia Cap");
        expect((await chamar("GET", `/usuarios/${bia.codigo}/perfil`, caio.token)).corpo.capacitacoes.horasCumpridas).toBe(2.5);

        // Perfil completo.
        const perfil = await chamar("PUT", "/auth/perfil", bia.token, {
            calendarioUrl: "https://cal.com/bia",
            githubUrl: "https://github.com/bia",
        });
        expect(perfil.status).toBe(200);
        const visto = (await chamar("GET", `/usuarios/${bia.codigo}/perfil`, caio.token)).corpo.usuario;
        expect(visto).toMatchObject({ calendarioUrl: "https://cal.com/bia", githubUrl: "https://github.com/bia" });
        expect((await chamar("DELETE", `/capacitacoes/${cod}`, dir)).status).toBe(200);
        expect((await pool.query("SELECT count(*)::int AS n FROM capacitacao_feedbacks")).rows[0].n).toBe(0);
    }, 60000);

    test("correções de 13/11: vagas com inscrições simultâneas e código fora do formato UUID", async () => {
        const login = (await entrar("diretora@teste.com", "SenhaDiretora1")).corpo;
        const dir = login.token as string;
        const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        const cap = await chamar("POST", "/capacitacoes", dir, {
            titulo: "Corrida",
            data: amanha,
            hora: "10:00",
            duracaoHoras: 1,
            vagas: 2,
            tipo: "computacao",
            codigoInstrutor: login.usuario.codigo,
            sala: "Lab",
        });
        expect([cap.status, cap.corpo.message]).toEqual([200, undefined]);
        const pessoas = (
            await pool.query(
                `INSERT INTO usuarios (codigo, nome, email, perfil, senioridade_codigo, ativo, senha_hash)
                 SELECT gen_random_uuid(), 'Corredor ' || n, 'corredor' || n || '@teste.com', 'membro', 'junior', TRUE, 'x'
                 FROM generate_series(1, 8) n RETURNING codigo, nome`,
            )
        ).rows;
        const repo = new DatabaseRepositoryFactory(conexao).criarCapacitacaoRepository();
        const resultados = await Promise.all(pessoas.map((p) => repo.inscrever(cap.corpo.codigo, p)));
        expect(resultados.filter(Boolean)).toHaveLength(2);
        const total = await pool.query("SELECT count(*)::int AS n FROM capacitacao_inscricoes WHERE capacitacao_codigo = $1", [
            cap.corpo.codigo,
        ]);
        expect(total.rows[0].n).toBe(2);

        // Checklist volta na ordem em que foi gravado.
        const textos = ["Primeiro", "Segundo", "Terceiro", "Quarto", "Quinto", "Sexto"];
        const projChecklist = await chamar("POST", "/projetos", dir, {
            nome: "Projeto checklist",
            descricao: "Teste",
            dataInicio: "2026-11-01",
            dataFim: "2026-12-31",
            status: "em_execucao",
        });
        const dadosTarefa = {
            codigoProjeto: projChecklist.corpo.codigo,
            titulo: "Ordem do checklist",
            dataInicio: "2026-11-13",
            dataFim: "2026-11-20",
            prioridade: "P2",
        };
        const tarefa = await chamar("POST", "/tarefas", dir, dadosTarefa);
        const comChecklist = await chamar("PUT", `/tarefas/${tarefa.corpo.codigo}`, dir, {
            ...dadosTarefa,
            status: "pendente",
            checklist: textos.map((texto) => ({ texto, feito: false })),
        });
        expect([comChecklist.status, comChecklist.corpo.message]).toEqual([200, undefined]);
        await pool.query("UPDATE tarefa_checklist_itens SET feito = feito WHERE texto IN ('Primeiro', 'Terceiro')"); // muda a ordem física
        const lida = (await chamar("GET", "/tarefas", dir)).corpo.find((x: any) => x.codigo === tarefa.corpo.codigo);
        expect(lida.checklist.map((i: any) => i.texto)).toEqual(textos);

        // Contagem de tarefas por projeto (progresso igual para membro e gestão).
        const proj = await chamar("POST", "/projetos", dir, {
            nome: "Projeto contagem",
            descricao: "Teste",
            dataInicio: "2026-11-01",
            dataFim: "2026-12-31",
            status: "em_execucao",
        });
        for (const titulo of ["Uma", "Outra"]) {
            const t = await chamar("POST", "/tarefas", dir, {
                ...dadosTarefa,
                titulo,
                codigoProjeto: proj.corpo.codigo,
            });
            expect([t.status, t.corpo.message]).toEqual([200, undefined]);
            if (titulo === "Uma") await chamar("PATCH", `/tarefas/${t.corpo.codigo}/status`, dir, { status: "concluida" });
        }
        const projetos = (await chamar("GET", "/projetos", dir)).corpo;
        const porProjeto = await pool.query(
            "SELECT projeto_codigo::text AS p, count(*)::int AS n, count(*) FILTER (WHERE status = 'concluida')::int AS c FROM tarefas WHERE projeto_codigo IS NOT NULL GROUP BY 1",
        );
        expect(porProjeto.rows.find((l: any) => l.p === proj.corpo.codigo)).toMatchObject({ n: 2, c: 1 });
        for (const linha of porProjeto.rows) {
            expect(projetos.find((x: any) => x.codigo === linha.p)?.tarefas).toMatchObject({ total: linha.n, concluidas: linha.c });
        }

        for (const caminho of [
            "/tarefas/nao-e-uuid/comentarios",
            "/biblioteca/nao-e-uuid",
            "/usuarios/nao-e-uuid",
            "/projetos/nao-e-uuid",
        ]) {
            expect([caminho, (await chamar("GET", caminho, dir)).status]).toEqual([caminho, 404]);
        }
    }, 60000);
});
