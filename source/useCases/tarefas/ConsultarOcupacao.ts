import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/entity/Projeto";
import Tarefa from "../../domain/entity/Tarefa";
import PeriodoArea from "../../domain/entity/PeriodoArea";
import { STATUS_NA_EJ } from "../../domain/enum/StatusPessoa";
import StatusProjeto from "../../domain/enum/StatusProjeto";
import StatusTarefa from "../../domain/enum/StatusTarefa";
import { PercentualPorDificuldade } from "../../domain/enum/DificuldadeTarefa";
import { calcularOcupacao, noDia, segundaDaSemana, TarefaParaOcupacao } from "../../domain/service/ocupacao";
import { hoje as hojeEmSaoPaulo } from "../../shared/datas";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { acessoAoProjeto } from "../../shared/seguranca/visibilidadeProjetos";

const UMA_SEMANA = 7 * 86_400_000;

export interface OcupacaoResumo {
    codigoUsuario: string;
    nome: string;
    horas: number;
    teto: number;
    percentual: number;
}

export type ItemOcupacao =
    | { tipo: "tarefa"; codigo: string; titulo: string; projeto: { codigo: string; nome: string }; horas: number }
    | { tipo: "projeto"; projeto: { codigo: string; nome: string }; horas: number }
    | { tipo: "outras"; horas: number };

export interface OcupacaoDetalhe {
    codigoUsuario: string;
    horas: number;
    teto: number;
    percentual: number;
    /** Segunda-feira da semana, AAAA-MM-DD. */
    semana: string;
    itens: ItemOcupacao[];
}

export interface AvisoOcupacao extends OcupacaoResumo {
    semana: string;
}

const arredondar = (n: number) => Math.round(n * 10) / 10;
const dataIso = (d: Date) => d.toISOString().slice(0, 10);
/** Dia da data (AAAA-MM-DD), sem a hora: a coluna é DATE, então só o dia conta. */
const diaIso = (d: Date) => dataIso(noDia(d));

function projetoAtivo(projeto: Projeto): boolean {
    return projeto.status !== StatusProjeto.CONCLUIDO && projeto.status !== StatusProjeto.ARQUIVADO;
}

/**
 * Teto de cada pessoa na semana: o cargo do período vigente na segunda ([inicio, fim)).
 * Dois cargos ao mesmo tempo (dados de antes da regra de um cargo por vez): vale o maior.
 */
function tetosNaSemana(periodos: PeriodoArea[], segunda: Date): Map<string, number> {
    const tetos = new Map<string, number>();
    const t = segunda.getTime();
    for (const p of periodos) {
        if (!p.cargo || p.inicio.getTime() > t || (p.fim !== null && p.fim.getTime() <= t)) continue;
        tetos.set(p.codigoUsuario, Math.max(tetos.get(p.codigoUsuario) ?? 0, p.cargo.tetoSemanalHoras));
    }
    return tetos;
}

function mesmosResponsaveis(a: Tarefa, b: Tarefa): boolean {
    const codigosA = new Set(a.responsaveis.map((r) => r.codigo));
    return codigosA.size === new Set(b.responsaveis.map((r) => r.codigo)).size && b.responsaveis.every((r) => codigosA.has(r.codigo));
}

/** A gravação mexe na conta da ocupação? (dificuldade, datas, responsáveis, status ou coluna) */
function mudouAConta(antes: Tarefa, depois: Tarefa): boolean {
    return (
        antes.dificuldade !== depois.dificuldade ||
        diaIso(antes.dataInicio) !== diaIso(depois.dataInicio) ||
        diaIso(antes.dataFim) !== diaIso(depois.dataFim) ||
        antes.status !== depois.status ||
        antes.coluna.codigo !== depois.coluna.codigo ||
        !mesmosResponsaveis(antes, depois)
    );
}

