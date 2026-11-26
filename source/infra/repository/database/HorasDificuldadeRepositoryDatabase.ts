import { PERCENTUAL_PADRAO, PercentualPorDificuldade, NIVEIS_DIFICULDADE } from "../../../domain/enum/DificuldadeTarefa";
import HorasDificuldadeRepositoryInterface from "../../../domain/interfaces/HorasDificuldadeRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

export default class HorasDificuldadeRepositoryDatabase implements HorasDificuldadeRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async listar(): Promise<PercentualPorDificuldade> {
        const linhas = await this.conexao.consultar("SELECT dificuldade, percentual FROM horas_dificuldade");
        const horas = { ...PERCENTUAL_PADRAO };
        for (const l of linhas) horas[l.dificuldade as keyof PercentualPorDificuldade] = Number(l.percentual);
        return horas;
    }

    async salvar(horas: PercentualPorDificuldade): Promise<void> {
        await this.conexao.transacao(async (conexao) => {
            for (const nivel of NIVEIS_DIFICULDADE) {
                await conexao.consultar(
                    `INSERT INTO horas_dificuldade (dificuldade, percentual) VALUES ($1, $2)
                     ON CONFLICT (dificuldade) DO UPDATE SET percentual = EXCLUDED.percentual`,
                    [nivel, horas[nivel]],
                );
            }
        });
    }
}
