import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import Usuario from "./Usuario";
import Area from "./Area";
import Participacao from "./Participacao";
import StatusProjeto, { STATUS_PROJETO_ATIVO } from "../enum/StatusProjeto";
import PrioridadeProjeto from "../enum/PrioridadeProjeto";
import StatusTarefa from "../enum/StatusTarefa";
import { PapelColuna } from "../enum/ColunaProjeto";
import ColunaProjeto, { colunasPadrao } from "./ColunaProjeto";
import TipoProjeto from "../enum/TipoProjeto";

/** Campos do projeto além de nome, descrição e período (RF-020). */
export interface DetalhesProjeto {
    referencia?: string | null;
    objetivo?: string | null;
    clienteNome?: string | null;
    prioridade?: PrioridadeProjeto;
    progresso?: number;
    area?: Area | null;
    tags?: string[];
    /** Líder do projeto (sessão 8b). Só vale se estiver na equipe atual; senão o projeto fica sem líder. */
    lider?: Usuario | null;
    /** Projeto sigiloso (sessão 20; regra da 27a): só diretor e equipe atual veem o projeto inteiro. */
    sigiloso?: boolean;
    /** Código de quem criou o projeto (histórico; não dá acesso desde a sessão 27a). */
    criadoPor?: string | null;
    /** Colunas do kanban, em ordem (sessão 21). Ausente = as quatro padrão. */
    colunas?: ColunaProjeto[];
    /** Cliente (padrão) ou interno (sessão 23b); o interno exige área. */
    tipo?: TipoProjeto;
    /** Projeto geral da área: um por área, criado pelo sistema, fixo e interno. */
    geralDaArea?: boolean;
    /** Líderes da área do projeto interno (calculado a cada leitura, nunca gravado). */
    lideresDaArea?: string[];
}

/**
 * Projeto da EJ com a equipe. Participações nunca são apagadas, só encerradas com data de saída,
 * para guardar o histórico de quem passou pelo projeto (e manter o acesso de quem participou).
 */
export default class Projeto {
    readonly codigo: string;
    readonly nome: string;
    readonly descricao: string;
    readonly dataInicio: Date;
    /** Prazo do projeto. */
    readonly dataFim: Date;
    readonly status: StatusProjeto;
    /** Todas as participações, inclusive as encerradas (histórico). */
    readonly participacoes: Participacao[];
    /** Código do projeto (ex.: COD-001). Chamado "code" no doc 04. */
    readonly referencia: string | null;
    readonly objetivo: string | null;
    readonly clienteNome: string | null;
    readonly prioridade: PrioridadeProjeto;
    readonly progresso: number;
    readonly area: Area | null;
    readonly tags: string[];
    readonly lider: Usuario | null;
    readonly sigiloso: boolean;
    readonly criadoPor: string | null;
    readonly colunas: ColunaProjeto[];
    readonly tipo: TipoProjeto;
    readonly geralDaArea: boolean;
    readonly lideresDaArea: string[];