/**
 * Ocupação semanal (spec 24a, seções 5 e 7): horas das tarefas abertas sobre o teto do cargo.
 * O total de todos é público para quem está logado; o detalhe respeita `acessoAoProjeto`
 * (completo = linha por tarefa; cartão = linha por projeto, sem título, para todos desde a sessão 27b;
 * projeto sumido = uma linha "outras").
 */
export default class ConsultarOcupacao {
    constructor(
        private readonly factory: RepositoryFactoryInterface,
        private readonly hoje: () => Date = hojeEmSaoPaulo,
    ) {}

    /** Pessoas na EJ (ativo e trainee) com o total da semana de `semana` (padrão: hoje em São Paulo). */
    async todas(semana?: Date): Promise<OcupacaoResumo[]> {
        const dia = this.hoje();
        const segunda = segundaDaSemana(semana ?? dia);
        const pessoas = await this.factory.criarUsuarioRepository().listar({ status: STATUS_NA_EJ });
        const codigos = pessoas.map((p) => p.codigo);
        const { tarefas, horas, periodos } = await this.carregar(await this.factory.criarTarefaRepository().listar());
        const ocupacao = calcularOcupacao(tarefas, horas, tetosNaSemana(periodos, segunda), codigos, segunda, dia);
        return ocupacao.map((o, i) => ({
            codigoUsuario: o.codigoUsuario,
            nome: pessoas[i].nome,
            horas: o.horas,
            teto: o.teto,
            percentual: o.percentual,
        }));
    }

    /** Detalhe de uma pessoa: só mostra de cada tarefa o que quem pede pode ver do projeto dela. */
    async dePessoa(usuario: UsuarioAutenticado, codigoUsuario: string, semana?: Date): Promise<OcupacaoDetalhe> {
        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(codigoUsuario);
        if (!pessoa) throw new ErroNaoEncontrado("Pessoa não encontrada.");
        const dia = this.hoje();
        const segunda = segundaDaSemana(semana ?? dia);
        const lidas = await this.factory.criarTarefaRepository().listarPorResponsavel(codigoUsuario);
        const { tarefas, horas, periodos, projetos } = await this.carregar(lidas);
        const [o] = calcularOcupacao(tarefas, horas, tetosNaSemana(periodos, segunda), [codigoUsuario], segunda, dia);

        const porCodigo = new Map(lidas.map((t) => [t.codigo, t]));
        const itens: ItemOcupacao[] = [];
        const porProjeto = new Map<string, { tipo: "projeto"; projeto: { codigo: string; nome: string }; horas: number }>();
        let outras = 0;
        for (const item of o.tarefas) {
            const tarefa = porCodigo.get(item.codigo)!;
            const projeto = projetos.get(tarefa.projeto.codigo);
            const acesso = projeto ? acessoAoProjeto(usuario, projeto) : null;
            if (acesso === "completo") {
                itens.push({
                    tipo: "tarefa",
                    codigo: tarefa.codigo,
                    titulo: tarefa.titulo,
                    projeto: { codigo: projeto!.codigo, nome: projeto!.nome },
                    horas: item.horas,
                });
            } else if (acesso === "cartao") {
                const linha = porProjeto.get(projeto!.codigo) ?? {
                    tipo: "projeto" as const,
                    projeto: { codigo: projeto!.codigo, nome: projeto!.nome },
                    horas: 0,
                };
                linha.horas = arredondar(linha.horas + item.horas);
                porProjeto.set(projeto!.codigo, linha);
            } else {
                outras += item.horas;
            }
        }
        itens.push(...porProjeto.values());
        if (outras > 0) itens.push({ tipo: "outras", horas: arredondar(outras) });

        return { codigoUsuario, horas: o.horas, teto: o.teto, percentual: o.percentual, semana: dataIso(segunda), itens };
    }

