import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import RetomarSessao from "../source/useCases/auth/RetomarSessao";
import RenovarSessao from "../source/useCases/auth/RenovarSessao";
import EncerrarSessao from "../source/useCases/auth/EncerrarSessao";
import LoginUsuario from "../source/useCases/auth/LoginUsuario";
import { DIAS_LEMBRETE, emitirLembrete, emitirSessao, hashToken } from "../source/useCases/auth/emitirSessao";
import { ErroNaoAutorizado } from "../source/shared/erros/ErroNaoAutorizado";
import { cadastrarComSenha, criarContexto } from "./fixtures";

const SENHA = "Senha@forte1";

describe("RetomarSessao e lembrete", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let ana: Awaited<ReturnType<typeof cadastrarComSenha>>;

    beforeEach(async () => {
        ctx = await criarContexto();
        ana = await cadastrarComSenha(
            ctx.factory,
            { nome: "Ana Dev", email: "ana@dev.konvex", perfil: PerfilUsuario.MEMBRO, senioridade: ctx.senioridade },
            SENHA,
        );
    });

    const repo = () => ctx.factory.criarRefreshTokenRepository();

    it("emitirLembrete grava lembrar=true com 15 dias", async () => {
        const antes = Date.now();
        const { token, expiraEm } = await emitirLembrete(ctx.factory, ana);
        expect(DIAS_LEMBRETE).toBe(15);
        expect(Math.abs(expiraEm.getTime() - (antes + 15 * 24 * 60 * 60 * 1000))).toBeLessThan(5000);
        const registro = await repo().buscarPorHash(hashToken(token));
        expect(registro).toMatchObject({ lembrar: true, codigoUsuario: ana.codigo });
    });

    it("gira o lembrete com o mesmo prazo e emite sessão de aba", async () => {
        const inicial = await emitirLembrete(ctx.factory, ana);
        const r = await new RetomarSessao(ctx.factory).execute(inicial.token);
        expect(r.lembrete.expiraEm.getTime()).toBe(inicial.expiraEm.getTime());
        expect(r.lembrete.token).not.toBe(inicial.token);
        expect((await repo().buscarPorHash(hashToken(inicial.token)))?.revogadoEm).toBeTruthy();
        expect((await repo().buscarPorHash(hashToken(r.sessao.refreshToken)))?.lembrar).toBe(false);
        expect(r.sessao.usuario.codigo).toBe(ana.codigo);
    });

    it("sem token, token de aba ou desconhecido: ErroNaoAutorizado", async () => {
        const aba = await emitirSessao(ctx.factory, ana);
        for (const token of [undefined, "", "nao-existe", aba.refreshToken]) {
            await expect(new RetomarSessao(ctx.factory).execute(token)).rejects.toBeInstanceOf(ErroNaoAutorizado);
        }
        // O token de aba não foi revogado por isso.
        expect((await repo().buscarPorHash(hashToken(aba.refreshToken)))?.revogadoEm).toBeNull();
    });

    it("lembrete revogado reapresentado revoga todas as sessões", async () => {
        const inicial = await emitirLembrete(ctx.factory, ana);
        const aba = await emitirSessao(ctx.factory, ana);
        await new RetomarSessao(ctx.factory).execute(inicial.token);
        await expect(new RetomarSessao(ctx.factory).execute(inicial.token)).rejects.toBeInstanceOf(ErroNaoAutorizado);
        expect((await repo().buscarPorHash(hashToken(aba.refreshToken)))?.revogadoEm).toBeTruthy();
    });

    it("pessoa inativa não retoma", async () => {
        const inicial = await emitirLembrete(ctx.factory, ana);
        await ctx.factory.criarUsuarioRepository().desativar(ana.codigo);
        await expect(new RetomarSessao(ctx.factory).execute(inicial.token)).rejects.toBeInstanceOf(ErroNaoAutorizado);
    });

    it("RenovarSessao recusa o lembrete sem revogá-lo", async () => {
        const inicial = await emitirLembrete(ctx.factory, ana);
        await expect(new RenovarSessao(ctx.factory).execute(inicial.token)).rejects.toBeInstanceOf(ErroNaoAutorizado);
        expect((await repo().buscarPorHash(hashToken(inicial.token)))?.revogadoEm).toBeNull();
    });

    it("EncerrarSessao revoga o refresh e o lembrete", async () => {
        const aba = await emitirSessao(ctx.factory, ana);
        const lembrete = await emitirLembrete(ctx.factory, ana);
        await new EncerrarSessao(ctx.factory).execute(aba.refreshToken, lembrete.token);
        expect((await repo().buscarPorHash(hashToken(aba.refreshToken)))?.revogadoEm).toBeTruthy();
        expect((await repo().buscarPorHash(hashToken(lembrete.token)))?.revogadoEm).toBeTruthy();
    });

    it("login revoga o lembrete anterior e só cria outro com manterConectado", async () => {
        const antigo = await emitirLembrete(ctx.factory, ana);
        const sem = await new LoginUsuario(ctx.factory).execute({ email: "ana@dev.konvex", senha: SENHA }, "ip", antigo.token);
        expect(sem.lembrete).toBeUndefined();
        expect((await repo().buscarPorHash(hashToken(antigo.token)))?.revogadoEm).toBeTruthy();
        const com = await new LoginUsuario(ctx.factory).execute({ email: "ana@dev.konvex", senha: SENHA, manterConectado: true }, "ip");
        expect(com.lembrete?.token).toBeTruthy();
        expect((await repo().buscarPorHash(hashToken(com.lembrete!.token)))?.lembrar).toBe(true);
    });

    it("login com senha errada não mexe no lembrete", async () => {
        const antigo = await emitirLembrete(ctx.factory, ana);
        await expect(
            new LoginUsuario(ctx.factory).execute({ email: "ana@dev.konvex", senha: "errada" }, "ip", antigo.token),
        ).rejects.toBeInstanceOf(ErroNaoAutorizado);
        expect((await repo().buscarPorHash(hashToken(antigo.token)))?.revogadoEm).toBeNull();
    });
});
