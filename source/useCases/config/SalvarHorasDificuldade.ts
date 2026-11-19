import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { HorasPorDificuldade, NIVEIS_DIFICULDADE } from "../../domain/enum/DificuldadeTarefa";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { exigirPermissao, Permissao, UsuarioAutenticado } from "../../shared/seguranca/permissoes";

export const SO_DIRETOR_HORAS = "Somente diretores configuram as horas por dificuldade.";

/** Grava as horas dos quatro níveis de dificuldade (todos obrigatórios, de 0,5 a 40). */
export default class SalvarHorasDificuldade {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: { horas: unknown; quem: UsuarioAutenticado | undefined | null }): Promise<HorasPorDificuldade> {
        exigirPermissao(input.quem, Permissao.CONFIGURACOES_EDITAR, SO_DIRETOR_HORAS);
        const bruto = (input.horas ?? {}) as Record<string, unknown>;
        const horas = {} as HorasPorDificuldade;
        for (const nivel of NIVEIS_DIFICULDADE) {
            const valor = bruto[nivel];
            if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0.5 || valor > 40) {
                throw new ErroValidacao(MENSAGENS_DE_ERRO.HORAS_DIFICULDADE.INVALIDAS(nivel), "HORAS_DIFICULDADE_INVALIDAS");
            }
            // A coluna é NUMERIC(4,1): uma casa decimal.
            horas[nivel] = Math.round(valor * 10) / 10;
        }
        await this.factory.criarHorasDificuldadeRepository().salvar(horas);
        return horas;
    }
}