    /**
     * `membros` aceita pessoas (viram participações novas, sem alocação) ou participações completas.
     */
    constructor(
        nome: string,
        descricao: string,
        dataInicio: Date,
        dataFim: Date,
        status: StatusProjeto = StatusProjeto.EM_EXECUCAO,
        membros: Array<Usuario | Participacao> = [],
        codigo?: string,
        detalhes: DetalhesProjeto = {},
    ) {
        this.codigo = codigo ?? uuid();
        this.nome = nome;
        this.descricao = descricao;
        this.dataInicio = dataInicio;
        this.dataFim = dataFim;
        this.status = status;
        this.participacoes = membros.map((m) => (m instanceof Participacao ? m : new Participacao(m, { dataEntrada: dataInicio })));
        this.referencia = detalhes.referencia?.trim() || null;
        this.objetivo = detalhes.objetivo?.trim() || null;
        this.clienteNome = detalhes.clienteNome?.trim() || null;
        this.prioridade = detalhes.prioridade ?? PrioridadeProjeto.MEDIA;
        this.progresso = detalhes.progresso === undefined || detalhes.progresso === null ? 0 : Number(detalhes.progresso);
        this.area = detalhes.area ?? null;
        this.tags = [...new Set((detalhes.tags ?? []).map((t) => String(t).trim()).filter(Boolean))];
        const codigoLider = detalhes.lider?.codigo;
        this.lider = codigoLider ? (this.membros.find((m) => m.codigo === codigoLider) ?? null) : null;
        this.sigiloso = detalhes.sigiloso ?? false;
        this.criadoPor = detalhes.criadoPor ?? null;
        // Cópia, como as tags; lista vazia (dado estranho) volta às quatro padrão, para a tarefa sempre ter coluna.
        this.colunas = detalhes.colunas?.length ? [...detalhes.colunas] : colunasPadrao();
        this.tipo = detalhes.tipo ?? TipoProjeto.CLIENTE;
        this.geralDaArea = detalhes.geralDaArea ?? false;
        this.lideresDaArea = [...new Set(detalhes.lideresDaArea ?? [])];

        this.validar();
    }

    /** Pessoas com participação em aberto. */
    get membros(): Usuario[] {
        return this.participacoes.filter((p) => p.ativa).map((p) => p.usuario);
    }

    get ativo(): boolean {
        return STATUS_PROJETO_ATIVO.includes(this.status);
    }

    /** Coluna onde a tarefa nova entra; sem coluna `entrada` (dado estranho), a primeira. */
    get colunaDeEntrada(): ColunaProjeto {
        return this.colunas.find((c) => c.papel === PapelColuna.ENTRADA) ?? this.colunas[0];
    }

    /** Coluna das tarefas concluídas; sem coluna `concluida` (dado estranho), a última. */
    get colunaConcluida(): ColunaProjeto {
        return this.colunas.find((c) => c.papel === PapelColuna.CONCLUIDA) ?? this.colunas[this.colunas.length - 1];
    }

    /** Coluna que corresponde a um status, preferindo a coluna `atual` se ela já serve. */
    colunaParaStatus(status: StatusTarefa, atual: ColunaProjeto | null = null): ColunaProjeto {
        if (status === StatusTarefa.CONCLUIDA) return this.colunaConcluida;
        if (status === StatusTarefa.PENDENTE) return this.colunaDeEntrada;
        if (atual && atual.papel === PapelColuna.MEIO) return atual;
        return this.colunas.find((c) => c.papel === PapelColuna.MEIO) ?? this.colunaDeEntrada;
    }

    comColunas(colunas: ColunaProjeto[]): Projeto {
        return this.copiar({ colunas });
    }

    /** Líder cadastrado ou, no projeto interno, líder da área. */
    ehLider(codigoUsuario: string): boolean {
        return this.lider?.codigo === codigoUsuario || this.lideresDaArea.includes(codigoUsuario);
    }

    participacaoAtivaDe(codigoUsuario: string): Participacao | undefined {
        return this.participacoes.find((p) => p.ativa && p.usuario.codigo === codigoUsuario);
    }

    copiar(
        alteracoes: Partial<{
            nome: string;
            descricao: string;
            dataInicio: Date;
            dataFim: Date;
            status: StatusProjeto;
            participacoes: Participacao[];
        }> &
            DetalhesProjeto = {},
    ): Projeto {
        const pick = (chave: string): any => ((alteracoes as any)[chave] !== undefined ? (alteracoes as any)[chave] : (this as any)[chave]);
        return new Projeto(
            pick("nome"),
            pick("descricao"),
            pick("dataInicio"),
            pick("dataFim"),
            pick("status"),
            pick("participacoes"),
            this.codigo,
            {
                referencia: pick("referencia"),
                objetivo: pick("objetivo"),
                clienteNome: pick("clienteNome"),
                prioridade: pick("prioridade"),
                progresso: pick("progresso"),
                area: pick("area"),
                tags: pick("tags"),
                lider: pick("lider"),
                sigiloso: pick("sigiloso"),
                criadoPor: pick("criadoPor"),
                colunas: pick("colunas"),
                tipo: pick("tipo"),
                geralDaArea: pick("geralDaArea"),
                lideresDaArea: pick("lideresDaArea"),
            },
        );
    }

