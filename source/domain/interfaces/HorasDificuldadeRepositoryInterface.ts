import { HorasPorDificuldade } from "../enum/DificuldadeTarefa";

/** Horas que cada nível de dificuldade vale (uma linha por nível; sempre os quatro). */
export default interface HorasDificuldadeRepositoryInterface {
    listar(): Promise<HorasPorDificuldade>;
    salvar(horas: HorasPorDificuldade): Promise<void>;
}
