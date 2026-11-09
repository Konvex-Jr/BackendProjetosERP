import GerirAnexos from "../GerirAnexos/GerirAnexos";
import { DonoAnexo } from "../../domain/Enum/Anexo";
import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import Iniciativa from "../../domain/Entity/Iniciativa";
import { Referencia } from "../../domain/Entity/Conhecimento";
import Tarefa from "../../domain/Entity/Tarefa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../shared/erros/ErroProibido";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { lerData, lerLista } from "../../shared/entradas";
import { exigirAlterarIniciativa, podeCriarIniciativa } from "../../shared/seguranca/regrasIniciativa";
import { exigirAutenticado, UsuarioAutenticado } from "../../shared/seguranca/permissoes";

const M = MENSAGENS_DE_ERRO.INICIATIVA;

/** Corpo de POST/PUT /iniciativas. Listas aceitam array ou texto separado por vírgulas. */
export interface EntradaIniciativa {
    titulo?: unknown;
    descricao?: unknown;
    tipo?: unknown;
    frente?: unknown;
    status?: unknown;
    codigoResponsavel?: unknown;
    dataInicio?: unknown;
    dataFim?: unknown;
    resultado?: unknown;
    aprendizados?: unknown;
    codigosProjetos?: unknown;
    codigosConhecimentos?: unknown;
}

const texto = (valor: unknown) => (valor === undefined || valor === null ? "" : String(valor));

function lista(valor: unknown, campo: string): string[] {
    if (valor !== undefined && valor !== null && typeof valor !== "string" && !Array.isArray(valor)) {
        throw new ErroValidacao(`O campo ${campo} deve ser uma lista.`, "LISTA_INVALIDA");
    }
    return [...new Set(lerLista(valor))];
}

/** Referência curta da iniciativa para ligar a uma tarefa; vazio = nenhuma; inexistente = 404. */
export async function referenciaDaIniciativa(factory: RepositoryFactoryInterface, codigo: unknown): Promise<Referencia | null> {
    if (!codigo) return null;
    const item = await factory.criarIniciativaRepository().buscarPorCodigo(String(codigo));
    if (!item) throw new ErroNaoEncontrado(M.NAO_ENCONTRADA);
    return { codigo: item.codigo, nome: item.titulo };
}

/** Tarefas ligadas a uma iniciativa (quem pode ver cada uma é decidido na rota). */
export async function tarefasDaIniciativa(factory: RepositoryFactoryInterface, codigo: string): Promise<Tarefa[]> {
    return (await factory.criarTarefaRepository().listar()).filter((t) => t.iniciativa?.codigo === codigo);
}

export default class SalvarIniciativa {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    private async responsavel(codigo: unknown): Promise<Referencia | null> {
        if (!codigo) return null;
        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(String(codigo));
        if (!pessoa || !pessoa.ativo) throw new ErroNaoEncontrado(`Responsável ativo não encontrado: ${codigo}.`);
        return { codigo: pessoa.codigo, nome: pessoa.nome };
    }

