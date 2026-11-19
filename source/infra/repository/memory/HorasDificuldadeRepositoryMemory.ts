import { HORAS_PADRAO, HorasPorDificuldade } from "../../../domain/enum/DificuldadeTarefa";
import HorasDificuldadeRepositoryInterface from "../../../domain/interfaces/HorasDificuldadeRepositoryInterface";

export default class HorasDificuldadeRepositoryMemory implements HorasDificuldadeRepositoryInterface {
    private horas: HorasPorDificuldade = { ...HORAS_PADRAO };

    async listar(): Promise<HorasPorDificuldade> {
        return { ...this.horas };
    }

    async salvar(horas: HorasPorDificuldade): Promise<void> {
        this.horas = { ...horas };
    }
}
