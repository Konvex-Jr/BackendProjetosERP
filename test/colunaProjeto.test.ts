import ColunaProjeto, { colunasPadrao, validarColunas } from "../source/domain/entity/ColunaProjeto";
import Projeto from "../source/domain/entity/Projeto";
import Tarefa from "../source/domain/entity/Tarefa";
import Usuario from "../source/domain/entity/Usuario";
import { PapelColuna } from "../source/domain/enum/ColunaProjeto";
import PerfilUsuario from "../source/domain/enum/PerfilUsuario";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import { ErroValidacao } from "../source/shared/erros/ErroValidacao";

const inicio = new Date("2026-10-12T00:00:00.000Z");
const fim = new Date("2026-12-12T00:00:00.000Z");
const hoje = new Date("2026-11-16T00:00:00.000Z");

function codigoDoErro(fn: () => unknown): string | undefined {
    try {
        fn();
    } catch (e) {
        expect(e).toBeInstanceOf(ErroValidacao);
        return (e as ErroValidacao).codigo;
    }
    return undefined;
}

function projetoPadrao(colunas?: ColunaProjeto[]): Projeto {
    return new Projeto("Projeto", "Descrição", inicio, fim, undefined, [], undefined, { colunas });
}

function tarefaDe(
    projeto: Projeto | null,
    status = StatusTarefa.PENDENTE,
    coluna: ColunaProjeto | null = null,
    dataConclusao: Date | null = null,
) {
    return new Tarefa(
        projeto,
        "Tarefa",
        inicio,
        fim,
        status,
        undefined,
        null,
        dataConclusao,
        null,
        [],
        [],
        undefined,
        null,
        projeto ? null : ("execucao" as any),
        null,
        coluna,
    );
}

describe("ColunaProjeto", () => {
    it("colunasPadrao devolve as quatro colunas na ordem", () => {
        expect(colunasPadrao().map((c) => [c.nome, c.cor, c.papel])).toEqual([
            ["A fazer", "cinza", "entrada"],
            ["Fazendo", "azul", "meio"],
            ["Revisando", "amarelo", "meio"],
            ["Concluído", "verde", "concluida"],
        ]);
    });

    it("rejeita nome vazio ou com mais de 40 caracteres", () => {
        expect(codigoDoErro(() => new ColunaProjeto("  ", "azul", PapelColuna.MEIO))).toBe("NOME_COLUNA_INVALIDO");
        expect(codigoDoErro(() => new ColunaProjeto("a".repeat(41), "azul", PapelColuna.MEIO))).toBe("NOME_COLUNA_INVALIDO");
        expect(new ColunaProjeto("a".repeat(40), "azul", PapelColuna.MEIO).nome).toHaveLength(40);
    });

    it("tira os espaços das pontas do nome", () => {
        expect(new ColunaProjeto("  Fazendo ", "azul", PapelColuna.MEIO).nome).toBe("Fazendo");
    });

    it("rejeita cor e papel desconhecidos", () => {
        expect(codigoDoErro(() => new ColunaProjeto("X", "preto" as any, PapelColuna.MEIO))).toBe("COR_COLUNA_INVALIDA");
        expect(codigoDoErro(() => new ColunaProjeto("X", "azul", "fim" as any))).toBe("PAPEL_COLUNA_INVALIDO");
    });
});

