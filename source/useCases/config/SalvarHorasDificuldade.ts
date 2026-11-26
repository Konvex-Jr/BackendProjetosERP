import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { PercentualPorDificuldade, NIVEIS_DIFICULDADE } from "../../domain/enum/DificuldadeTarefa";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { exigirPermissao, Permissao, UsuarioAutenticado } from "../../shared/seguranca/permissoes";

export const SO_DIRETOR_HORAS = "Somente diretores configuram a dificuldade das tarefas.";

/** Grava a % do dia dos quatro níveis de dificuldade (todos obrigatórios, inteiros de 5 a 100). */
export default class SalvarHorasDificuldade {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: { horas: unknown; quem: UsuarioAutenticado | undefined | null }): Promise<PercentualPorDificuldade> {
        exigirPermissao(input.quem, Permissao.CONFIGURACOES_EDITAR, SO_DIRETOR_HORAS);
        const bruto = (input.horas ?? {}) as Record<string, unknown>;
        const horas = {} as PercentualPorDificuldade;
        for (const nivel of NIVEIS_DIFICULDADE) {
            const valor = bruto[nivel];
            if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 5 || valor > 100) {
                throw new ErroValidacao(MENSAGENS_DE_ERRO.HORAS_DIFICULDADE.INVALIDAS(nivel), "HORAS_DIFICULDADE_INVALIDAS");
            }
            horas[nivel] = valor;
        }
        await this.factory.criarHorasDificuldadeRepository().salvar(horas);
        return horas;
    }
}
