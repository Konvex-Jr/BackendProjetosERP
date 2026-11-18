import { DetalhesPessoa } from "../../domain/entity/Usuario";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import PerfilUsuario from "../../domain/enum/PerfilUsuario";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import StatusPessoa from "../../domain/enum/StatusPessoa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

/** Campos do perfil como chegam na API (todos opcionais; ausente = não alterar). */
export interface EntradaPerfilPessoa {
    nomeExibicao?: string | null;
    telefone?: string | null;
    linkedinUrl?: string | null;
    calendarioUrl?: string | null;
    githubUrl?: string | null;
    curso?: string | null;
    semestre?: number | null;
    codigoArea?: string | null;
    codigoCargo?: string | null;
    dataEntrada?: Date | null;
    bio?: string | null;
}

/** Converte a entrada da API em DetalhesPessoa, conferindo se área e cargo existem. */
export async function resolverPerfilPessoa(factory: RepositoryFactoryInterface, entrada: EntradaPerfilPessoa): Promise<DetalhesPessoa> {
    const detalhes: DetalhesPessoa = {};
    const copiar = [
        "nomeExibicao",
        "telefone",
        "linkedinUrl",
        "calendarioUrl",
        "githubUrl",
        "curso",
        "semestre",
        "dataEntrada",
        "bio",
    ] as const;
    for (const campo of copiar) {
        if (entrada[campo] !== undefined) (detalhes as any)[campo] = entrada[campo];
    }

    if (entrada.codigoArea !== undefined) {
        if (entrada.codigoArea) {
            const area = await factory.criarAreaRepository().buscarPorCodigo(entrada.codigoArea);
            if (!area) throw new ErroNaoEncontrado("Área não encontrada.");
            detalhes.area = area;
        } else {
            detalhes.area = null;
        }
    }

    if (entrada.codigoCargo !== undefined) {
        if (entrada.codigoCargo) {
            const cargo = await factory.criarCargoRepository().buscarPorCodigo(entrada.codigoCargo);
            if (!cargo) throw new ErroNaoEncontrado("Cargo não encontrado.");
            detalhes.cargo = cargo;
        } else {
            detalhes.cargo = null;
        }
    }

    return detalhes;
}

/** Trainee (sessão 20) é sempre membro: 400 se o status for trainee e o perfil, outro. */
export function exigirTraineeMembro(status: StatusPessoa | string, perfil: PerfilUsuario | string): void {
    if (status === StatusPessoa.TRAINEE && perfil !== PerfilUsuario.MEMBRO) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.TRAINEE_SO_MEMBRO, "TRAINEE_SO_MEMBRO");
    }
}

export function lerStatusPessoa(valor: unknown): StatusPessoa | undefined {
    if (valor === undefined || valor === null || valor === "") return undefined;
    if (!Object.values(StatusPessoa).includes(valor as StatusPessoa)) {
        throw new ErroValidacao("Status de pessoa inválido. Use ativo, trainee, alumni ou inativo.", "STATUS_PESSOA_INVALIDO");
    }
    return valor as StatusPessoa;
}
