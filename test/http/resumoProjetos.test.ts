import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 20: o gerente fora de um projeto sigiloso vê só o resumo; membro fora não sabe que existe. */
describe("Resumo de projeto sigiloso na leitura", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let naLista: Usuario;
    let exEquipe: Usuario;

    beforeEach(async () => {
        ctx = await criarContexto();
        const usuarios = ctx.factory.criarUsuarioRepository();
        naLista = new Usuario("Lia", "lia@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-lia");
        exEquipe = new Usuario("Edu", "edu@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-edu");
        await usuarios.criar(naLista);
        await usuarios.criar(exEquipe);
        const repo = ctx.factory.criarProjetoRepository();
        await repo.criar(
            new Projeto("Projeto Aurora", "descrição", dataInicio, dataFim, undefined, [ctx.membro], "proj-sig", {
                sigiloso: true,
                clienteNome: "Cliente Zeta",
                acesso: [naLista.codigo],
            }),
        );
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const codigos = (r: any) => r.corpo.map((p: any) => p.codigo);

    it("gerente fora vê o resumo, sem cliente", async () => {
        const r = await servidor.chamar("get", "/projetos", { usuario: ctx.gerente });
        expect(codigos(r)).toEqual(["proj-sig"]);
        expect(r.corpo[0].resumo).toBe(true);
        expect(JSON.stringify(r.corpo[0])).not.toContain("Cliente Zeta");
        expect(r.corpo[0].tarefas).toEqual({ total: 0, concluidas: 0, atrasadas: 0, semana: 0 });
    });

    it("membro fora não vê; membro na lista vê completo", async () => {
        const outro = await servidor.chamar("get", "/projetos", { usuario: exEquipe });
        expect(codigos(outro)).toEqual([]);
        const dalista = await servidor.chamar("get", "/projetos", { usuario: naLista });
        expect(codigos(dalista)).toEqual(["proj-sig"]);
        expect(dalista.corpo[0].resumo).toBeUndefined();
        expect(dalista.corpo[0].clienteNome).toBe("Cliente Zeta");
        expect(dalista.corpo[0].podeGerirAcesso).toBe(false);
    });

    it("busca: cliente não acha para o gerente fora; parte do nome acha com resumo", async () => {
        const porCliente = await servidor.chamar("get", "/projetos?busca=zeta", { usuario: ctx.gerente });
        expect(codigos(porCliente)).toEqual([]);
        const porNome = await servidor.chamar("get", "/projetos?busca=AURÓRA", { usuario: ctx.gerente });
        expect(codigos(porNome)).toEqual(["proj-sig"]);
        expect(porNome.corpo[0].resumo).toBe(true);
    });

    it("filtro por área ou responsável descarta o resumo", async () => {
        const r = await servidor.chamar("get", "/projetos?codigoArea=qualquer", { usuario: ctx.gerente });
        expect(codigos(r)).toEqual([]);
        const r2 = await servidor.chamar("get", "/projetos?codigoResponsavel=usr-joao", { usuario: ctx.gerente });
        expect(codigos(r2)).toEqual([]);
    });

    it("GET /projetos/:codigo", async () => {
        const gerente = await servidor.chamar("get", "/projetos/proj-sig", { usuario: ctx.gerente });
        expect(gerente.status).toBe(200);
        expect(gerente.corpo.resumo).toBe(true);
        expect(gerente.corpo.clienteNome).toBeUndefined();
        expect((await servidor.chamar("get", "/projetos/proj-sig", { usuario: exEquipe })).status).toBe(404);
        const completo = await servidor.chamar("get", "/projetos/proj-sig", { usuario: ctx.membro });
        expect(completo.status).toBe(200);
        expect(completo.corpo.sigiloso).toBe(true);
        expect(completo.corpo.acesso).toEqual([naLista.codigo]);
        expect(completo.corpo.podeGerirAcesso).toBe(false);
        expect(completo.corpo.tarefas.atrasadas).toBe(0);
    });
});
