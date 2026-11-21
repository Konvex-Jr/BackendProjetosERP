import Capacitacao from "../../domain/entity/Capacitacao";
import Tarefa from "../../domain/entity/Tarefa";
import { STATUS_NA_EJ } from "../../domain/enum/StatusPessoa";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";

/** Um aviso por responsável novo (estava fora em `antes`, está em `depois`), exceto o autor. `antes` null = criação. */
export async function avisarTarefaRecebida(
    factory: RepositoryFactoryInterface,
    antes: Tarefa | null,
    depois: Tarefa,
    codigoAutor: string,
): Promise<void> {
    const tinham = new Set((antes?.responsaveis ?? []).map((r) => r.codigo));
    const novos = depois.responsaveis.filter((r) => !tinham.has(r.codigo) && r.codigo !== codigoAutor);
    if (!novos.length) return;
    await factory.criarAvisoRepository().criarVarios(
        novos.map((r) => ({
            codigoUsuario: r.codigo,
            tipo: "tarefa_recebida" as const,
            codigoTarefa: depois.codigo,
            codigoCapacitacao: null,
            codigoAutor,
        })),
    );
}

/** Todas as pessoas ativas com status na EJ (`STATUS_NA_EJ`, inclui trainee), exceto o autor. */
export async function avisarCapacitacaoNova(
    factory: RepositoryFactoryInterface,
    capacitacao: Capacitacao,
    codigoAutor: string,
): Promise<void> {
    const pessoas = await factory.criarUsuarioRepository().listar({ status: STATUS_NA_EJ });
    const alvos = pessoas.filter((p) => p.ativo && p.codigo !== codigoAutor);
    if (!alvos.length) return;
    await factory.criarAvisoRepository().criarVarios(
        alvos.map((p) => ({
            codigoUsuario: p.codigo,
            tipo: "capacitacao_nova" as const,
            codigoTarefa: null,
            codigoCapacitacao: capacitacao.codigo,
            codigoAutor,
        })),
    );
}
