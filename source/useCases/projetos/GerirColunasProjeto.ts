import ColunaProjeto, { validarColunas } from "../../domain/entity/ColunaProjeto";
import Usuario from "../../domain/entity/Usuario";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { hoje as hojeNoFuso } from "../../shared/datas";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

export interface EntradaColuna {
    codigo?: string;
    nome: string;
    cor: string;
    papel: string;
}

const ehObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === "object" && valor !== null && !Array.isArray(valor);

/**
 * Sessão 21: grava as colunas do quadro do projeto, na ordem enviada. Coluna com `codigo` é a mesma
 * (renomear, trocar cor, papel ou posição); sem `codigo` é nova; a que sumiu da lista é excluída, e as
 * tarefas dela vão para `destinos[codigo]`. Tarefa em coluna que mudou de papel acompanha o papel novo (feito no repositório).
 * Quem pode é decidido na rota.
 */
export default class GerirColunasProjeto {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: {
        codigoProjeto: string;
        colunas: EntradaColuna[];
        destinos?: Record<string, string>;
        hoje?: Date;
        quem: Usuario | null;
    }): Promise<ColunaProjeto[]> {
        const projeto = await this.factory.criarProjetoRepository().buscarPorCodigo(input.codigoProjeto);
        if (!projeto) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);

        const entradas: unknown = input.colunas;
        const destinos: unknown = input.destinos ?? {};
        if (!Array.isArray(entradas) || !entradas.every(ehObjeto) || !ehObjeto(destinos)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.COLUNAS_INVALIDAS, "COLUNAS_INVALIDAS");
        }

        const atuais = new Map(projeto.colunas.map((c) => [c.codigo, c]));
        const usados = new Set<string>();
        const novas = new Set<string>();
        const finais = entradas.map((e) => {
            let codigo: string | undefined;
            if (e.codigo !== undefined && e.codigo !== null) {
                if (typeof e.codigo !== "string") {
                    throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.COLUNAS_INVALIDAS, "COLUNAS_INVALIDAS");
                }
                codigo = e.codigo;
                // Código que não é de uma coluna atual: quase sempre outra pessoa excluiu a coluna enquanto esta editava.
                if (!atuais.has(codigo)) throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
                if (usados.has(codigo)) {
                    throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.CODIGO_REPETIDO(codigo), "COLUNAS_INVALIDAS");
                }
                usados.add(codigo);
            }
            const coluna = new ColunaProjeto(e.nome as string, e.cor as any, e.papel as any, codigo);
            if (codigo === undefined) novas.add(coluna.codigo);
            return coluna;
        });
        validarColunas(finais);

        const hoje = input.hoje ?? hojeNoFuso();
        const finalPorCodigo = new Map(finais.map((c) => [c.codigo, c]));
        const tarefas = await this.factory.criarTarefaRepository().listarPorProjeto(input.codigoProjeto);
        const destinosGravar = new Map<string, string>();

        for (const antiga of projeto.colunas) {
            const nelas = tarefas.filter((t) => t.coluna?.codigo === antiga.codigo);
            if (finalPorCodigo.has(antiga.codigo)) continue;
            if (nelas.length === 0) continue;
            const pedido = destinos[antiga.codigo];
            if (pedido === undefined || pedido === null) {
                throw new ErroValidacao(
                    MENSAGENS_DE_ERRO.COLUNA.DESTINO_OBRIGATORIO(antiga.nome, nelas.length),
                    "DESTINO_COLUNA_OBRIGATORIO",
                );
            }
            const destino = typeof pedido === "string" ? finalPorCodigo.get(pedido) : undefined;
            if (!destino || !atuais.has(destino.codigo)) {
                throw new ErroValidacao(MENSAGENS_DE_ERRO.COLUNA.DESTINO_INVALIDO(antiga.nome), "DESTINO_COLUNA_INVALIDO");
            }
            destinosGravar.set(antiga.codigo, destino.codigo);
        }

        // Status e conclusão das tarefas são acertados pelo repositório, dentro da transação, pelo papel final de cada coluna.
        await this.factory.criarColunaProjetoRepository().substituir(input.codigoProjeto, finais, destinosGravar, hoje, input.quem, novas);
        return finais;
    }
}
