import ItemBiblioteca from "../../domain/entity/ItemBiblioteca";
import { Referencia } from "../../domain/entity/Referencia";
import SigiloBiblioteca, { ehSigiloBiblioteca } from "../../domain/enum/SigiloBiblioteca";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { lerLista } from "../../shared/entradas";
import { exigirAutenticado, UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { exigirAlterarItem, exigirPodeUsarSigiloEProjeto, exigirVerItem } from "../../shared/seguranca/regrasBiblioteca";

const M = MENSAGENS_DE_ERRO.BIBLIOTECA;

/**
 * Corpo de POST/PUT /biblioteca. Tags e links aceitam array ou texto separado por vírgulas.
 * No PUT, campo ausente mantém o valor atual; `codigoProjeto: null` (ou "") tira o projeto.
 */
export interface EntradaItemBiblioteca {
    titulo?: unknown;
    conteudo?: unknown;
    links?: unknown;
    tags?: unknown;
    codigoProjeto?: unknown;
    sigilo?: unknown;
}

function lerTexto(valor: unknown): string {
    return valor === undefined || valor === null ? "" : String(valor);
}

function lerListaDeTexto(valor: unknown, campo: string): string[] {
    if (valor !== undefined && valor !== null && typeof valor !== "string" && !Array.isArray(valor)) {
        throw new ErroValidacao(`O campo ${campo} deve ser uma lista.`, "LISTA_INVALIDA");
    }
    return lerLista(valor);
}

function lerSigilo(valor: unknown): SigiloBiblioteca {
    if (valor === undefined || valor === null || valor === "") return SigiloBiblioteca.TODOS;
    if (!ehSigiloBiblioteca(valor)) throw new ErroValidacao(M.SIGILO_INVALIDO, "SIGILO_BIBLIOTECA_INVALIDO");
    return valor;
}

function lerCodigoProjeto(valor: unknown): string | null {
    if (valor === undefined || valor === null) return null;
    return String(valor).trim() || null;
}

/** Cria e edita itens da Biblioteca (sessão 17). Excluir: ExcluirItemBiblioteca. */
export default class SalvarItemBiblioteca {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    private get repo() {
        return this.factory.criarBibliotecaRepository();
    }

    /** Chamado só depois de conferida a permissão de usar o projeto (o membro não descobre se um projeto existe). */
    private async projeto(codigo: string | null): Promise<Referencia | null> {
        if (!codigo) return null;
        const projeto = await this.factory.criarProjetoRepository().buscarPorCodigo(codigo);
        if (!projeto) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);
        return { codigo: projeto.codigo, nome: projeto.nome };
    }

    async criar(usuario: UsuarioAutenticado | null | undefined, entrada: EntradaItemBiblioteca): Promise<ItemBiblioteca> {
        const autenticado = exigirAutenticado(usuario);
        const sigilo = lerSigilo(entrada.sigilo);
        const codigoProjeto = lerCodigoProjeto(entrada.codigoProjeto);
        await exigirPodeUsarSigiloEProjeto(autenticado, sigilo, codigoProjeto, this.factory);

        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(autenticado.codigo);
        const item = new ItemBiblioteca({
            titulo: lerTexto(entrada.titulo),
            conteudo: lerTexto(entrada.conteudo),
            links: lerListaDeTexto(entrada.links, "links"),
            tags: lerListaDeTexto(entrada.tags, "tags"),
            projeto: await this.projeto(codigoProjeto),
            sigilo,
            autor: pessoa ? { codigo: pessoa.codigo, nome: pessoa.nome } : null,
        });
        return this.repo.criar(item);
    }

    /**
     * Item invisível: 404; sem permissão de alterar: 403. A regra de sigilo e projeto só é conferida
     * quando um dos dois muda, para o autor que saiu da equipe continuar editando o próprio item.
     */
    async editar(usuario: UsuarioAutenticado | null | undefined, codigo: string, entrada: EntradaItemBiblioteca): Promise<ItemBiblioteca> {
        const atual = await exigirVerItem(usuario, await this.repo.buscarPorCodigo(codigo), this.factory);
        const autenticado = exigirAlterarItem(usuario, atual);

        const sigilo = entrada.sigilo === undefined ? atual.sigilo : lerSigilo(entrada.sigilo);
        const codigoAtual = atual.projeto?.codigo ?? null;
        const codigoProjeto = entrada.codigoProjeto === undefined ? codigoAtual : lerCodigoProjeto(entrada.codigoProjeto);
        const projetoMudou = codigoProjeto !== codigoAtual;
        if (sigilo !== atual.sigilo || projetoMudou) {
            await exigirPodeUsarSigiloEProjeto(autenticado, sigilo, codigoProjeto, this.factory);
        }

        const item = new ItemBiblioteca({
            codigo: atual.codigo,
            autor: atual.autor,
            criadoEm: atual.criadoEm,
            atualizadoEm: new Date(),
            titulo: entrada.titulo === undefined ? atual.titulo : lerTexto(entrada.titulo),
            conteudo: entrada.conteudo === undefined ? atual.conteudo : lerTexto(entrada.conteudo),
            links: entrada.links === undefined ? atual.links : lerListaDeTexto(entrada.links, "links"),
            tags: entrada.tags === undefined ? atual.tags : lerListaDeTexto(entrada.tags, "tags"),
            projeto: projetoMudou ? await this.projeto(codigoProjeto) : atual.projeto,
            sigilo,
        });
        return this.repo.editar(item);
    }
}
