import Area from "../../domain/entity/Area";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { sincronizarGeral } from "../projetos/sincronizarGeral";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { excluirDadosDoProjeto } from "../projetos/excluirDadosDoProjeto";

/**
 * ADR-007: cria ou edita uma área. Impede ciclos na hierarquia. Com `temGeral` (sessão 24b; ausente
 * mantém o atual), a área tem ou não projeto geral: desligar exclui o geral (só se não tiver tarefas),
 * religar cria um novo. Gravar a área e excluir o geral é uma ação só.
 */
export default class SalvarArea {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: {
        codigo?: string;
        nome: string;
        codigoAreaPai?: string | null;
        ativa?: boolean;
        temGeral?: boolean;
    }): Promise<Area> {
        const repo = this.factory.criarAreaRepository();
        const atual = input.codigo ? await repo.buscarPorCodigo(input.codigo) : null;
        if (input.codigo && !atual) throw new ErroNaoEncontrado("Área não encontrada.");

        const codigoAreaPai = input.codigoAreaPai || null;
        if (codigoAreaPai) {
            const todas = await repo.listar();
            if (!todas.some((a) => a.codigo === codigoAreaPai)) throw new ErroNaoEncontrado("Área superior não encontrada.");
            // Sobe a partir da área superior; se chegar nesta área, haveria um ciclo.
            let cursor: string | null = codigoAreaPai;
            const visitados = new Set<string>();
            while (cursor && !visitados.has(cursor)) {
                if (atual && cursor === atual.codigo) {
                    throw new ErroValidacao("Uma área não pode ficar abaixo de si mesma.", "AREA_CICLICA");
                }
                visitados.add(cursor);
                cursor = todas.find((a) => a.codigo === cursor)?.codigoAreaPai ?? null;
            }
        }

        const temGeral = input.temGeral ?? atual?.temGeral ?? true;
        const area = new Area(input.nome, codigoAreaPai, input.ativa ?? atual?.ativa ?? true, atual?.codigo, temGeral);
        return this.factory.emTransacao(async (tx) => {
            const geral = !temGeral && atual ? await this.geralSemTarefas(tx, atual.codigo) : null;
            const areas = tx.criarAreaRepository();
            const salva = atual ? await areas.editar(area) : await areas.criar(area);
            if (geral) await excluirDadosDoProjeto(tx, geral);
            if (temGeral) await sincronizarGeral(tx, salva);
            return salva;
        });
    }

    /** Código do geral da área, travado até o fim da ação; 409 se ele tiver tarefas. `null` se a área já não tem geral. */
    private async geralSemTarefas(tx: RepositoryFactoryInterface, codigoArea: string): Promise<string | null> {
        const projetos = tx.criarProjetoRepository();
        const geral = await projetos.buscarGeralDaArea(codigoArea);
        if (!geral) return null;
        await projetos.travar(geral.codigo);
        const tarefas = await tx.criarTarefaRepository().listarCodigosPorProjeto(geral.codigo);
        if (tarefas.length > 0) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.PROJETO.GERAL_COM_TAREFAS(tarefas.length), "GERAL_COM_TAREFAS");
        }
        return geral.codigo;
    }
}