describe("validarColunas", () => {
    const entrada = () => new ColunaProjeto("Entrada", "cinza", PapelColuna.ENTRADA);
    const concluida = () => new ColunaProjeto("Fim", "verde", PapelColuna.CONCLUIDA);
    const meio = (nome: string) => new ColunaProjeto(nome, "azul", PapelColuna.MEIO);

    it("aceita as colunas padrão e o mínimo de duas", () => {
        expect(() => validarColunas(colunasPadrao())).not.toThrow();
        expect(() => validarColunas([entrada(), concluida()])).not.toThrow();
    });

    it("exige de 2 a 12 colunas", () => {
        expect(codigoDoErro(() => validarColunas([entrada()]))).toBe("QUANTIDADE_COLUNAS_INVALIDA");
        const treze = [entrada(), concluida(), ...Array.from({ length: 11 }, (_, i) => meio(`Meio ${i}`))];
        expect(codigoDoErro(() => validarColunas(treze))).toBe("QUANTIDADE_COLUNAS_INVALIDA");
    });

    it("não aceita nomes iguais sem diferenciar maiúsculas", () => {
        expect(codigoDoErro(() => validarColunas([entrada(), meio("Fazendo"), meio("fazendo"), concluida()]))).toBe("NOME_COLUNA_REPETIDO");
    });

    it("exige exatamente uma entrada e uma concluída", () => {
        const outraEntrada = new ColunaProjeto("Outra", "rosa", PapelColuna.ENTRADA);
        const outraConcluida = new ColunaProjeto("Outra", "rosa", PapelColuna.CONCLUIDA);
        expect(codigoDoErro(() => validarColunas([entrada(), outraEntrada, concluida()]))).toBe("COLUNA_ENTRADA_UNICA");
        expect(codigoDoErro(() => validarColunas([meio("A"), concluida()]))).toBe("COLUNA_ENTRADA_UNICA");
        expect(codigoDoErro(() => validarColunas([entrada(), concluida(), outraConcluida]))).toBe("COLUNA_CONCLUIDA_UNICA");
        expect(codigoDoErro(() => validarColunas([entrada(), meio("A")]))).toBe("COLUNA_CONCLUIDA_UNICA");
    });
});

describe("Projeto com colunas", () => {
    it("sem colunas nos detalhes tem as quatro padrão", () => {
        expect(projetoPadrao().colunas.map((c) => c.nome)).toEqual(["A fazer", "Fazendo", "Revisando", "Concluído"]);
    });

    it("colunaParaStatus segue a regra de cada status", () => {
        const p = projetoPadrao();
        const [aFazer, fazendo, revisando, concluido] = p.colunas;
        expect(p.colunaParaStatus(StatusTarefa.CONCLUIDA)).toBe(concluido);
        expect(p.colunaParaStatus(StatusTarefa.PENDENTE, revisando)).toBe(aFazer);
        expect(p.colunaParaStatus(StatusTarefa.ANDAMENTO, revisando)).toBe(revisando);
        expect(p.colunaParaStatus(StatusTarefa.ANDAMENTO, aFazer)).toBe(fazendo);
        expect(p.colunaParaStatus(StatusTarefa.ANDAMENTO)).toBe(fazendo);

        const so = new ColunaProjeto("Início", "cinza", PapelColuna.ENTRADA);
        const fimSo = new ColunaProjeto("Fim", "verde", PapelColuna.CONCLUIDA);
        expect(projetoPadrao([so, fimSo]).colunaParaStatus(StatusTarefa.ANDAMENTO)).toBe(so);
    });

    it("comColunas troca as colunas e entra no JSON", () => {
        const so = new ColunaProjeto("Início", "cinza", PapelColuna.ENTRADA);
        const fimSo = new ColunaProjeto("Fim", "verde", PapelColuna.CONCLUIDA);
        const p = projetoPadrao().comColunas([so, fimSo]);
        expect(JSON.parse(JSON.stringify(p)).colunas).toEqual([so.toJSON(), fimSo.toJSON()]);
    });
});

