import Iniciativa from "../../../domain/entity/Iniciativa";
import IniciativaRepositoryInterface, { FiltrosIniciativa } from "../../../domain/interfaces/IniciativaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSqlOuNulo } from "../../database/conversoes";

// Subconsultas (e não JOIN + GROUP BY) para as duas listas não se multiplicarem.
const SELECT = `
    SELECT i.*, r.nome AS responsavel_nome, c.nome AS criado_por_nome,
           COALESCE((SELECT json_agg(json_build_object('codigo', p.codigo, 'nome', p.nome) ORDER BY p.nome)
                     FROM iniciativa_projetos ip JOIN projetos p ON p.codigo = ip.projeto_codigo
                     WHERE ip.iniciativa_codigo = i.codigo), '[]') AS projetos,
           COALESCE((SELECT json_agg(json_build_object('codigo', k.codigo, 'nome', k.titulo) ORDER BY k.titulo)
                     FROM iniciativa_conhecimentos ik JOIN conhecimentos k ON k.codigo = ik.conhecimento_codigo
                     WHERE ik.iniciativa_codigo = i.codigo), '[]') AS conhecimentos
    FROM iniciativas i
    LEFT JOIN usuarios r ON r.codigo = i.responsavel_codigo
    LEFT JOIN usuarios c ON c.codigo = i.criado_por_codigo
`;

function daLinha(l: any): Iniciativa {
    return new Iniciativa({
        codigo: l.codigo,
        titulo: l.titulo,
        descricao: l.descricao,
        tipo: l.tipo,
        frente: l.frente,
        status: l.status,
        responsavel: l.responsavel_codigo ? { codigo: l.responsavel_codigo, nome: l.responsavel_nome } : null,
        criadoPor: l.criado_por_codigo ? { codigo: l.criado_por_codigo, nome: l.criado_por_nome } : null,
        dataInicio: l.data_inicio,
        dataFim: l.data_fim,
        resultado: l.resultado,
        aprendizados: l.aprendizados,
        projetos: l.projetos ?? [],
        conhecimentos: l.conhecimentos ?? [],
        criadoEm: l.criado_em,
        atualizadoEm: l.atualizado_em,
    });
}

/** Escapa % e _ para o ILIKE procurar o texto literal. */
const literal = (texto: string) => `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export default class IniciativaRepositoryDatabase implements IniciativaRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    private async gravarLigacoes(conexao: ConexaoBanco, item: Iniciativa): Promise<void> {
        await conexao.consultar("DELETE FROM iniciativa_projetos WHERE iniciativa_codigo = $1", [item.codigo]);
        await conexao.consultar("DELETE FROM iniciativa_conhecimentos WHERE iniciativa_codigo = $1", [item.codigo]);
        await conexao.consultar("INSERT INTO iniciativa_projetos (iniciativa_codigo, projeto_codigo) SELECT $1::uuid, unnest($2::uuid[])", [
            item.codigo,
            item.projetos.map((p) => p.codigo),
        ]);
        await conexao.consultar(
            "INSERT INTO iniciativa_conhecimentos (iniciativa_codigo, conhecimento_codigo) SELECT $1::uuid, unnest($2::uuid[])",
            [item.codigo, item.conhecimentos.map((c) => c.codigo)],
        );
    }

    private valores(item: Iniciativa): unknown[] {
        return [
            item.codigo,
            item.titulo,
            item.descricao,
            item.tipo,
            item.frente,
            item.status,
            item.responsavel?.codigo ?? null,
            dataParaSqlOuNulo(item.dataInicio),
            dataParaSqlOuNulo(item.dataFim),
            item.resultado,
            item.aprendizados,
            item.atualizadoEm,
        ];
    }

    async criar(item: Iniciativa): Promise<Iniciativa> {
        await this.conexao.transacao(async (conexao) => {
            await conexao.consultar(
                `INSERT INTO iniciativas (codigo, titulo, descricao, tipo, frente, status, responsavel_codigo,
                                          data_inicio, data_fim, resultado, aprendizados, atualizado_em,
                                          criado_por_codigo, criado_em)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [...this.valores(item), item.criadoPor?.codigo ?? null, item.criadoEm],
            );
            await this.gravarLigacoes(conexao, item);
        });
        return (await this.buscarPorCodigo(item.codigo)) ?? item;
    }

    async listar(f: FiltrosIniciativa = {}): Promise<Iniciativa[]> {
        const condicoes: string[] = [];
        const valores: unknown[] = [];
        const param = (valor: unknown) => {
            valores.push(valor);
            return `$${valores.length}`;
        };

        if (f.busca) {
            const p = param(literal(f.busca));
            condicoes.push(`(i.titulo ILIKE ${p} OR i.descricao ILIKE ${p} OR i.resultado ILIKE ${p} OR i.aprendizados ILIKE ${p})`);
        }
        if (f.status) condicoes.push(`i.status = ${param(f.status)}`);
        if (f.tipo) condicoes.push(`i.tipo = ${param(f.tipo)}`);
        if (f.frente) condicoes.push(`i.frente = ${param(f.frente)}`);
        if (f.codigoResponsavel) condicoes.push(`i.responsavel_codigo::text = ${param(f.codigoResponsavel)}`);
        if (f.codigoProjeto) {
            condicoes.push(`EXISTS (SELECT 1 FROM iniciativa_projetos x
                WHERE x.iniciativa_codigo = i.codigo AND x.projeto_codigo::text = ${param(f.codigoProjeto)})`);
        }
        if (f.codigoConhecimento) {
            condicoes.push(`EXISTS (SELECT 1 FROM iniciativa_conhecimentos x
                WHERE x.iniciativa_codigo = i.codigo AND x.conhecimento_codigo::text = ${param(f.codigoConhecimento)})`);
        }

        const onde = condicoes.length ? ` WHERE ${condicoes.join(" AND ")}` : "";
        const linhas = await this.conexao.consultar(`${SELECT}${onde} ORDER BY i.atualizado_em DESC`, valores);
        return linhas.map(daLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<Iniciativa | null> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE i.codigo::text = $1`, [codigo]);
        return linhas.length ? daLinha(linhas[0]) : null;
    }

    async editar(item: Iniciativa): Promise<Iniciativa> {
        await this.conexao.transacao(async (conexao) => {
            const linhas = await conexao.consultar(
                `UPDATE iniciativas SET titulo = $2, descricao = $3, tipo = $4, frente = $5, status = $6,
                        responsavel_codigo = $7, data_inicio = $8, data_fim = $9, resultado = $10,
                        aprendizados = $11, atualizado_em = $12
                 WHERE codigo = $1 RETURNING codigo`,
                this.valores(item),
            );
            if (linhas.length === 0) throw new Error("Iniciativa não encontrada");
            await this.gravarLigacoes(conexao, item);
        });
        return (await this.buscarPorCodigo(item.codigo)) ?? item;
    }

    async excluir(codigo: string): Promise<void> {
        await this.conexao.consultar("DELETE FROM iniciativas WHERE codigo = $1", [codigo]);
    }
}
