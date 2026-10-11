import CapacitacaoFeedback from "../../../domain/Entity/CapacitacaoFeedback";
import CapacitacaoFeedbackRepositoryInterface from "../../../domain/Interfaces/CapacitacaoFeedbackRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql, violacaoDeUnicidade } from "../../database/conversoes";
import { carregarCapacitacoes, carregarUsuarios } from "./carregadores";

const SELECT_FEEDBACK = `
    SELECT codigo, capacitacao_codigo, usuario_codigo, nota, bom, melhorar, data
    FROM capacitacao_feedbacks
`;

export default class CapacitacaoFeedbackRepositoryDatabase implements CapacitacaoFeedbackRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback> {
        try {
            await this.conexao.consultar(
                `INSERT INTO capacitacao_feedbacks
                    (codigo, capacitacao_codigo, usuario_codigo, nota, bom, melhorar, data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    feedback.codigo,
                    feedback.capacitacao.codigo,
                    feedback.usuario.codigo,
                    feedback.nota,
                    feedback.bom,
                    feedback.melhorar,
                    dataParaSql(feedback.data),
                ],
            );
        } catch (erro) {
            if (violacaoDeUnicidade(erro)) {
                throw new Error("Já existe feedback deste usuário para a capacitação");
            }
            throw erro;
        }

        return feedback;
    }

    async editar(feedback: CapacitacaoFeedback): Promise<CapacitacaoFeedback> {
        const linhas = await this.conexao.consultar(
            `UPDATE capacitacao_feedbacks
             SET nota = $2, bom = $3, melhorar = $4, data = $5
             WHERE codigo = $1
             RETURNING codigo`,
            [
                feedback.codigo,
                feedback.nota,
                feedback.bom,
                feedback.melhorar,
                dataParaSql(feedback.data),
            ],
        );

        if (linhas.length === 0) {
            throw new Error("Feedback não encontrado");
        }

        return feedback;
    }

    async listar(): Promise<CapacitacaoFeedback[]> {
        const linhas = await this.conexao.consultar(`${SELECT_FEEDBACK} ORDER BY data DESC`);
        return this.hidratar(linhas);
    }

    async listarPorUsuario(codigoUsuario: string): Promise<CapacitacaoFeedback[]> {
        const linhas = await this.conexao.consultar(
            `${SELECT_FEEDBACK} WHERE usuario_codigo = $1 ORDER BY data DESC`,
            [codigoUsuario],
        );
        return this.hidratar(linhas);
    }

    async buscarPorCapacitacaoEUsuario(
        codigoCapacitacao: string,
        codigoUsuario: string,
    ): Promise<CapacitacaoFeedback | null> {
        const linhas = await this.conexao.consultar(
            `${SELECT_FEEDBACK} WHERE capacitacao_codigo = $1 AND usuario_codigo = $2`,
            [codigoCapacitacao, codigoUsuario],
        );
        const feedbacks = await this.hidratar(linhas);
        return feedbacks[0] ?? null;
    }

    private async hidratar(linhas: any[]): Promise<CapacitacaoFeedback[]> {
        const capacitacoes = await carregarCapacitacoes(
            this.conexao,
            linhas.map((l) => l.capacitacao_codigo),
        );
        const usuarios = await carregarUsuarios(
            this.conexao,
            linhas.map((l) => l.usuario_codigo),
        );

        return linhas.map(
            (l) =>
                new CapacitacaoFeedback(
                    capacitacoes.get(l.capacitacao_codigo)!,
                    usuarios.get(l.usuario_codigo)!,
                    l.nota,
                    l.data,
                    l.bom,
                    l.melhorar,
                    l.codigo,
                ),
        );
    }
}
