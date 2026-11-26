import StatusPessoa from "../source/domain/enum/StatusPessoa";
import { hoje } from "../source/domain/entity/Participacao";
import EditarUsuario from "../source/useCases/pessoas/EditarUsuario";
import { criarContexto } from "./fixtures";

test("edita os dados e normaliza o e-mail do usuário", async () => {
    const { factory, membro, senioridade } = await criarContexto();
    const usuario = await new EditarUsuario(factory).execute({
        codigo: membro.codigo,
        nome: " Ana Silva Atualizada ",
        email: " ANA.SILVA@KONVEX.COM.BR ",
        senioridade,
    });

    expect(usuario.nome).toBe("Ana Silva Atualizada");
    expect(usuario.email).toBe("ana.silva@konvex.com.br");
});

describe("curso, telefone e fim do trainee na edição (25b)", () => {
    const hojeSP = () => hoje();
    const comHorario = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T15:00:00Z`);

    async function pessoa(detalhes: object = {}) {
        const ctx = await criarContexto();
        const repo = ctx.factory.criarUsuarioRepository();
        await repo.editar(ctx.membro.copiar(detalhes as any));
        const editar = (campos: object) => new EditarUsuario(ctx.factory).execute({ codigo: ctx.membro.codigo, ...campos } as any);
        return { ...ctx, editar };
    }

    test("pessoa antiga fora das regras edita outro campo", async () => {
        const { editar } = await pessoa({ curso: "Eng. de Software", telefone: "ramal 12" });
        const u = await editar({ linkedinUrl: "https://linkedin.com/in/ana" });
        expect(u.linkedinUrl).toBe("https://linkedin.com/in/ana");
        expect(u.curso).toBe("Eng. de Software");
        expect(u.telefone).toBe("ramal 12");
        await expect(editar({ curso: "Direito" })).rejects.toMatchObject({ codigo: "CURSO_INVALIDO" });
    });

    test("pessoa sem curso edita só a bio; curso null ou vazio: CURSO_OBRIGATORIO", async () => {
        const { editar } = await pessoa();
        await expect(editar({ bio: "oi" })).resolves.toMatchObject({ bio: "oi" });
        await expect(editar({ curso: null, bio: "a" })).resolves.toMatchObject({ curso: null });
        await expect(editar({ curso: "", bio: "b" })).resolves.toMatchObject({ curso: null });
        await expect(editar({ curso: "Engenharia Elétrica" })).resolves.toMatchObject({ curso: "Engenharia Elétrica" });
        await expect(editar({ curso: null })).rejects.toMatchObject({ codigo: "CURSO_OBRIGATORIO" });
        await expect(editar({ curso: "" })).rejects.toMatchObject({ codigo: "CURSO_OBRIGATORIO" });
    });

    test("telefone: máscara ou só dígitos passam; 123 barra; null limpa", async () => {
        const { editar } = await pessoa();
        await expect(editar({ telefone: "(11) 98765-4321" })).resolves.toMatchObject({ telefone: "(11) 98765-4321" });
        await expect(editar({ telefone: "1187654321" })).resolves.toMatchObject({ telefone: "1187654321" });
        await expect(editar({ telefone: "123" })).rejects.toMatchObject({ codigo: "TELEFONE_INVALIDO" });
        await expect(editar({ telefone: null })).resolves.toMatchObject({ telefone: null });
    });

    test("fim do trainee: antes da entrada, futuro, hoje com horário, com trainee", async () => {
        const entrada = new Date("2026-01-10T00:00:00Z");
        const { editar } = await pessoa({ dataEntrada: entrada });
        await expect(editar({ fimTrainee: new Date("2026-01-09T00:00:00Z") })).rejects.toMatchObject({
            codigo: "FIM_TRAINEE_ANTES_DA_ENTRADA",
        });
        const amanha = new Date(hojeSP().getTime() + 86_400_000);
        await expect(editar({ fimTrainee: amanha })).rejects.toMatchObject({ codigo: "FIM_TRAINEE_NO_FUTURO" });
        const u = await editar({ fimTrainee: comHorario(hojeSP()) });
        expect(u.fimTrainee).not.toBeNull();
        // mudar a entrada para depois do fim gravado
        await expect(editar({ dataEntrada: new Date(hojeSP().getTime() + 86_400_000) })).rejects.toMatchObject({
            codigo: "FIM_TRAINEE_ANTES_DA_ENTRADA",
        });
    });

    test("fimTrainee null limpa a data", async () => {
        const { editar } = await pessoa({ dataEntrada: new Date("2026-01-10T00:00:00Z"), fimTrainee: new Date("2026-02-01T00:00:00Z") });
        await expect(editar({ fimTrainee: null })).resolves.toMatchObject({ fimTrainee: null });
    });

    test("trainee com fimTrainee: 400 FIM_TRAINEE_COM_TRAINEE", async () => {
        const { editar } = await pessoa({ status: StatusPessoa.TRAINEE, dataEntrada: new Date("2026-01-10T00:00:00Z") });
        await expect(editar({ fimTrainee: hojeSP() })).rejects.toMatchObject({ codigo: "FIM_TRAINEE_COM_TRAINEE" });
    });
});
