import Usuario from "../../source/domain/entity/Usuario";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto } from "../fixtures";
import { subirServidor, tokenPara } from "./servidorTeste";

/**
 * Sessão 13 (09/11/2026): capacitações pela API. A gestão cria, edita, exclui e marca presença;
 * cada um se inscreve e cancela até o início; só quem compareceu avalia; avaliações individuais
 * com nome só para a gestão, sem nome para quem ministrou.
 */
describe("Capacitações", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let bia: Usuario;
    let caio: Usuario;
    let instrutora: Usuario;

    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const corpo = (extra: Record<string, unknown> = {}) => ({
        titulo: "Git na prática",
        data: amanha,
        hora: "18:30",
        duracaoHoras: "1,5",
        codigoInstrutor: "usr-ines",
        vagas: 2,
        tipo: "computacao",
        sala: "Lab 2",
        ...extra,
    });
    const criar = async (extra: Record<string, unknown> = {}) => {
        const r = await servidor.chamar("post", "/capacitacoes", { usuario: ctx.gerente, corpo: corpo(extra) });
        expect(r.status).toBe(200);
        return r.corpo;
    };
    const inscrever = (usuario: Usuario, codigo: string, corpoExtra?: object) =>
        servidor.chamar("post", `/capacitacoes/${codigo}/inscricoes`, { usuario, corpo: corpoExtra ?? {} });

    beforeEach(async () => {
        ctx = await criarContexto();
        const pessoa = (nome: string, codigo: string) =>
            new Usuario(nome, `${codigo}@konvex.com.br`, PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, codigo);
        bia = pessoa("Bia", "usr-bia");
        caio = pessoa("Caio", "usr-caio");
        instrutora = pessoa("Inês", "usr-ines");
        for (const u of [bia, caio, instrutora]) await ctx.factory.criarUsuarioRepository().criar(u);
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    it("só a gestão cria, edita e exclui, com mensagens que dizem o campo errado", async () => {
        expect((await servidor.chamar("post", "/capacitacoes", { usuario: bia, corpo: corpo() })).status).toBe(403);
        const opcoes = await servidor.chamar("get", "/capacitacoes/opcoes", { usuario: bia });
        expect(opcoes.corpo.podeGerir).toBe(false);
        expect(opcoes.corpo.tipos.map((t: any) => t.rotulo)).toEqual(["Computação", "Elétrica", "Mecânica"]);

        for (const [extra, codigo] of [
            [{ hora: "25:00" }, "HORA_CAPACITACAO_INVALIDA"],
            [{ data: "09/11/2026" }, "DATA_CAPACITACAO_INVALIDA"],
            [{ duracaoHoras: 0 }, "DURACAO_CAPACITACAO_INVALIDA"],
            [{ vagas: 0 }, "VAGAS_INVALIDAS"],
            [{ tipo: "culinaria" }, "TIPO_CAPACITACAO_INVALIDO"],
            [{ sala: " " }, "SALA_CAPACITACAO_OBRIGATORIA"],
        ] as const) {
            const r = await servidor.chamar("post", "/capacitacoes", { usuario: ctx.gerente, corpo: corpo(extra) });
            expect([r.status, r.corpo.codigo]).toEqual([400, codigo]);
        }

        const c = await criar({ descricao: "**Branches** e PRs" });
        expect(c).toMatchObject({
            duracaoHoras: 1.5,
            instrutor: { codigo: "usr-ines", nome: "Inês" },
            vagasRestantes: 2,
            situacao: "aberta",
            podeGerir: true,
        });
        const editada = await servidor.chamar("put", `/capacitacoes/${c.codigo}`, {
            usuario: ctx.gerente,
            corpo: { titulo: "Git avançado" },
        });
        expect(editada.corpo).toMatchObject({ titulo: "Git avançado", sala: "Lab 2", hora: "18:30" });
        expect((await servidor.chamar("put", `/capacitacoes/${c.codigo}`, { usuario: bia, corpo: { titulo: "x" } })).status).toBe(403);
        expect((await servidor.chamar("delete", `/capacitacoes/${c.codigo}`, { usuario: bia })).status).toBe(403);
        expect((await servidor.chamar("delete", `/capacitacoes/${c.codigo}`, { usuario: ctx.gerente })).status).toBe(200);
        expect((await servidor.chamar("get", `/capacitacoes/${c.codigo}`, { usuario: bia })).status).toBe(404);
    });

    it("inscreve e cancela até o início, respeita as vagas e esconde os inscritos de quem não é gestão nem instrutor", async () => {
        const c = await criar();
        const r = await inscrever(bia, c.codigo);
        expect(r.corpo).toMatchObject({ inscrito: true, totalInscritos: 1, podeCancelar: true, podeInscrever: false });
        expect(r.corpo.inscritos).toBeUndefined();
        expect((await inscrever(bia, c.codigo)).corpo.codigo).toBe("USUARIO_JA_INSCRITO");
        expect((await inscrever(caio, c.codigo)).status).toBe(200);
        const lotada = await inscrever(ctx.membro, c.codigo);
        expect([lotada.status, lotada.corpo.codigo]).toEqual([409, "CAPACITACAO_LOTADA"]);
        expect((await servidor.chamar("get", `/capacitacoes/${c.codigo}`, { usuario: ctx.membro })).corpo.situacao).toBe("lotada");

        // Instrutora e gestão veem os inscritos.
        const daInstrutora = await servidor.chamar("get", `/capacitacoes/${c.codigo}`, { usuario: instrutora });
        expect(daInstrutora.corpo.inscritos.map((i: any) => i.nome)).toEqual(["Bia", "Caio"]);

        // Membro não inscreve nem cancela outra pessoa; vagas não descem abaixo dos inscritos.
        expect((await inscrever(bia, c.codigo, { codigoUsuario: "usr-ana" })).status).toBe(403);
        expect((await servidor.chamar("delete", `/capacitacoes/${c.codigo}/inscricoes/usr-caio`, { usuario: bia })).status).toBe(403);
        const poucas = await servidor.chamar("put", `/capacitacoes/${c.codigo}`, { usuario: ctx.gerente, corpo: { vagas: 1 } });
        expect(poucas.corpo.codigo).toBe("VAGAS_MENOR_QUE_INSCRITOS");

        const cancelou = await servidor.chamar("delete", `/capacitacoes/${c.codigo}/inscricoes/usr-bia`, { usuario: bia });
        expect(cancelou.corpo).toMatchObject({ inscrito: false, totalInscritos: 1 });
        expect((await inscrever(ctx.gerente, c.codigo, { codigoUsuario: "usr-ana" })).corpo.totalInscritos).toBe(2);

        // Depois do início: nada de inscrever ou cancelar.
        const passada = await criar({ data: ontem });
        expect((await inscrever(bia, passada.codigo)).corpo.codigo).toBe("CAPACITACAO_JA_COMECOU");
    });

    it("a gestão marca presença; só quem compareceu avalia; feedback com nome só para a gestão", async () => {
        const c = await criar({ data: ontem, vagas: 5 });
        for (const u of [bia, caio]) await inscrever(ctx.gerente, c.codigo, { codigoUsuario: u.codigo });

        expect((await servidor.chamar("put", `/capacitacoes/${c.codigo}/avaliacao`, { usuario: bia, corpo: { nota: 5 } })).status).toBe(
            403,
        );
        expect(
            (await servidor.chamar("put", `/capacitacoes/${c.codigo}/presencas`, { usuario: bia, corpo: { presentes: ["usr-bia"] } }))
                .status,
        ).toBe(403);
        const fora = await servidor.chamar("put", `/capacitacoes/${c.codigo}/presencas`, {
            usuario: ctx.gerente,
            corpo: { presentes: ["usr-ana"] },
        });
        expect(fora.corpo.codigo).toBe("PRESENCA_FORA_DOS_INSCRITOS");
        const marcada = await servidor.chamar("put", `/capacitacoes/${c.codigo}/presencas`, {
            usuario: ctx.gerente,
            corpo: { presentes: ["usr-bia"] },
        });
        expect(marcada.corpo.inscritos.map((i: any) => [i.nome, i.presente])).toEqual([
            ["Bia", true],
            ["Caio", false],
        ]);

        expect((await servidor.chamar("put", `/capacitacoes/${c.codigo}/avaliacao`, { usuario: caio, corpo: { nota: 2 } })).status).toBe(
            403,
        );
        expect(
            (await servidor.chamar("put", `/capacitacoes/${c.codigo}/avaliacao`, { usuario: bia, corpo: { nota: 7 } })).corpo.codigo,
        ).toBe("NOTA_FEEDBACK_INVALIDA");
        await servidor.chamar("put", `/capacitacoes/${c.codigo}/avaliacao`, { usuario: bia, corpo: { nota: 3 } });
        const avaliou = await servidor.chamar("put", `/capacitacoes/${c.codigo}/avaliacao`, {
            usuario: bia,
            corpo: { nota: 4, bom: "Exemplos reais", melhorar: "" },
        });
        expect(avaliou.corpo).toMatchObject({
            avaliacao: { media: 4, total: 1 },
            minhaAvaliacao: { nota: 4, bom: "Exemplos reais", melhorar: null },
            podeAvaliar: true,
        });

        // Média para todos; avaliações individuais: gestão com nome, instrutora sem nome, membro não vê.
        const lista = await servidor.chamar("get", "/capacitacoes", { usuario: caio });
        expect(lista.corpo[0]).toMatchObject({ avaliacao: { media: 4, total: 1 }, podeVerAvaliacoes: false });
        expect((await servidor.chamar("get", `/capacitacoes/${c.codigo}/avaliacoes`, { usuario: caio })).status).toBe(403);
        const gestao = await servidor.chamar("get", `/capacitacoes/${c.codigo}/avaliacoes`, { usuario: ctx.gerente });
        expect(gestao.corpo[0]).toMatchObject({ usuario: { codigo: "usr-bia" }, nota: 4 });
        const daInstrutora = await servidor.chamar("get", `/capacitacoes/${c.codigo}/avaliacoes`, { usuario: instrutora });
        expect(daInstrutora.corpo).toEqual([{ nota: 4, bom: "Exemplos reais", melhorar: null }]);

        // Perfil conta as horas de quem compareceu.
        const perfil = await servidor.chamar("get", "/usuarios/usr-bia/perfil", { usuario: caio });
        expect(perfil.corpo.capacitacoes.horasCumpridas).toBe(1.5);
        expect(perfil.corpo.capacitacoes.realizadas[0]).toMatchObject({ presente: true, duracaoHoras: 1.5 });
        expect((await servidor.chamar("get", "/usuarios/usr-caio/perfil", { usuario: bia })).corpo.capacitacoes.horasCumpridas).toBe(0);
    });

    it("material: a gestão anexa, todos baixam, e excluir a capacitação apaga o arquivo", async () => {
        const c = await criar();
        // Corpo binário: fetch direto, como o frontend faz.
        const enviar = (usuario: Usuario) =>
            fetch(`${servidor.base}/capacitacoes/${c.codigo}/anexos`, {
                method: "POST",
                body: Buffer.from("%PDF-1.4 slides"),
                headers: { "access-token": tokenPara(usuario), "X-Nome-Arquivo": "slides.pdf", "Content-Type": "application/octet-stream" },
            });
        const envio = await enviar(ctx.gerente);
        expect(envio.status).toBe(200);
        const anexo = await envio.json();
        expect((await enviar(bia)).status).toBe(403);
        const ficha = await servidor.chamar("get", `/capacitacoes/${c.codigo}`, { usuario: bia });
        expect(ficha.corpo.anexos.map((a: any) => a.nome)).toEqual(["slides.pdf"]);
        expect((await servidor.chamar("get", `/anexos/${anexo.codigo}`, { usuario: bia })).status).toBe(200);
        await servidor.chamar("delete", `/capacitacoes/${c.codigo}`, { usuario: ctx.gerente });
        expect((await servidor.chamar("get", `/anexos/${anexo.codigo}`, { usuario: ctx.gerente })).status).toBe(404);
    });
});

describe("Perfil completo", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;

    beforeEach(async () => {
        ctx = await criarContexto();
        servidor = await subirServidor(ctx.factory);
    });
    afterEach(async () => servidor.fechar());

    it("a pessoa coloca calendário, GitHub e tecnologias (lista que cresce, sem duplicar) e outro membro vê", async () => {
        const ruim = await servidor.chamar("put", "/auth/perfil", { usuario: ctx.membro, corpo: { githubUrl: "github.com/ana" } });
        expect([ruim.status, ruim.corpo.message]).toEqual([400, "O link do GitHub deve começar com http:// ou https://."]);

        const r = await servidor.chamar("put", "/auth/perfil", {
            usuario: ctx.membro,
            corpo: {
                calendarioUrl: "https://calendar.google.com/ana",
                githubUrl: "https://github.com/ana",
                tecnologias: ["React", "TypeScript", "react"],
            },
        });
        expect(r.status).toBe(200);
        expect(r.corpo.habilidades.map((h: any) => [h.nome, h.tipo])).toEqual([
            ["React", "tecnologia"],
            ["TypeScript", "tecnologia"],
        ]);

        // Outro membro escolhe uma existente com outra grafia e cria uma nova.
        await servidor.chamar("put", "/auth/perfil", { usuario: ctx.gerente, corpo: { tecnologias: ["typescript", "Node.js"] } });
        const sugestoes = await servidor.chamar("get", "/habilidades?tipo=tecnologia", { usuario: ctx.membro });
        expect(sugestoes.corpo.map((h: any) => h.nome).sort()).toEqual(["Node.js", "React", "TypeScript"]);

        const visto = await servidor.chamar("get", "/usuarios/usr-ana/perfil", { usuario: ctx.gerente });
        expect(visto.corpo.usuario).toMatchObject({
            calendarioUrl: "https://calendar.google.com/ana",
            githubUrl: "https://github.com/ana",
        });
        expect(
            (await servidor.chamar("get", "/usuarios", { usuario: ctx.gerente })).corpo.find((u: any) => u.codigo === "usr-ana")
                .habilidades,
        ).toHaveLength(2);

        // Trocar as tecnologias não apaga as habilidades.
        await servidor.chamar("put", "/usuarios/usr-ana", { usuario: ctx.gerente, corpo: { habilidades: ["Liderança"] } });
        const final = await servidor.chamar("put", "/auth/perfil", { usuario: ctx.membro, corpo: { tecnologias: ["Python"] } });
        expect(final.corpo.habilidades.map((h: any) => h.nome).sort()).toEqual(["Liderança", "Python"]);
    });
});
