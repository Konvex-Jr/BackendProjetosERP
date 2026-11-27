import Projeto, { DetalhesProjeto } from "../../domain/entity/Projeto";
import { montarClientes } from "../../domain/entity/ClienteProjeto";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import PrioridadeProjeto from "../../domain/enum/PrioridadeProjeto";
import TipoProjeto from "../../domain/enum/TipoProjeto";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

/** Campos opcionais do projeto como chegam na API (ausente = não alterar). */
export interface EntradaDetalhesProjeto {
    referencia?: string | null;
    objetivo?: string | null;
    /** Lista de clientes (31b); a rota só aceita de quem tem clientes.ver. */
    clientes?: unknown;
    /** Classe do projeto (31b); vazio = sem classe. */
    codigoClasse?: string | null;
    prioridade?: PrioridadeProjeto;
    tipo?: TipoProjeto;
    progresso?: number;
    codigoArea?: string | null;
    tags?: string[];
}

export async function resolverDetalhesProjeto(
    factory: RepositoryFactoryInterface,
    entrada: EntradaDetalhesProjeto,
): Promise<DetalhesProjeto> {
    const detalhes: DetalhesProjeto = {};
    for (const campo of ["referencia", "objetivo", "prioridade", "progresso", "tipo"] as const) {
        if (entrada[campo] !== undefined) (detalhes as any)[campo] = entrada[campo];
    }
    if (entrada.tags !== undefined) {
        if (!Array.isArray(entrada.tags) || entrada.tags.length > 20) {
            throw new ErroValidacao("Etiquetas devem ser uma lista com até 20 itens.", "TAGS_INVALIDAS");
        }
        detalhes.tags = entrada.tags;
    }
    if (entrada.clientes !== undefined) detalhes.clientes = montarClientes(entrada.clientes);
    if (entrada.codigoClasse !== undefined) {
        if (entrada.codigoClasse) {
            const classe = await factory.criarClasseProjetoRepository().buscarPorCodigo(String(entrada.codigoClasse));
            if (!classe) throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.CLASSE_NAO_ENCONTRADA, "CLASSE_NAO_ENCONTRADA");
            detalhes.classe = classe;
        } else {
            detalhes.classe = null;
        }
    }
    if (entrada.codigoArea !== undefined) {
        if (entrada.codigoArea) {
            const area = await factory.criarAreaRepository().buscarPorCodigo(entrada.codigoArea);
            if (!area) throw new ErroNaoEncontrado("Área não encontrada.");
            detalhes.area = area;
        } else {
            detalhes.area = null;
        }
    }
    return detalhes;
}

/**
 * Sessão 31b: classe obrigatória em todo projeto (menos o geral) e área obrigatória no projeto de cliente.
 * Conferidas ao criar e, na edição, só quando o campo muda (projetos antigos sem classe ou área seguem editáveis).
 */
export function exigirClasseEArea(antes: Projeto | null, depois: Projeto): void {
    if (depois.geralDaArea) return;
    const classeMudou = !antes || (antes.classe?.codigo ?? null) !== (depois.classe?.codigo ?? null);
    if (classeMudou && !depois.classe) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.CLASSE_OBRIGATORIA, "CLASSE_OBRIGATORIA");
    }
    const areaMudou = !antes || (antes.area?.codigo ?? null) !== (depois.area?.codigo ?? null) || antes.tipo !== depois.tipo;
    if (areaMudou && depois.tipo === TipoProjeto.CLIENTE && !depois.area) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.AREA_OBRIGATORIA_CLIENTE, "AREA_OBRIGATORIA_CLIENTE");
    }
}
