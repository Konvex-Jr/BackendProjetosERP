import Cargo from "../../domain/entity/Cargo";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ConjuntoPermissoes, CONJUNTOS_PERMISSOES } from "../../domain/interfaces/PermissoesRepositoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { CATALOGO, ehPermissao, InfoPermissao, Permissao } from "../../shared/seguranca/catalogoPermissoes";
import { estaAcima, exigirAlterarCargo, exigirConceder } from "../../shared/seguranca/hierarquia";
import { exigirPermissao, UsuarioAutenticado } from "../../shared/seguranca/permissoes";

export interface ColunaGrade {
    /** Código do cargo, ou "sem_cargo" / "trainee". */
    chave: string;
    nome: string;
    /** Posição do cargo; nula nos conjuntos (abaixo de todos). */
    posicao: number | null;
    permissoes: Permissao[];
    podeAlterar: boolean;
}

const NOMES_CONJUNTO: Record<ConjuntoPermissoes, string> = { sem_cargo: "Sem cargo", trainee: "Trainee" };

const ehConjunto = (chave: string): chave is ConjuntoPermissoes => CONJUNTOS_PERMISSOES.includes(chave as ConjuntoPermissoes);

/**
 * Grade de permissões (sessão 31a): colunas = cargos ativos (presidente primeiro) e os conjuntos "Sem cargo" e
 * "Trainee"; linhas = o catálogo. Quem tem `permissoes.gerir` vê tudo e altera só o que está abaixo do seu cargo,
 * ligando apenas permissões que ele mesmo tem.
 */
export default class GerirPermissoes {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async grade(usuario: UsuarioAutenticado | undefined | null): Promise<{ catalogo: readonly InfoPermissao[]; colunas: ColunaGrade[] }> {
        const quem = exigirPermissao(usuario, Permissao.PERMISSOES_GERIR, MENSAGENS_DE_ERRO.PERMISSOES.SEM_PERMISSAO);
        const cargos = (await this.factory.criarCargoRepository().listar())
            .filter((c) => c.ativo)
            .sort((a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome));
        const colunas: ColunaGrade[] = cargos.map((c) => ({
            chave: c.codigo,
            nome: c.nome,
            posicao: c.posicao,
            permissoes: [...c.permissoes],
            podeAlterar: !c.ehPresidente() && estaAcima(quem, c.posicao),
        }));
        for (const conjunto of CONJUNTOS_PERMISSOES) {
            colunas.push({
                chave: conjunto,
                nome: NOMES_CONJUNTO[conjunto],
                posicao: null,
                permissoes: await this.factory.criarPermissoesRepository().conjunto(conjunto),
                podeAlterar: true,
            });
        }
        return { catalogo: CATALOGO, colunas };
    }

    async salvarColuna(usuario: UsuarioAutenticado | undefined | null, chave: string, permissoes: unknown): Promise<ColunaGrade> {
        const quem = exigirPermissao(usuario, Permissao.PERMISSOES_GERIR, MENSAGENS_DE_ERRO.PERMISSOES.SEM_PERMISSAO);
        const lista = lerPermissoes(permissoes);
        if (ehConjunto(chave)) {
            const repo = this.factory.criarPermissoesRepository();
            exigirConceder(quem, await repo.conjunto(chave), lista);
            await repo.gravarConjunto(chave, lista);
            return { chave, nome: NOMES_CONJUNTO[chave], posicao: null, permissoes: lista, podeAlterar: true };
        }
        const repo = this.factory.criarCargoRepository();
        const cargo = await repo.buscarPorCodigo(chave);
        if (!cargo) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PERMISSOES.COLUNA_NAO_ENCONTRADA);
        exigirAlterarCargo(quem, cargo);
        exigirConceder(quem, cargo.permissoes, lista);
        const salvo = await repo.editar(
            new Cargo(cargo.nome, cargo.ativo, cargo.codigo, cargo.lideraArea, cargo.tetoSemanalHoras, cargo.posicao, lista),
        );
        return { chave, nome: salvo.nome, posicao: salvo.posicao, permissoes: [...salvo.permissoes], podeAlterar: true };
    }
}

function lerPermissoes(valor: unknown): Permissao[] {
    if (!Array.isArray(valor)) throw new ErroValidacao(MENSAGENS_DE_ERRO.CARGO.PERMISSOES_INVALIDAS, "PERMISSAO_INVALIDA");
    const invalida = valor.find((p) => !ehPermissao(p));
    if (invalida !== undefined) throw new ErroValidacao(MENSAGENS_DE_ERRO.CARGO.PERMISSAO_INVALIDA(String(invalida)), "PERMISSAO_INVALIDA");
    return [...new Set(valor as Permissao[])];
}
