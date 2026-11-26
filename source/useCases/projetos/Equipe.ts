import { exigirPodeLiderar } from "../../shared/seguranca/permissoesEfetivas";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/entity/Projeto";
import Participacao, { hoje } from "../../domain/entity/Participacao";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { exigirNaoGeral } from "./sincronizarGeral";

/** Resultado das operações da aba Equipe: o projeto com a equipe atualizada. */
export interface ResultadoEquipe {
    projeto: Projeto;
}

async function carregar(factory: RepositoryFactoryInterface, codigoProjeto: string): Promise<Projeto> {
    const projeto = await factory.criarProjetoRepository().buscarPorCodigo(codigoProjeto);
    if (!projeto) throw new ErroNaoEncontrado("Projeto não encontrado.");
    exigirNaoGeral(projeto);
    return projeto;
}

async function gravarEResumir(factory: RepositoryFactoryInterface, projeto: Projeto): Promise<ResultadoEquipe> {
    await factory.criarProjetoRepository().editar(projeto);
    return { projeto };
}

/** PR-06: adiciona uma pessoa à equipe com função e responsabilidades. */
export class AdicionarParticipante {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: {
        codigoProjeto: string;
        codigoUsuario: string;
        funcao?: string | null;
        responsabilidades?: string | null;
        dataEntrada?: Date | null;
    }): Promise<ResultadoEquipe> {
        const projeto = await carregar(this.factory, input.codigoProjeto);
        const usuario = await this.factory.criarUsuarioRepository().buscarPorCodigo(input.codigoUsuario);
        if (!usuario) throw new ErroNaoEncontrado("Pessoa não encontrada.");
        if (!usuario.naEj) throw new ErroValidacao("Só pessoas Ativas ou Trainees entram em projetos.", "PESSOA_FORA_DA_EJ");
        if (projeto.participacaoAtivaDe(usuario.codigo)) {
            throw new ErroConflito("A pessoa já participa deste projeto.", "PARTICIPACAO_DUPLICADA");
        }
        const participacao = new Participacao(usuario, {
            funcao: input.funcao,
            responsabilidades: input.responsabilidades,
            dataEntrada: input.dataEntrada ?? hoje(),
        });
        return gravarEResumir(this.factory, projeto.copiar({ participacoes: [...projeto.participacoes, participacao] }));
    }
}

/** Edita função e responsabilidades de uma participação em aberto. */
export class EditarParticipacao {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: {
        codigoProjeto: string;
        codigoParticipacao: string;
        funcao?: string | null;
        responsabilidades?: string | null;
    }): Promise<ResultadoEquipe> {
        const projeto = await carregar(this.factory, input.codigoProjeto);
        const atual = projeto.participacoes.find((p) => p.codigo === input.codigoParticipacao);
        if (!atual) throw new ErroNaoEncontrado("Participação não encontrada.");
        if (!atual.ativa) throw new ErroValidacao("Participações encerradas não podem ser alteradas.", "PARTICIPACAO_ENCERRADA");
        const editada = atual.copiar({
            funcao: input.funcao,
            responsabilidades: input.responsabilidades,
        });
        return gravarEResumir(
            this.factory,
            projeto.copiar({ participacoes: projeto.participacoes.map((p) => (p.codigo === atual.codigo ? editada : p)) }),
        );
    }
}

/** Encerra a participação: a pessoa sai da equipe, mas continua no histórico do projeto. */
export class EncerrarParticipacao {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: { codigoProjeto: string; codigoParticipacao: string; dataSaida?: Date | null }): Promise<ResultadoEquipe> {
        const projeto = await carregar(this.factory, input.codigoProjeto);
        const atual = projeto.participacoes.find((p) => p.codigo === input.codigoParticipacao);
        if (!atual) throw new ErroNaoEncontrado("Participação não encontrada.");
        if (!atual.ativa) throw new ErroValidacao("Esta participação já foi encerrada.", "PARTICIPACAO_ENCERRADA");
        const encerrada = atual.copiar({ dataSaida: input.dataSaida ?? hoje() });
        return gravarEResumir(
            this.factory,
            projeto.copiar({ participacoes: projeto.participacoes.map((p) => (p.codigo === atual.codigo ? encerrada : p)) }),
        );
    }
}

/** Sessão 8b: a gestão escolhe o líder entre a equipe atual (ou deixa o projeto sem líder). */
export class DefinirLider {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: { codigoProjeto: string; codigoUsuario: string | null }): Promise<Projeto> {
        const projeto = await carregar(this.factory, input.codigoProjeto);
        let lider = null;
        if (input.codigoUsuario) {
            lider = projeto.membros.find((m) => m.codigo === input.codigoUsuario) ?? null;
            if (!lider) throw new ErroValidacao("O líder precisa estar na equipe atual do projeto.", "LIDER_FORA_DO_PROJETO");
            // Sessão 31a: lidera quem tem projetos.liderar; o status vem do cadastro, não da cópia guardada no projeto.
            const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(lider.codigo);
            await exigirPodeLiderar(pessoa ?? lider, this.factory);
        }
        const editado = projeto.copiar({ lider });
        await this.factory.criarProjetoRepository().editar(editado);
        return editado;
    }
}
