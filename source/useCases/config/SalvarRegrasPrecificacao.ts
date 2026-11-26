import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { RegrasPrecificacao, validarRegrasPrecificacao } from "../../domain/entity/RegrasPrecificacao";
import { exigirPermissao, Permissao, UsuarioAutenticado } from "../../shared/seguranca/permissoes";

export const SO_DIRETOR_PRECIFICACAO = "Somente diretores configuram as regras da precificação.";
export const SO_QUEM_SIMULA = "Somente quem simula a precificação vê as regras.";

/** Lê (quem simula) e grava (diretores) as regras da simulação de precificação. */
export default class SalvarRegrasPrecificacao {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async obter(quem: UsuarioAutenticado | undefined | null): Promise<RegrasPrecificacao> {
        exigirPermissao(quem, Permissao.PRECIFICACAO_SIMULAR, SO_QUEM_SIMULA);
        return this.factory.criarRegrasPrecificacaoRepository().obter();
    }

    async execute(input: { regras: unknown; quem: UsuarioAutenticado | undefined | null }): Promise<RegrasPrecificacao> {
        exigirPermissao(input.quem, Permissao.CONFIG_PRECIFICACAO, SO_DIRETOR_PRECIFICACAO);
        const regras = validarRegrasPrecificacao(input.regras);
        await this.factory.criarRegrasPrecificacaoRepository().salvar(regras);
        return regras;
    }
}
