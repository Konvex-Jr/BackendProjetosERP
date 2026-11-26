import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import Participacao from "../../source/domain/entity/Participacao";
import StatusPessoa from "../../source/domain/enum/StatusPessoa";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";
import { Papel, comPapel } from "../papel";

/** Sessão 20 (regra da 27a): escrita em projeto sigiloso (criar, sigilo, rotas protegidas); sem lista de acesso. */
describe("Escrita em projeto sigiloso", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let diretor: Usuario;
    let criador: Usuario; // gerente que criou, fora da equipe
    let gerenteEquipe: Usuario; // gerente na equipe atual, não criador
    let gerenteFora: Usuario;
    let novo: Usuario; // membro fora do projeto

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
        const novoUsuario = async (nome: string, perfil: Papel, codigo: string, status?: StatusPessoa) => {
            const u = comPapel(
                new Usuario(nome, `${codigo}@konvex.com.br`, true, "x", ctx.senioridade, codigo, status ? { status } : {}),
                perfil,
            );
            await usuarios.criar(u);
            return u;
        };
        diretor = await novoUsuario("Dora", "diretor", "usr-dora");
        criador = await novoUsuario("Caio", "gerente", "usr-caio");
        gerenteEquipe = await novoUsuario("Gil", "gerente", "usr-gil");
        gerenteFora = await novoUsuario("Fábio", "gerente", "usr-fabio");
        novo = await novoUsuario("Nina", "membro", "usr-nina");
        await ctx.factory.criarProjetoRepository().criar(
            new Projeto("Sigiloso", "descrição", dataInicio, dataFim, undefined, [ctx.membro, gerenteEquipe], "proj-sig", {
                sigiloso: true,
                criadoPor: criador.codigo,
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
        it("gerente cria sigiloso estando na equipe; grava criadoPor; quem está na equipe vê completo", async () => {
            const r = await chamar(
                "post",
                "/projetos",
                ctx.gerente,
                corpoProjeto({ sigiloso: true, codigosMembros: [ctx.gerente.codigo, novo.codigo] }),
            );
            expect(r.status).toBe(200);
            expect(r.corpo.sigiloso).toBe(true);
            expect(r.corpo).not.toHaveProperty("acesso");
            const salvo = await ctx.factory.criarProjetoRepository().buscarPorCodigo(r.corpo.codigo);
            expect(salvo!.criadoPor).toBe(ctx.gerente.codigo);
            const visto = await chamar("get", `/projetos/${r.corpo.codigo}`, novo);
            expect(visto.status).toBe(200);
            expect(visto.corpo.cartao).toBeUndefined();
        });

        it("projeto normal segue igual (não sigiloso, sem lista de acesso)", async () => {
            const r = await chamar("post", "/projetos", ctx.gerente, corpoProjeto());
            expect(r.status).toBe(200);
            expect(r.corpo.sigiloso).toBe(false);
            expect(r.corpo).not.toHaveProperty("acesso");
        });
    });

    describe("PUT /projetos/:codigo/acesso (saiu na sessão 27a)", () => {
        it("rota inexistente: 404 no sigiloso e no normal, até para o diretor", async () => {
            expect((await chamar("put", "/projetos/proj-sig/acesso", diretor, { codigos: [] })).status).toBe(404);
            expect((await chamar("put", "/projetos/proj-nor/acesso", criador, { codigos: [] })).status).toBe(404);
        });
    });

    describe("PUT /projetos/:codigo", () => {
        it("gerente na equipe desmarca sigiloso (200) e edita o nome", async () => {
            const troca = await chamar("put", "/projetos/proj-sig", gerenteEquipe, corpoProjeto({ sigiloso: false }));
            expect(troca.status).toBe(200);
            expect(troca.corpo.sigiloso).toBe(false);
            await chamar("put", "/projetos/proj-sig", gerenteEquipe, corpoProjeto({ sigiloso: true }));
            const nome = await chamar("put", "/projetos/proj-sig", gerenteEquipe, corpoProjeto({ nome: "Novo nome" }));
            expect(nome.status).toBe(200);
            expect(nome.corpo.nome).toBe("Novo nome");
            expect(nome.corpo.sigiloso).toBe(true);
            const igual = await chamar("put", "/projetos/proj-sig", gerenteEquipe, corpoProjeto({ sigiloso: true }));
            expect(igual.status).toBe(200);
        });

        it("criador fora da equipe perdeu o acesso (403); diretor troca o sigilo", async () => {
            const r = await chamar("put", "/projetos/proj-sig", criador, corpoProjeto({ sigiloso: false }));
            expect(r.status).toBe(403);
            expect(r.corpo.codigo).toBe("PROJETO_SEM_ACESSO");
            expect((await chamar("put", "/projetos/proj-nor", diretor, corpoProjeto({ sigiloso: true }))).status).toBe(200);
        });

        it("gerente fora da equipe não marca sigiloso (400); entrando na equipe no mesmo PUT, marca", async () => {
            const barra = await chamar("put", "/projetos/proj-nor", ctx.gerente, corpoProjeto({ sigiloso: true }));
            expect(barra.status).toBe(400);
            expect(barra.corpo.codigo).toBe("SIGILOSO_SEM_VOCE");
            const marca = await chamar(
                "put",
                "/projetos/proj-nor",
                ctx.gerente,
                corpoProjeto({ sigiloso: true, codigosMembros: [ctx.membro.codigo, ctx.gerente.codigo] }),
            );
            expect(marca.status).toBe(200);
            expect(marca.corpo.sigiloso).toBe(true);
            // Saiu da equipe do sigiloso: livre, mas fica só com o cartão.
            const sai = await chamar("put", "/projetos/proj-nor", ctx.gerente, corpoProjeto({ codigosMembros: [ctx.membro.codigo] }));
            expect(sai.status).toBe(200);
            expect((await chamar("put", "/projetos/proj-nor", ctx.gerente, corpoProjeto({ sigiloso: false }))).status).toBe(403);
            const desmarca = await chamar("put", "/projetos/proj-nor", diretor, corpoProjeto({ sigiloso: false }));
            expect(desmarca.status).toBe(200);
            expect(desmarca.corpo.sigiloso).toBe(false);
        });

        it("ligar o sigilo tirando a si mesmo da equipe no mesmo PUT: 400", async () => {
            const r = await chamar(
                "put",
                "/projetos/proj-nor",
                gerenteFora,
                corpoProjeto({ sigiloso: true, codigosMembros: [ctx.membro.codigo] }),
            );
            expect(r.status).toBe(400);
            expect(r.corpo.codigo).toBe("SIGILOSO_SEM_VOCE");
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

        it("membro fora do sigiloso lê o cartão (200), sem os detalhes", async () => {
            const r = await chamar("get", "/projetos/proj-sig", novo);
            expect(r.status).toBe(200);
            expect(r.corpo.cartao).toBe(true);
        });

        it("encerrar e editar participação: gerente fora 403", async () => {
            const sig = await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-sig");
            const cod = sig!.participacoes[0].codigo;
            expect((await chamar("put", `/projetos/proj-sig/membros/${cod}`, gerenteFora, { funcao: "Dev" })).status).toBe(403);
            expect((await chamar("post", `/projetos/proj-sig/membros/${cod}/encerrar`, gerenteFora, {})).status).toBe(403);
        });
    });

    describe("equipe e sigilo", () => {
        it("gerente da equipe adiciona pessoa; ela vê completo; ao encerrar, só o cartão", async () => {
            const add = await chamar("post", "/projetos/proj-sig/membros", gerenteEquipe, { codigoUsuario: novo.codigo });
            expect(add.status).toBe(200);
            expect((await chamar("get", "/projetos/proj-sig", novo)).corpo.cartao).toBeUndefined();
            const sig = await ctx.factory.criarProjetoRepository().buscarPorCodigo("proj-sig");
            const part = sig!.participacoes.find((p: Participacao) => p.usuario.codigo === novo.codigo)!;
            const fim = await chamar("post", `/projetos/proj-sig/membros/${part.codigo}/encerrar`, gerenteEquipe, {});
            expect(fim.status).toBe(200);
            const depois = await chamar("get", "/projetos/proj-sig", novo);
            expect(depois.status).toBe(200);
            expect(depois.corpo.cartao).toBe(true);
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
    });
});