    toJSON() {
        return {
            codigo: this.codigo,
            nome: this.nome,
            descricao: this.descricao,
            dataInicio: this.dataInicio,
            dataFim: this.dataFim,
            status: this.status,
            membros: this.membros,
            participacoes: this.participacoes,
            referencia: this.referencia,
            objetivo: this.objetivo,
            clienteNome: this.clienteNome,
            prioridade: this.prioridade,
            progresso: this.progresso,
            area: this.area,
            tags: this.tags,
            lider: this.lider,
            sigiloso: this.sigiloso,
            colunas: this.colunas.map((c) => c.toJSON()),
            tipo: this.tipo,
            geralDaArea: this.geralDaArea,
            lideresDaArea: this.lideresDaArea,
        };
    }

    private validar(): void {
        if (!this.nome || !this.nome.trim()) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.NOME_OBRIGATORIO, "NOME_PROJETO_OBRIGATORIO");
        }

        if (!this.descricao || !this.descricao.trim()) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.DESCRICAO_OBRIGATORIA, "DESCRICAO_PROJETO_OBRIGATORIA");
        }

        if (
            !(this.dataInicio instanceof Date) ||
            !(this.dataFim instanceof Date) ||
            Number.isNaN(this.dataInicio.getTime()) ||
            Number.isNaN(this.dataFim.getTime())
        ) {
            throw new ErroValidacao("As datas do projeto devem ser válidas.", "DATA_PROJETO_INVALIDA");
        }

        if (this.dataFim.getTime() < this.dataInicio.getTime()) {
            throw new ErroValidacao("A data de fim não pode ser anterior à data de início.", "PERIODO_PROJETO_INVALIDO");
        }

        if (!Object.values(StatusProjeto).includes(this.status)) {
            throw new ErroValidacao("Status de projeto inválido.", "STATUS_PROJETO_INVALIDO");
        }

        if (!Object.values(PrioridadeProjeto).includes(this.prioridade)) {
            throw new ErroValidacao("Prioridade de projeto inválida.", "PRIORIDADE_PROJETO_INVALIDA");
        }

        if (!Number.isInteger(this.progresso) || this.progresso < 0 || this.progresso > 100) {
            throw new ErroValidacao("O progresso deve ser um número inteiro entre 0 e 100.", "PROGRESSO_INVALIDO");
        }

        if (this.referencia && this.referencia.length > 30) {
            throw new ErroValidacao("O código do projeto deve ter até 30 caracteres.", "REFERENCIA_LONGA");
        }

        if (!Object.values(TipoProjeto).includes(this.tipo)) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.TIPO_INVALIDO, "TIPO_PROJETO_INVALIDO");
        }
        if (this.tipo === TipoProjeto.INTERNO && !this.area) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.AREA_OBRIGATORIA_INTERNO, "AREA_OBRIGATORIA_INTERNO");
        }

        if (this.geralDaArea && this.sigiloso) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.GERAL_SIGILOSO, "GERAL_SIGILOSO");
        }

        if (this.geralDaArea && this.tipo !== TipoProjeto.INTERNO) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.GERAL_INTERNO, "GERAL_INTERNO");
        }

        const ativos = this.participacoes.filter((p) => p.ativa).map((p) => p.usuario.codigo);
        if (new Set(ativos).size !== ativos.length) {
            throw new ErroValidacao("O projeto não pode ter membros duplicados.", "MEMBRO_DUPLICADO_PROJETO");
        }
    }
}
