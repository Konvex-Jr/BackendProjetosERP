import Capacitacao from "../../../domain/Entity/Capacitacao";
import { Referencia } from "../../../domain/Entity/Conhecimento";
import CapacitacaoRepositoryInterface from "../../../domain/Interfaces/CapacitacaoRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";

const NOME = "COALESCE(NULLIF(u.nome_exibicao, ''), u.nome)";

const SELECT = `
    SELECT c.codigo, c.titulo, c.descricao, c.data, to_char(c.hora, 'HH24:MI') AS hora,
           c.duracao_horas, c.vagas, c.tipo, c.sala,
           c.instrutor_codigo, (SELECT ${NOME} FROM usuarios u WHERE u.codigo = c.instrutor_codigo) AS instrutor_nome,
           COALESCE((
               SELECT json_agg(json_build_object('codigo', u.codigo, 'nome', ${NOME}, 'presente', i.presente) ORDER BY i.inscrito_em)
               FROM capacitacao_inscricoes i JOIN usuarios u ON u.codigo = i.usuario_codigo
               WHERE i.capacitacao_codigo = c.codigo
           ), '[]'::json) AS inscricoes
    FROM capacitacoes c
`;

function deLinha(l: any): Capacitacao {
    return new Capacitacao({
        codigo: l.codigo,
        titulo: l.titulo,
        descricao: l.descricao,
        data: l.data,
        hora: l.hora,
        duracaoHoras: Number(l.duracao_horas),
        instrutor: { codigo: l.instrutor_codigo, nome: l.instrutor_nome ?? "" },
        vagas: l.vagas,
        tipo: l.tipo,
        sala: l.sala,
        inscricoes: (l.inscricoes ?? []).map((i: any) => ({ usuario: { codigo: i.codigo, nome: i.nome }, presente: i.presente })),
    });
}

const valores = (c: Capacitacao) => [
    c.codigo,
    c.titulo,
    c.descricao,
    dataParaSql(c.data),
    c.hora,
    c.duracaoHoras,
    c.instrutor.codigo,
    c.vagas,
    c.tipo,
    c.sala,
];

export default class CapacitacaoRepositoryDatabase implements CapacitacaoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async listar(): Promise<Capacitacao[]> {
        return (await this.conexao.consultar(`${SELECT} ORDER BY c.data, c.hora`)).map(deLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<Capacitacao | null> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE c.codigo::text = $1`, [codigo]);
        return linhas[0] ? deLinha(linhas[0]) : null;
    }

    async criar(c: Capacitacao): Promise<Capacitacao> {
        await this.conexao.consultar(
            `INSERT INTO capacitacoes (codigo, titulo, descricao, data, hora, duracao_horas, instrutor_codigo, vagas, tipo, sala)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            valores(c),
        );
        return (await this.buscarPorCodigo(c.codigo))!;
    }

    async editar(c: Capacitacao): Promise<Capacitacao> {
        const linhas = await this.conexao.consultar(
            `UPDATE capacitacoes SET titulo = $2, descricao = $3, data = $4, hora = $5, duracao_horas = $6,
                 instrutor_codigo = $7, vagas = $8, tipo = $9, sala = $10
             WHERE codigo = $1 RETURNING codigo`,
            valores(c),
        );
        if (linhas.length === 0) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CAPACITACAO.NAO_ENCONTRADA);
        return (await this.buscarPorCodigo(c.codigo))!;
    }

    async excluir(codigo: string): Promise<void> {
        // Inscrições e avaliações saem junto (ON DELETE CASCADE); os anexos, pelo caso de uso.
        await this.conexao.consultar("DELETE FROM capacitacoes WHERE codigo::text = $1", [codigo]);
    }

    async inscrever(codigo: string, usuario: Referencia): Promise<boolean> {
        // A vaga é conferida no mesmo comando, para duas inscrições ao mesmo tempo não passarem do limite.
        const linhas = await this.conexao.consultar(
            `INSERT INTO capacitacao_inscricoes (capacitacao_codigo, usuario_codigo)
             SELECT c.codigo, $2::uuid FROM capacitacoes c
             WHERE c.codigo = $1::uuid
               AND (SELECT count(*) FROM capacitacao_inscricoes i WHERE i.capacitacao_codigo = c.codigo) < c.vagas
             ON CONFLICT DO NOTHING
             RETURNING usuario_codigo`,
            [codigo, usuario.codigo],
        );
        return linhas.length > 0;
    }

    async cancelarInscricao(codigo: string, codigoUsuario: string): Promise<void> {
        await this.conexao.consultar(
            "DELETE FROM capacitacao_inscricoes WHERE capacitacao_codigo = $1::uuid AND usuario_codigo = $2::uuid",
            [codigo, codigoUsuario],
        );
    }

    async marcarPresencas(codigo: string, presentes: string[]): Promise<void> {
        await this.conexao.consultar(
            `UPDATE capacitacao_inscricoes SET presente = (usuario_codigo::text = ANY($2::text[]))
             WHERE capacitacao_codigo = $1::uuid`,
            [codigo, presentes],
        );
    }
}