    /**
     * Avisos depois de gravar a tarefa: para cada responsável, a semana tocada pela tarefa em que ele fica com a maior %;
     * entra se passar de 100%. Vazio se a gravação não mexe na conta ou se a tarefa não soma horas
     * (concluída, sem dificuldade ou de projeto concluído/arquivado).
     */
    async avisos(antes: Tarefa | null, gravada: Tarefa): Promise<AvisoOcupacao[]> {
        if (antes && !mudouAConta(antes, gravada)) return [];
        if (gravada.status === StatusTarefa.CONCLUIDA || gravada.dificuldade === null || gravada.responsaveis.length === 0) return [];
        const dia = noDia(this.hoje());
        const repo = this.factory.criarTarefaRepository();
        const lidas = new Map<string, Tarefa>();
        for (const r of gravada.responsaveis) for (const t of await repo.listarPorResponsavel(r.codigo)) lidas.set(t.codigo, t);
        // Vale a versão lida do repositório (datas como gravadas, sem hora); a recebida só entra se não veio na leitura.
        const depois = lidas.get(gravada.codigo) ?? gravada;
        lidas.set(depois.codigo, depois);
        const { tarefas, horas, periodos, projetos } = await this.carregar([...lidas.values()]);
        const projeto = projetos.get(depois.projeto.codigo) ?? depois.projeto;
        if (!projetoAtivo(projeto)) return [];

        // Semanas tocadas: da semana do início à do fim, mas nunca antes da semana atual (aviso de semana passada não serve);
        // atrasada, só a semana de hoje (onde as horas caem). Datas sempre no dia (meia-noite UTC).
        const semanas: Date[] = [];
        const semanaAtual = segundaDaSemana(dia).getTime();
        const fim = noDia(depois.dataFim);
        if (fim.getTime() < dia.getTime()) semanas.push(new Date(semanaAtual));
        else {
            const ultima = segundaDaSemana(fim).getTime();
            const primeira = Math.max(segundaDaSemana(depois.dataInicio).getTime(), semanaAtual);
            for (let s = primeira; s <= ultima; s += UMA_SEMANA) semanas.push(new Date(s));
        }

        const codigos = depois.responsaveis.map((r) => r.codigo);
        const pior = new Map<string, AvisoOcupacao>();
        for (const segunda of semanas) {
            for (const o of calcularOcupacao(tarefas, horas, tetosNaSemana(periodos, segunda), codigos, segunda, dia)) {
                const atual = pior.get(o.codigoUsuario);
                if (atual && atual.percentual >= o.percentual) continue;
                const nome = depois.responsaveis.find((r) => r.codigo === o.codigoUsuario)!.nome;
                pior.set(o.codigoUsuario, {
                    codigoUsuario: o.codigoUsuario,
                    nome,
                    horas: o.horas,
                    teto: o.teto,
                    percentual: o.percentual,
                    semana: dataIso(segunda),
                });
            }
        }
        return [...pior.values()].filter((a) => a.percentual > 100);
    }

    /** Converte as tarefas para a conta, com o projeto atual (status e equipe de hoje), as horas por nível e os períodos. */
    private async carregar(lidas: Tarefa[]): Promise<{
        tarefas: TarefaParaOcupacao[];
        horas: PercentualPorDificuldade;
        periodos: PeriodoArea[];
        projetos: Map<string, Projeto>;
    }> {
        const [listaProjetos, horas, areas] = await Promise.all([
            this.factory.criarProjetoRepository().listar(),
            this.factory.criarHorasDificuldadeRepository().listar(),
            this.factory.criarAreaRepository().listar(),
        ]);
        const periodos = await this.factory.criarPeriodoAreaRepository().listarDasAreas(areas.map((a) => a.codigo));
        const projetos = new Map(listaProjetos.map((p) => [p.codigo, p]));
        const tarefas = lidas.map((t) => ({
            codigo: t.codigo,
            dataInicio: t.dataInicio,
            dataFim: t.dataFim,
            concluida: t.status === StatusTarefa.CONCLUIDA,
            projetoAtivo: projetoAtivo(projetos.get(t.projeto.codigo) ?? t.projeto),
            dificuldade: t.dificuldade,
            responsaveis: t.responsaveis.map((r) => r.codigo),
        }));
        return { tarefas, horas, periodos, projetos };
    }
}