    private async projetos(codigos: string[]): Promise<Referencia[]> {
        const repo = this.factory.criarProjetoRepository();
        const achados: Referencia[] = [];
        for (const codigo of codigos) {
            const projeto = await repo.buscarPorCodigo(codigo);
            if (!projeto) throw new ErroNaoEncontrado(`Projeto não encontrado: ${codigo}.`);
            achados.push({ codigo: projeto.codigo, nome: projeto.nome });
        }
        return achados.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    private async conhecimentos(codigos: string[]): Promise<Referencia[]> {
        const repo = this.factory.criarConhecimentoRepository();
        const achados: Referencia[] = [];
        for (const codigo of codigos) {
            const item = await repo.buscarPorCodigo(codigo);
            if (!item) throw new ErroNaoEncontrado(`Item da Base de Inteligência não encontrado: ${codigo}.`);
            achados.push({ codigo: item.codigo, nome: item.titulo });
        }
        return achados.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    private async montar(entrada: EntradaIniciativa, base: Partial<Iniciativa>, responsavelPadrao: Referencia | null): Promise<Iniciativa> {
        const codigoResponsavel = entrada.codigoResponsavel;
        return new Iniciativa({
            codigo: base.codigo,
            criadoPor: base.criadoPor ?? null,
            criadoEm: base.criadoEm,
            atualizadoEm: base.codigo ? new Date() : undefined,
            titulo: texto(entrada.titulo),
            descricao: texto(entrada.descricao),
            tipo: texto(entrada.tipo),
            frente: texto(entrada.frente),
            status: texto(entrada.status) || undefined,
            responsavel: codigoResponsavel === undefined ? responsavelPadrao : await this.responsavel(codigoResponsavel),
            dataInicio: lerData(entrada.dataInicio, "dataInicio"),
            dataFim: lerData(entrada.dataFim, "dataFim"),
            resultado: texto(entrada.resultado),
            aprendizados: texto(entrada.aprendizados),
            projetos: await this.projetos(lista(entrada.codigosProjetos, "codigosProjetos")),
            conhecimentos: await this.conhecimentos(lista(entrada.codigosConhecimentos, "codigosConhecimentos")),
        });
    }

    async podeCriar(usuario: UsuarioAutenticado | null | undefined): Promise<boolean> {
        if (!usuario) return false;
        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(usuario.codigo);
        return podeCriarIniciativa(usuario, pessoa, await this.factory.criarAreaRepository().listar());
    }

    async criar(usuario: UsuarioAutenticado | null | undefined, entrada: EntradaIniciativa): Promise<Iniciativa> {
        const autenticado = exigirAutenticado(usuario);
        if (!(await this.podeCriar(autenticado))) throw new ErroProibido(M.SEM_PERMISSAO_CRIAR);
        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(autenticado.codigo);
        const eu = pessoa ? { codigo: pessoa.codigo, nome: pessoa.nome } : null;
        // Sem responsável informado, quem cria fica responsável.
        const item = await this.montar(entrada, { criadoPor: eu }, eu);
        return this.factory.criarIniciativaRepository().criar(item);
    }

    async editar(usuario: UsuarioAutenticado | null | undefined, codigo: string, entrada: EntradaIniciativa): Promise<Iniciativa> {
        const repo = this.factory.criarIniciativaRepository();
        const atual = await repo.buscarPorCodigo(codigo);
        if (!atual) throw new ErroNaoEncontrado(M.NAO_ENCONTRADA);
        exigirAlterarIniciativa(usuario, atual);
        const salva = await repo.editar(await this.montar(entrada, atual, atual.responsavel));
        // Mantém o título nas tarefas ligadas (no banco ele vem da junção; na memória fica copiado).
        for (const tarefa of await tarefasDaIniciativa(this.factory, codigo)) {
            if (tarefa.iniciativa?.nome !== salva.titulo) {
                await this.factory.criarTarefaRepository().editar(tarefa.comIniciativa({ codigo, nome: salva.titulo }));
            }
        }
        return salva;
    }

    async excluir(usuario: UsuarioAutenticado | null | undefined, codigo: string): Promise<{ codigo: string }> {
        const repo = this.factory.criarIniciativaRepository();
        const atual = await repo.buscarPorCodigo(codigo);
        if (!atual) throw new ErroNaoEncontrado(M.NAO_ENCONTRADA);
        exigirAlterarIniciativa(usuario, atual);
        // As tarefas continuam, só sem a ligação.
        for (const tarefa of await tarefasDaIniciativa(this.factory, codigo)) {
            await this.factory.criarTarefaRepository().editar(tarefa.comIniciativa(null));
        }
        await new GerirAnexos(this.factory).excluirDosDonos(DonoAnexo.INICIATIVA, [codigo]);
        await repo.excluir(codigo);
        return { codigo };
    }
}
