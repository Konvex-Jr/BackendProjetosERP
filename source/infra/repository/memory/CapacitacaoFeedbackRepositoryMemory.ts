import CapacitacaoFeedback from "../../../domain/entity/CapacitacaoFeedback";
import CapacitacaoFeedbackRepositoryInterface, { ResumoAvaliacao } from "../../../domain/interfaces/CapacitacaoFeedbackRepositoryInterface";

export default class CapacitacaoFeedbackRepositoryMemory implements CapacitacaoFeedbackRepositoryInterface {
    private itens: CapacitacaoFeedback[] = [];

    async salvar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback> {
        this.itens = this.itens.filter(
            (f) => !(f.codigoCapacitacao === feedback.codigoCapacitacao && f.usuario.codigo === feedback.usuario.codigo),
        );
        this.itens.push(feedback);
        return feedback;
    }

    async listarPorCapacitacao(codigoCapacitacao: string): Promise<CapacitacaoFeedback[]> {
        return this.itens.filter((f) => f.codigoCapacitacao === codigoCapacitacao).sort((a, b) => b.data.getTime() - a.data.getTime());
    }

    async buscarPorCapacitacaoEUsuario(codigoCapacitacao: string, codigoUsuario: string): Promise<CapacitacaoFeedback | null> {
        return this.itens.find((f) => f.codigoCapacitacao === codigoCapacitacao && f.usuario.codigo === codigoUsuario) ?? null;
    }

    async resumos(codigos: string[]): Promise<Map<string, ResumoAvaliacao>> {
        const mapa = new Map<string, ResumoAvaliacao>();
        for (const codigo of codigos) {
            const notas = this.itens.filter((f) => f.codigoCapacitacao === codigo).map((f) => f.nota);
            mapa.set(codigo, {
                total: notas.length,
                media: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null,
            });
        }
        return mapa;
    }
}