describe("Tarefa com coluna", () => {
    it("criada concluída e sem coluna fica na coluna concluída", () => {
        const p = projetoPadrao();
        const t = tarefaDe(p, StatusTarefa.CONCLUIDA, null, hoje);
        expect(t.coluna?.nome).toBe("Concluído");
    });

    it("o status vem do papel da coluna", () => {
        const p = projetoPadrao();
        const t = tarefaDe(p, StatusTarefa.PENDENTE, p.colunas[2]);
        expect(t.coluna?.nome).toBe("Revisando");
        expect(t.status).toBe(StatusTarefa.ANDAMENTO);
    });

    it("status inválido sem coluna continua dando erro", () => {
        expect(codigoDoErro(() => tarefaDe(projetoPadrao(), "xyz" as any))).toBe("STATUS_TAREFA_INVALIDO");
    });

    it("na coluna concluída sem data não lança no construtor, mas exigirConclusaoCoerente sim", () => {
        const p = projetoPadrao();
        const t = tarefaDe(p, StatusTarefa.PENDENTE, p.colunas[3]);
        expect(codigoDoErro(() => t.exigirConclusaoCoerente())).toBe("DATA_CONCLUSAO_OBRIGATORIA");
        const aberta = tarefaDe(p, StatusTarefa.PENDENTE, null, hoje);
        expect(codigoDoErro(() => aberta.exigirConclusaoCoerente())).toBe("DATA_CONCLUSAO_INCOMPATIVEL");
    });

    it("naColuna: entrar na concluída registra data e autor", () => {
        const p = projetoPadrao();
        const quem = new Usuario("Ana", "ana@x.com", PerfilUsuario.DIRETOR, true, "senha123");
        const t = tarefaDe(p).naColuna(p.colunas[3], hoje, quem);
        expect(t.status).toBe(StatusTarefa.CONCLUIDA);
        expect(t.dataConclusao).toBe(hoje);
        expect(t.concluidaPor).toBe(quem);
    });

    it("naColuna: já concluída mantém data e autor", () => {
        const p = projetoPadrao();
        const antes = new Date("2026-11-01T00:00:00.000Z");
        const t = tarefaDe(p, StatusTarefa.CONCLUIDA, null, antes).naColuna(p.colunas[3], hoje, null);
        expect(t.dataConclusao).toBe(antes);
    });

    it("naColuna: sair da concluída apaga data e autor", () => {
        const p = projetoPadrao();
        const t = tarefaDe(p, StatusTarefa.CONCLUIDA, null, hoje).naColuna(p.colunas[1], hoje, null);
        expect(t.status).toBe(StatusTarefa.ANDAMENTO);
        expect(t.dataConclusao).toBeNull();
        expect(t.concluidaPor).toBeNull();
    });

    it("comStatus mantém a coluna quando ela serve ao status", () => {
        const p = projetoPadrao();
        const t = tarefaDe(p, StatusTarefa.PENDENTE, p.colunas[2]).comStatus(StatusTarefa.ANDAMENTO, null, null);
        expect(t.coluna?.nome).toBe("Revisando");
    });

    it("JSON traz a coluna e não repete as colunas dentro do projeto", () => {
        const json = JSON.parse(JSON.stringify(tarefaDe(projetoPadrao())));
        expect(json.coluna.nome).toBe("A fazer");
        expect(json.projeto.colunas).toBeUndefined();
    });

    it("tarefa avulsa não tem coluna", () => {
        const coluna = colunasPadrao()[0];
        expect(codigoDoErro(() => tarefaDe(null, StatusTarefa.PENDENTE, coluna))).toBe("TAREFA_AVULSA_SEM_COLUNA");
        expect(tarefaDe(null).coluna).toBeNull();
    });
});

describe("Projeto: colunas recebidas", () => {
    it("lista vazia volta às quatro padrão", () => {
        const p = projetoPadrao([]);
        expect(p.colunas.map((c) => c.nome)).toEqual(["A fazer", "Fazendo", "Revisando", "Concluído"]);
        expect(tarefaDe(p).coluna?.nome).toBe("A fazer");
    });

    it("copia a lista recebida", () => {
        const colunas = colunasPadrao();
        const p = projetoPadrao(colunas);
        colunas.pop();
        expect(p.colunas).toHaveLength(4);
        expect(p.colunas).not.toBe(colunas);
    });
});
