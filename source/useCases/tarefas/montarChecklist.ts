import ItemChecklistTarefa from "../../domain/entity/ItemChecklistTarefa";
import Usuario from "../../domain/entity/Usuario";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { EditarTarefaChecklistInput } from "./EditarTarefaInput";

interface Contexto {
    /** Responsáveis finais da tarefa (depois da edição). */
    responsaveis: Usuario[];
    /** Quem era responsável antes e deixou de ser: os itens dessas pessoas ficam sem responsável, sem erro. */
    sairam?: Set<string>;
    /** Itens já gravados (só ao editar). Neles o `feito` vem daqui; o texto e o responsável vêm do corpo. Ausente ao criar. */
    atuais?: ItemChecklistTarefa[];
}

/** Item que já existe, mas com a pessoa que saiu da tarefa tirada. */
export function limparResponsaveisQueSairam(itens: ItemChecklistTarefa[], responsaveis: Usuario[]): ItemChecklistTarefa[] {
    const ficam = new Set(responsaveis.map((r) => r.codigo));
    return itens.map((i) =>
        i.responsavel && !ficam.has(i.responsavel.codigo) ? new ItemChecklistTarefa(i.texto, i.feito, i.codigo, null) : i,
    );
}

/**
 * Monta o checklist a partir do corpo (criar e editar). A regra do responsável do item vale só aqui,
 * nunca ao carregar do banco: tem que ser um dos responsáveis finais da tarefa (400
 * RESPONSAVEL_ITEM_FORA_DA_TAREFA), a não ser que tenha acabado de sair dela (aí o item fica sem responsável).
 */
export function montarChecklist(itens: EditarTarefaChecklistInput[], { responsaveis, sairam = new Set(), atuais }: Contexto) {
    const usados = new Set<string>();
    return itens.map((item) => {
        const atual = item.codigo ? atuais?.find((a) => a.codigo === item.codigo) : undefined;
        if (atual) {
            // O mesmo item duas vezes gravaria o mesmo código duas vezes (violação de chave): 400, não 500.
            if (usados.has(atual.codigo)) {
                throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.ITEM_CHECKLIST_REPETIDO, "ITEM_CHECKLIST_REPETIDO");
            }
            usados.add(atual.codigo);
        }
        let responsavel: Usuario | null = null;
        if (item.codigoResponsavel === undefined) {
            responsavel = atual?.responsavel ? (responsaveis.find((r) => r.codigo === atual.responsavel!.codigo) ?? null) : null;
        } else if (item.codigoResponsavel !== null) {
            if (typeof item.codigoResponsavel !== "string") {
                throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.RESPONSAVEL_ITEM_INVALIDO, "RESPONSAVEL_ITEM_INVALIDO");
            }
            responsavel = responsaveis.find((r) => r.codigo === item.codigoResponsavel) ?? null;
            if (!responsavel && !sairam.has(item.codigoResponsavel)) {
                throw new ErroValidacao(MENSAGENS_DE_ERRO.TAREFA.RESPONSAVEL_ITEM_FORA_DA_TAREFA, "RESPONSAVEL_ITEM_FORA_DA_TAREFA");
            }
        }
        // Ao editar, o feito de item que existe é o do banco (a marcação feita por outra pessoa não se perde); item novo nasce não feito.
        const feito = atuais ? (atual?.feito ?? false) : Boolean(item.feito);
        return new ItemChecklistTarefa(item.texto, feito, atual?.codigo, responsavel);
    });
}
