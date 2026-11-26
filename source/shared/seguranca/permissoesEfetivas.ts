import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import StatusPessoa, { STATUS_NA_EJ } from "../../domain/enum/StatusPessoa";
import { ErroValidacao } from "../erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../erros/mensagensDeErro";
import { Permissao } from "./catalogoPermissoes";

/** O cargo atual da pessoa, como as regras precisam dele (sessão 31a). */
export interface CargoDaPessoa {
    codigo: string;
    nome: string;
    /** 1 = presidente; menor = mais alto. */
    posicao: number;
    /** Área do período em que a pessoa tem o cargo: é a que vale para "abre os projetos da área". */
    codigoArea: string;
}

export interface PermissoesDaPessoa {
    permissoes: Permissao[];
    cargo: CargoDaPessoa | null;
}

/**
 * Permissões que valem para a pessoa agora (spec 31a, 5.1): fora da EJ, nada; trainee, o conjunto "trainee"
 * (mesmo com cargo); com período aberto com cargo, as do cargo (lidas do repositório, para a grade valer no
 * próximo clique); sem cargo, o conjunto "sem_cargo". Desde a 24a há no máximo um período aberto com cargo.
 */
export async function permissoesEfetivas(
    usuario: { codigo: string; status?: StatusPessoa | string },
    f: RepositoryFactoryInterface,
): Promise<PermissoesDaPessoa> {
    if (usuario.status !== undefined && !STATUS_NA_EJ.includes(usuario.status as StatusPessoa)) return { permissoes: [], cargo: null };
    const abertos = await f.criarPeriodoAreaRepository().listarAbertosDe([usuario.codigo]);
    const comCargo = abertos.find((p) => p.aberto && p.codigoUsuario === usuario.codigo && p.cargo);
    const cargoAtual = comCargo?.cargo ? await f.criarCargoRepository().buscarPorCodigo(comCargo.cargo.codigo) : null;
    const cargo: CargoDaPessoa | null =
        comCargo && cargoAtual
            ? { codigo: cargoAtual.codigo, nome: cargoAtual.nome, posicao: cargoAtual.posicao, codigoArea: comCargo.area.codigo }
            : null;
    if (usuario.status === StatusPessoa.TRAINEE) {
        return { permissoes: await f.criarPermissoesRepository().conjunto("trainee"), cargo };
    }
    if (cargoAtual) return { permissoes: [...cargoAtual.permissoes], cargo };
    return { permissoes: await f.criarPermissoesRepository().conjunto("sem_cargo"), cargo: null };
}

/** Sessão 31a: só lidera projeto quem tem `projetos.liderar` (antes: todos menos o trainee). 400 LIDER_SEM_PERMISSAO. */
export async function exigirPodeLiderar(
    lider: { codigo: string; status?: StatusPessoa | string },
    f: RepositoryFactoryInterface,
): Promise<void> {
    const { permissoes } = await permissoesEfetivas(lider, f);
    if (!permissoes.includes(Permissao.PROJETOS_LIDERAR)) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.LIDER_SEM_PERMISSAO, "LIDER_SEM_PERMISSAO");
    }
}
