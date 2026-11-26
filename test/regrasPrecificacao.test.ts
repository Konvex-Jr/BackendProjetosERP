import { REGRAS_PADRAO, regrasComPadrao, validarRegrasPrecificacao } from "../source/domain/entity/RegrasPrecificacao";
import SalvarRegrasPrecificacao from "../source/useCases/config/SalvarRegrasPrecificacao";
import { ErroProibido } from "../source/shared/erros/ErroProibido";
import { criarContexto } from "./fixtures";
import { efetivasDoPapel } from "./papel";

const diretor = { codigo: "d", ...efetivasDoPapel("diretor") };
const gerente = { codigo: "g", ...efetivasDoPapel("gerente") };
const membro = { codigo: "m", ...efetivasDoPapel("membro") };

test("sem gravar, gestão lê as regras padrão", async () => {
    const { factory } = await criarContexto();
    expect(await new SalvarRegrasPrecificacao(factory).obter(gerente)).toEqual(REGRAS_PADRAO);
});

test("membro não lê as regras: 403", async () => {
    const { factory } = await criarContexto();
    await expect(new SalvarRegrasPrecificacao(factory).obter(membro)).rejects.toBeInstanceOf(ErroProibido);
});

test("diretor grava (arredonda a uma casa) e o repositório devolve", async () => {
    const { factory } = await criarContexto();
    const novas = { ...REGRAS_PADRAO, urgencia: 25.04, tipoCliente: { parceira: -30, pequena: 0, mediaGrande: 10 } };
    const salvas = await new SalvarRegrasPrecificacao(factory).execute({ regras: novas, quem: diretor });
    expect(salvas.urgencia).toBe(25);
    expect(salvas.tipoCliente.parceira).toBe(-30);
    expect(await new SalvarRegrasPrecificacao(factory).obter(gerente)).toEqual(salvas);
});

test("gerente não grava: 403", async () => {
    const { factory } = await criarContexto();
    await expect(new SalvarRegrasPrecificacao(factory).execute({ regras: REGRAS_PADRAO, quem: gerente })).rejects.toMatchObject({
        message: expect.stringContaining("diretores"),
    });
});

test.each([
    ["campo faltando", { ...REGRAS_PADRAO, risco: { escopo: 10, tecnologia: 10 } }, "risco.terceiros"],
    ["texto", { ...REGRAS_PADRAO, impostos: "10" }, "impostos"],
    ["acima do máximo", { ...REGRAS_PADRAO, descontoMaximo: 51 }, "descontoMaximo"],
    ["negativo onde não pode", { ...REGRAS_PADRAO, complexidade: { baixa: -1, media: 15, alta: 30 } }, "complexidade.baixa"],
    ["validade fracionada", { ...REGRAS_PADRAO, validadeDias: 1.5 }, "validadeDias"],
])("%s: 400 REGRA_PRECIFICACAO_INVALIDA dizendo o campo", (_nome, regras, campo) => {
    expect(() => validarRegrasPrecificacao(regras)).toThrow(
        expect.objectContaining({ codigo: "REGRA_PRECIFICACAO_INVALIDA", message: expect.stringContaining(campo) }),
    );
});

test("margem mínima acima da margem: 400", () => {
    expect(() => validarRegrasPrecificacao({ ...REGRAS_PADRAO, margem: 10, margemMinima: 20 })).toThrow(
        expect.objectContaining({ codigo: "REGRA_PRECIFICACAO_INVALIDA" }),
    );
});

test("regrasComPadrao completa campo ausente com o padrão", () => {
    expect(regrasComPadrao({ urgencia: 50 })).toEqual({ ...REGRAS_PADRAO, urgencia: 50 });
    expect(regrasComPadrao(undefined)).toEqual(REGRAS_PADRAO);
});
