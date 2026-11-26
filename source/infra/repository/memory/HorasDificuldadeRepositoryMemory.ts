import { PERCENTUAL_PADRAO, PercentualPorDificuldade } from "../../../domain/enum/DificuldadeTarefa";
import HorasDificuldadeRepositoryInterface from "../../../domain/interfaces/HorasDificuldadeRepositoryInterface";

export default class HorasDificuldadeRepositoryMemory implements HorasDificuldadeRepositoryInterface {
    private horas: PercentualPorDificuldade = { ...PERCENTUAL_PADRAO };

    async listar(): Promise<PercentualPorDificuldade> {
        return { ...this.horas };
    }

    async salvar(horas: PercentualPorDificuldade): Promise<void> {
        this.horas = { ...horas };
    }
}
