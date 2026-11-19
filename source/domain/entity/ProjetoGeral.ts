import Area from "./Area";
import Participacao from "./Participacao";
import PeriodoArea from "./PeriodoArea";
import Projeto from "./Projeto";
import Usuario from "./Usuario";
import StatusProjeto from "../enum/StatusProjeto";
import TipoProjeto from "../enum/TipoProjeto";

/** Prazo do projeto geral: não acaba (sessão 23b). */
const FIM_DO_GERAL = new Date("2099-12-31T00:00:00.000Z");

export function nomeDoGeral(area: Area): string {
    return `${area.nome} geral`;
}

/** Projeto geral da área: interno, fixo, sem equipe própria (a equipe vem dos períodos da área). */
export function novoGeral(area: Area, hoje: Date): Projeto {
    return new Projeto(
        nomeDoGeral(area),
        `Tarefas da área ${area.nome} que ainda não são projeto.`,
        hoje,
        FIM_DO_GERAL,
        area.ativa ? StatusProjeto.EM_EXECUCAO : StatusProjeto.ARQUIVADO,
        [],
        undefined,
        { area, tipo: TipoProjeto.INTERNO, geralDaArea: true },
    );
}

/**
 * Equipe do projeto geral = quem passou pela área: período aberto vira participação ativa, encerrado vira
 * participação com saída. Quem tem um período encerrado e outro aberto aparece uma vez em `membros`.
 */
export function comEquipeDaArea(
    projeto: Projeto,
    periodosDaArea: PeriodoArea[],
    usuarios: Map<string, Usuario>,
    lideres: string[],
): Projeto {
    const participacoes: Participacao[] = [];
    for (const p of periodosDaArea) {
        if (p.area.codigo !== projeto.area?.codigo) continue;
        const usuario = usuarios.get(p.codigoUsuario);
        if (!usuario) continue;
        participacoes.push(new Participacao(usuario, { dataEntrada: p.inicio, dataSaida: p.fim }));
    }
    return projeto.copiar({ participacoes, lideresDaArea: lideres });
}
