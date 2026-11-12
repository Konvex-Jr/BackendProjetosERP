import Habilidade from "../entity/Habilidade";
import TipoHabilidade from "../enum/TipoHabilidade";

export default interface HabilidadeRepositoryInterface {
    listar(): Promise<Habilidade[]>;
    /** Devolve a habilidade com esse nome e tipo (sem diferenciar maiúsculas), criando-a se não existir. */
    garantir(nome: string, tipo: TipoHabilidade): Promise<Habilidade>;
}
