import { HORAS_PADRAO, HorasPorDificuldade, NIVEIS_DIFICULDADE } from "../../../domain/enum/DificuldadeTarefa";
import HorasDificuldadeRepositoryInterface from "../../../domain/interfaces/HorasDificuldadeRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

export default class HorasDificuldadeRepositoryDatabase implements HorasDificuldadeRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async listar(): Promise<HorasPorDificuldade> {
        const linhas = await this.conexao.consultar("SELECT dificuldade, horas FROM horas_dificuldade");
        const horas = { ...HORAS_PADRAO };
        // NUMERIC chega como texto do pg.
        for (const l of linhas) horas[l.dificuldade as keyof HorasPorDificuldade] = Number(l.horas);
        return horas;
    }

    async salvar(horas: HorasPorDificuldade): Promise<void> {
        await this.conexao.transacao(async (conexao) => {
            for (const nivel of NIVEIS_DIFICULDADE) {
                await conexao.consultar(
                    `INSERT INTO horas_dificuldade (dificuldade, horas) VALUES ($1, $2)
                     ON CONFLICT (dificuldade) DO UPDATE SET horas = EXCLUDED.horas`,
                    [nivel, horas[nivel]],
                );
            }
        });
    }
}
