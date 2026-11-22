import Usuario from "../../source/domain/entity/Usuario";
import Projeto from "../../source/domain/entity/Projeto";
import Participacao from "../../source/domain/entity/Participacao";
import PerfilUsuario from "../../source/domain/enum/PerfilUsuario";
import { criarContexto, dataFim, dataInicio } from "../fixtures";
import { subirServidor } from "./servidorTeste";

/** Sessão 27a (era o resumo da 20): quem está fora de um sigiloso, gerente ou membro, recebe o cartão. */
describe("Cartão de projeto sigiloso na leitura", () => {
    let ctx: Awaited<ReturnType<typeof criarContexto>>;
    let servidor: Awaited<ReturnType<typeof subirServidor>>;
    let exEquipe: Usuario;

    beforeEach(async () => {
        ctx = await criarContexto();
        exEquipe = new Usuario("Edu", "edu@konvex.com.br", PerfilUsuario.MEMBRO, true, "x", ctx.senioridade, "usr-edu");
        await ctx.factory.criarUsuarioRepository().criar(exEquipe);
        const repo = ctx.factory.criarProjetoRepository();
        await repo.criar(
            new Projeto(
                "Projeto Aurora",
                "descrição",
                dataInicio,
                dataFim,
                undefined,
                [ctx.membro, new Participacao(exEquipe, { dataEntrada: dataInicio, dataSaida: new Date("2026-10-20T00:00:00.000Z") })],
                "proj-sig",
                { sigiloso: true, clienteNome: "Cliente Zeta", lider: ctx.membro },
            ),
        );
        servidor = await subirServidor(ctx.factory);
    });

    afterEach(async () => servidor.fechar());

    const codigos = (r: any) => r.corpo.map((p: any) => p.codigo);

    it("gerente fora vê o cartão, sem cliente, tarefas nem equipe", async () => {
        const r = await servidor.chamar("get", "/projetos", { usuario: ctx.gerente });
        expect(codigos(r)).toEqual(["proj-sig"]);
        expect(r.corpo[0].cartao).toBe(true);
        expect(r.corpo[0].sigiloso).toBe(true);
        expect(JSON.stringify(r.corpo[0])).not.toContain("Cliente Zeta");
        expect(r.corpo[0].tarefas).toBeUndefined();
        expect(r.corpo[0].participacoes).toBeUndefined();
    });

    it("ex-equipe recebe o cartão; equipe atual vê completo, sem lista de acesso", async () => {
        const ex = await servidor.chamar("get", "/projetos", { usuario: exEquipe });
        expect(codigos(ex)).toEqual(["proj-sig"]);
        expect(ex.corpo[0].cartao).toBe(true);
        const equipe = await servidor.chamar("get", "/projetos", { usuario: ctx.membro });
        expect(equipe.corpo[0].cartao).toBeUndefined();
        expect(equipe.corpo[0].clienteNome).toBe("Cliente Zeta");
        expect(equipe.corpo[0]).not.toHaveProperty("podeGerirAcesso");
        expect(equipe.corpo[0]).not.toHaveProperty("acesso");
    });

    it("busca: cliente não acha para o gerente fora; parte do nome acha com cartão", async () => {
        const porCliente = await servidor.chamar("get", "/projetos?busca=zeta", { usuario: ctx.gerente });
        expect(codigos(porCliente)).toEqual([]);
        const porNome = await servidor.chamar("get", "/projetos?busca=AURÓRA", { usuario: ctx.gerente });
        expect(codigos(porNome)).toEqual(["proj-sig"]);
        expect(porNome.corpo[0].cartao).toBe(true);
    });

    it("filtro por líder mantém o cartão (o líder está no cartão; sessão 27b)", async () => {
        const r = await servidor.chamar("get", `/projetos?codigoLider=${ctx.membro.codigo}`, { usuario: ctx.gerente });
        expect(codigos(r)).toEqual(["proj-sig"]);
        expect(r.corpo[0].cartao).toBe(true);
        const outro = await servidor.chamar("get", "/projetos?codigoLider=usr-joao", { usuario: ctx.gerente });
        expect(codigos(outro)).toEqual([]);
    });

    it("filtro por pessoa não revela a equipe do sigiloso ao gerente fora", async () => {
        const r = await servidor.chamar("get", `/projetos?codigoUsuario=${ctx.membro.codigo}`, { usuario: ctx.gerente });
        expect(codigos(r)).toEqual([]);
    });

    it("GET /projetos/:codigo", async () => {
        const gerente = await servidor.chamar("get", "/projetos/proj-sig", { usuario: ctx.gerente });
        expect(gerente.status).toBe(200);
        expect(gerente.corpo.cartao).toBe(true);
        expect(gerente.corpo.clienteNome).toBeUndefined();
        const ex = await servidor.chamar("get", "/projetos/proj-sig", { usuario: exEquipe });
        expect(ex.status).toBe(200);
        expect(ex.corpo.cartao).toBe(true);
        const completo = await servidor.chamar("get", "/projetos/proj-sig", { usuario: ctx.membro });
        expect(completo.status).toBe(200);
        expect(completo.corpo.sigiloso).toBe(true);
        expect(completo.corpo).not.toHaveProperty("acesso");
        expect(completo.corpo.tarefas.atrasadas).toBe(0);
    });
});
