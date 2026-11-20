import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import Participacao from "../../source/domain/entity/Participacao";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 20: escrita em projeto sigiloso (criar, lista de acesso, rotas protegidas). */
describe("Escrita em projeto sigiloso", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let criador: Usuario; // gerente que criou
    let gerenteLista: Usuario; // gerente na lista, não criador
    let gerenteFora: Usuario;
    let novo: Usuario; // membro fora do projeto
    let alumni: Usuario;

    const corpoProjeto = (extra: object = {}) => ({
        nome: "Projeto Aurora",
        descricao: "descrição",
        dataInicio,
        dataFim,
        ...extra,
    });

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        const novoUsuario = async (nome: string, perfil: PerfilUsuario, codigo: string, status?: StatusPessoa) => {
            const u = new Usuario(nome, `${codigo}@konvex.com.br`, perfil, true, "x", ctx.senioridade, codigo, status ? { status } : {});
            await usuarios.criar(u);
            return u;
        };
        diretor = await novoUsuario("Dora", PerfilUsuario.DIRETOR, "usr-dora");
        criador = await novoUsuario("Caio", PerfilUsuario.GERENTE, "usr-caio");
        gerenteLista = await novoUsuario("Gil", PerfilUsuario.GERENTE, "usr-gil");
        gerenteFora = await novoUsuario("Fábio", PerfilUsuario.GERENTE, "usr-fabio");
        novo = await novoUsuario("Nina", PerfilUsuario.MEMBRO, "usr-nina");
        alumni = await novoUsuario("Alê", PerfilUsuario.MEMBRO, "usr-ale", StatusPessoa.INATIVO);
        await ctx.factory.criarProjetoRepository().criar(
            new Projeto("Sigiloso", "descrição", dataInicio, dataFim, undefined, [ctx.membro], "proj-sig", {
                sigiloso: true,
                criadoPor: criador.codigo,
                acesso: [gerenteLista.codigo],
            }),
        );
        await ctx.factory
            .criarProjetoRepository()
            .criar(
                new Projeto("Normal", "descrição", dataInicio, dataFim, undefined, [ctx.membro], "proj-nor", { criadoPor: criador.codigo }),
            );
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const chamar = (metodo: string, caminho: string, usuario: Usuario, corpo?: unknown) =>
        servidor.chamar(metodo, caminho, { usuario, corpo });

    describe("POST /projetos", () => {
        it("gerente cria sigiloso com lista; grava criadoPor; membro da lista vê completo", async () => {
            const r = await chamar("post", "/projetos", ctx.gerente, corpoProjeto({ sigiloso: true, acesso: [novo.codigo] }));
            expect(r.status).toBe(200);
            expect(r.corpo.sigiloso).toBe(true);
            expect(r.corpo.acesso).toEqual([novo.codigo]);
            const salvo = await ctx.factory.criarProjetoRepository().buscarPorCodigo(r.corpo.codigo);
            expect(salvo!.criadoPor).toBe(ctx.gerente.codigo);
            const visto = await chamar("get", `/projetos/${r.corpo.codigo}`, novo);
            expect(visto.status).toBe(200);
            expect(visto.corpo.resumo).toBeUndefined();
        });

        it("pessoa sem login ou código desconhecido na lista: 400 ACESSO_PESSOA_SEM_LOGIN", async () => {
            const a = await chamar("post", "/projetos", ctx.gerente, corpoProjeto({ sigiloso: true, acesso: [alumni.codigo] }));
            expect(a.status).toBe(400);
            expect(a.corpo.codigo ?? a.corpo.code).toBe("ACESSO_PESSOA_SEM_LOGIN");
            expect(JSON.stringify(a.corpo)).toContain(alumni.codigo);
            const b = await chamar("post", "/projetos", ctx.gerente, corpoProjeto({ sigiloso: true, acesso: ["usr-nao-existe"] }));
            expect(b.status).toBe(400);
            expect(JSON.stringify(b.corpo)).toContain("usr-nao-existe");
        });

        it("projeto normal segue igual (não sigiloso, lista vazia)", async () => {
            const r = await chamar("post", "/projetos", ctx.gerente, corpoProjeto());
            expect(r.status).toBe(200);
            expect(r.corpo.sigiloso).toBe(false);
            expect(r.corpo.acesso).toEqual([]);
        });
    });

    describe("PUT /projetos/:codigo/acesso", () => {
        const corpo = (...codigos: string[]) => ({ codigos });

        it("diretor e criador definem; repetidos ignorados", async () => {
            const a = await chamar("put", "/projetos/proj-sig/acesso", diretor, corpo(novo.codigo, novo.codigo));
            expect(a.status).toBe(200);
            expect(a.corpo.acesso).toEqual([novo.codigo]);
            const b = await chamar("put", "/projetos/proj-sig/acesso", criador, corpo(gerenteLista.codigo));
            expect(b.status).toBe(200);
            const salvo = await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-sig");
            expect(salvo!.acesso).toEqual([gerenteLista.codigo]);
        });

        it("gerente na lista ou fora: 403; membro fora: 404", async () => {
            expect((await chamar("put", "/projetos/proj-sig/acesso", gerenteLista, corpo())).status).toBe(403);
            expect((await chamar("put", "/projetos/proj-sig/acesso", gerenteFora, corpo())).status).toBe(403);
            expect((await chamar("put", "/projetos/proj-sig/acesso", novo, corpo())).status).toBe(404);
        });

        it("Alumni ou código desconhecido: 400 ACESSO_PESSOA_SEM_LOGIN", async () => {
            const r = await chamar("put", "/projetos/proj-sig/acesso", diretor, corpo(alumni.codigo));
            expect(r.status).toBe(400);
            expect(r.corpo.codigo ?? r.corpo.code).toBe("ACESSO_PESSOA_SEM_LOGIN");
            expect((await chamar("put", "/projetos/proj-sig/acesso", diretor, corpo("usr-x"))).status).toBe(400);
        });

        it("corpo sem lista: 400; projeto inexistente: 404", async () => {
            expect((await chamar("put", "/projetos/proj-sig/acesso", diretor, {})).status).toBe(400);
            expect((await chamar("put", "/projetos/nao-existe/acesso", diretor, corpo())).status).toBe(404);
        });
    });

    describe("PUT /projetos/:codigo", () => {
        it("gerente na lista desmarca sigiloso (200) e edita o nome", async () => {
            const troca = await chamar("put", "/projetos/proj-sig", gerenteLista, corpoProjeto({ sigiloso: false }));
            expect(troca.status).toBe(200);
            expect(troca.corpo.sigiloso).toBe(false);
            await chamar("put", "/projetos/proj-sig", gerenteLista, corpoProjeto({ sigiloso: true }));
            const nome = await chamar("put", "/projetos/proj-sig", gerenteLista, corpoProjeto({ nome: "Novo nome" }));
            expect(nome.status).toBe(200);
            expect(nome.corpo.nome).toBe("Novo nome");
            expect(nome.corpo.sigiloso).toBe(true);
            const igual = await chamar("put", "/projetos/proj-sig", gerenteLista, corpoProjeto({ sigiloso: true }));
            expect(igual.status).toBe(200);
        });

        it("criador e diretor trocam o sigilo", async () => {
            expect((await chamar("put", "/projetos/proj-sig", criador, corpoProjeto({ sigiloso: false }))).status).toBe(200);
            expect((await chamar("put", "/projetos/proj-nor", diretor, corpoProjeto({ sigiloso: true }))).status).toBe(200);
        });

        it("gerente que não criou marca sigiloso (200)", async () => {
            const marca = await chamar("put", "/projetos/proj-nor", ctx.gerente, corpoProjeto({ sigiloso: true }));
            expect(marca.status).toBe(200);
            expect(marca.corpo.sigiloso).toBe(true);
            // fora da equipe, agora só vê o resumo: desmarcar cabe a quem tem acesso completo
            expect((await chamar("put", "/projetos/proj-nor", ctx.gerente, corpoProjeto({ sigiloso: false }))).status).toBe(403);
            const desmarca = await chamar("put", "/projetos/proj-nor", diretor, corpoProjeto({ sigiloso: false }));
            expect(desmarca.status).toBe(200);
            expect(desmarca.corpo.sigiloso).toBe(false);
        });

        it("membro sem projetos.editar não muda o sigilo (403)", async () => {
            const r = await chamar("put", "/projetos/proj-nor", novo, corpoProjeto({ sigiloso: true }));
            expect(r.status).toBe(403);
        });
    });

    describe("rotas de escrita para gerente fora", () => {
        it("PUT, PATCH status, POST membros, PUT lider: 403; diretor exclui", async () => {
            expect((await chamar("put", "/projetos/proj-sig", gerenteFora, corpoProjeto())).status).toBe(403);
            expect((await chamar("patch", "/projetos/proj-sig/status", gerenteFora, { status: "concluido" })).status).toBe(403);
            expect((await chamar("post", "/projetos/proj-sig/membros", gerenteFora, { codigoUsuario: novo.codigo })).status).toBe(403);
            expect((await chamar("put", "/projetos/proj-sig/lider", gerenteFora, { codigoUsuario: null })).status).toBe(403);
            expect((await chamar("delete", "/projetos/proj-sig", diretor)).status).toBe(200);
        });

        it("membro fora do sigiloso recebe 404 nas rotas protegidas por permissão", async () => {
            expect((await chamar("get", "/projetos/proj-sig", novo)).status).toBe(404);
        });

        it("encerrar e editar participação: gerente fora 403", async () => {
            const sig = await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-sig");
            const cod = sig!.participacoes[0].codigo;
            expect((await chamar("put", `/projetos/proj-sig/membros/${cod}`, gerenteFora, { funcao: "Dev" })).status).toBe(403);
            expect((await chamar("post", `/projetos/proj-sig/membros/${cod}/encerrar`, gerenteFora, {})).status).toBe(403);
        });
    });

    describe("equipe e acesso", () => {
        it("gerente da lista adiciona pessoa; ela vê completo; ao encerrar, 404", async () => {
            const add = await chamar("post", "/projetos/proj-sig/membros", gerenteLista, { codigoUsuario: novo.codigo });
            expect(add.status).toBe(200);
            expect((await chamar("get", "/projetos/proj-sig", novo)).status).toBe(200);
            const sig = await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-sig");
            const part = sig!.participacoes.find((p: Participacao) => p.usuario.codigo === novo.codigo)!;
            const fim = await chamar("post", `/projetos/proj-sig/membros/${part.codigo}/encerrar`, gerenteLista, {});
            expect(fim.status).toBe(200);
            expect((await chamar("get", "/projetos/proj-sig", novo)).status).toBe(404);
        });
    });

    describe("projeto normal", () => {
        it("gerente qualquer segue editando, mudando status, equipe e líder; membro fora segue 403", async () => {
            expect((await chamar("put", "/projetos/proj-nor", gerenteFora, corpoProjeto())).status).toBe(200);
            expect((await chamar("patch", "/projetos/proj-nor/status", gerenteFora, { status: "concluido" })).status).toBe(200);
            expect((await chamar("post", "/projetos/proj-nor/membros", gerenteFora, { codigoUsuario: novo.codigo })).status).toBe(200);
            expect((await chamar("put", "/projetos/proj-nor/lider", gerenteFora, { codigoUsuario: novo.codigo })).status).toBe(200);
            expect((await chamar("put", "/projetos/proj-nor", ctx.membro, corpoProjeto())).status).toBe(403);
        });

        it("PUT /acesso em projeto normal: criador 200, outro gerente 403", async () => {
            expect((await chamar("put", "/projetos/proj-nor/acesso", criador, { codigos: [] })).status).toBe(200);
            expect((await chamar("put", "/projetos/proj-nor/acesso", gerenteFora, { codigos: [] })).status).toBe(403);
        });
    });
});
