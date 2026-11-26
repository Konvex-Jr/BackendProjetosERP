import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { ehPermissao, PADRAO_MEMBRO, Permissao, TODAS_AS_PERMISSOES } from "../../shared/seguranca/catalogoPermissoes";

/** Teto de horas por semana de quem não tem cargo (e padrão de cargo novo). */
export const TETO_SEM_CARGO = 10;

/** Posição de cargo novo: abaixo de presidente (1), diretores (2) e gerentes (3). */
export const POSICAO_PADRAO = 4;

/** Cargo configurável (ADR-007, doc 04 QA-29). */
export default class Cargo {
    readonly codigo: string;
    readonly nome: string;
    readonly ativo: boolean;
    /** Quem tem este cargo numa área a lidera (spec 23). */
    readonly lideraArea: boolean;
    /** Horas de tarefa por semana que a pessoa deste cargo aguenta (1 a 40; sessão 24a). */
    readonly tetoSemanalHoras: number;
    /** Posição na hierarquia (sessão 31a): 1 = presidente; menor = mais alto. Vários cargos podem dividir uma posição. */
    readonly posicao: number;
    private readonly permissoesGravadas: readonly Permissao[];

    constructor(
        nome: string,
        ativo = true,
        codigo?: string,
        lideraArea = false,
        tetoSemanalHoras = TETO_SEM_CARGO,
        posicao = POSICAO_PADRAO,
        permissoes: readonly unknown[] = PADRAO_MEMBRO,
    ) {
        this.codigo = codigo ?? uuid();
        this.nome = (nome ?? "").trim();
        this.ativo = ativo;
        this.lideraArea = lideraArea;
        this.tetoSemanalHoras = tetoSemanalHoras;
        this.posicao = posicao;
        if (!Number.isInteger(posicao) || posicao < 1) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.CARGO.POSICAO_INVALIDA, "POSICAO_INVALIDA");
        }
        if (!Array.isArray(permissoes)) throw new ErroValidacao(MENSAGENS_DE_ERRO.CARGO.PERMISSOES_INVALIDAS, "PERMISSAO_INVALIDA");
        const invalida = permissoes.find((p) => !ehPermissao(p));
        if (invalida !== undefined) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.CARGO.PERMISSAO_INVALIDA(String(invalida)), "PERMISSAO_INVALIDA");
        }
        this.permissoesGravadas = [...new Set(permissoes as Permissao[])];
        if (!this.nome) throw new ErroValidacao("O nome do cargo é obrigatório.", "NOME_CARGO_OBRIGATORIO");
        if (this.nome.length > 80) throw new ErroValidacao("O nome do cargo deve ter até 80 caracteres.", "NOME_CARGO_LONGO");
        if (!Number.isInteger(tetoSemanalHoras) || tetoSemanalHoras < 1 || tetoSemanalHoras > 40) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.CARGO.TETO_INVALIDO, "TETO_INVALIDO");
        }
    }

    /** O cargo do presidente (posição 1) sempre pode tudo: ninguém tranca o sistema. */
    ehPresidente(): boolean {
        return this.posicao === 1;
    }

    get permissoes(): readonly Permissao[] {
        return this.ehPresidente() ? TODAS_AS_PERMISSOES : this.permissoesGravadas;
    }

    toJSON() {
        return {
            codigo: this.codigo,
            nome: this.nome,
            ativo: this.ativo,
            lideraArea: this.lideraArea,
            tetoSemanalHoras: this.tetoSemanalHoras,
            posicao: this.posicao,
            permissoes: this.permissoes,
        };
    }
}
