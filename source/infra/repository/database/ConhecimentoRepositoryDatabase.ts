import Conhecimento from "../../../domain/Entity/Conhecimento";
import ConhecimentoRepositoryInterface, { FiltrosConhecimento } from "../../../domain/Interfaces/ConhecimentoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";

const SELECT = `
    SELECT c.codigo, c.titulo, c.categoria, c.resumo, c.conteudo, c.fonte, c.links, c.tags, c.data,
           c.criado_em, c.atualizado_em, c.autor_codigo, u.nome AS autor_nome,
           COALESCE(
               json_agg(json_build_object('codigo', p.codigo, 'nome', p.nome) ORDER BY p.nome)
                   FILTER (WHERE p.codigo IS NOT NULL),
               '[]'
           ) AS projetos
    FROM conhecimentos c
    LEFT JOIN usuarios u ON u.codigo = c.autor_codigo
    LEFT JOIN conhecimento_projetos cp ON cp.conhecimento_codigo = c.codigo
    LEFT JOIN projetos p ON p.codigo = cp.projeto_codigo
`;
const AGRUPAR = " GROUP BY c.codigo, u.nome ";

function daLinha(l: any): Conhecimento {
    return new Conhecimento({
        codigo: l.codigo,
        titulo: l.titulo,
        categoria: l.categoria,
        resumo: l.resumo,
        conteudo: l.conteudo,
        fonte: l.fonte,
        links: l.links ?? [],
        tags: l.tags ?? [],
        data: l.data,
        autor: l.autor_codigo ? { codigo: l.autor_codigo, nome: l.autor_nome } : null,
        projetos: l.projetos ?? [],
        criadoEm: l.criado_em,
        atualizadoEm: l.atualizado_em,
    });
}

/** Escapa % e _ para o ILIKE procurar o texto literal. */
const literal = (texto: string) => `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export default class ConhecimentoRepositoryDatabase implements ConhecimentoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    private async gravarProjetos(conexao: ConexaoBanco, item: Conhecimento): Promise<void> {
        await conexao.consultar("DELETE FROM conhecimento_projetos WHERE conhecimento_codigo = $1", [item.codigo]);
        for (const projeto of item.projetos) {
            await conexao.consultar(
                "INSERT INTO conhecimento_projetos (conhecimento_codigo, projeto_codigo) VALUES ($1, $2)",
                [item.codigo, projeto.codigo],
            );
        }
    }

    async criar(item: Conhecimento): Promise<Conhecimento> {
        await this.conexao.transacao(async (conexao) => {
            await conexao.consultar(
                `INSERT INTO conhecimentos (codigo, titulo, categoria, resumo, conteudo, autor_codigo, fonte, links, tags, data, criado_em, atualizado_em)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [item.codigo, item.titulo, item.categoria, item.resumo, item.conteudo, item.autor?.codigo ?? null,
                    item.fonte, item.links, item.tags, dataParaSql(item.data), item.criadoEm, item.atualizadoEm],
            );
            await this.gravarProjetos(conexao, item);
        });
        return (await this.buscarPorCodigo(item.codigo)) ?? item;
    }

    async listar(f: FiltrosConhecimento = {}): Promise<Conhecimento[]> {
        const condicoes: string[] = [];
        const valores: unknown[] = [];
        const param = (valor: unknown) => {
            valores.push(valor);
            return `$${valores.length}`;
        };

        if (f.busca) {
            const p = param(literal(f.busca));
            condicoes.push(`(c.titulo ILIKE ${p} OR c.resumo ILIKE ${p} OR c.conteudo ILIKE ${p} OR array_to_string(c.tags, ' ') ILIKE ${p})`);
        }
        if (f.categoria) condicoes.push(`c.categoria = ${param(f.categoria)}`);
        if (f.tag) condicoes.push(`${param(f.tag.toLowerCase())} = ANY(c.tags)`);
        if (f.codigoAutor) condicoes.push(`c.autor_codigo::text = ${param(f.codigoAutor)}`);
        if (f.codigoProjeto) {
            condicoes.push(`EXISTS (SELECT 1 FROM conhecimento_projetos x
                WHERE x.conhecimento_codigo = c.codigo AND x.projeto_codigo::text = ${param(f.codigoProjeto)})`);
        }
        if (f.de) condicoes.push(`c.data >= ${param(dataParaSql(f.de))}`);
        if (f.ate) condicoes.push(`c.data <= ${param(dataParaSql(f.ate))}`);

        const onde = condicoes.length ? ` WHERE ${condicoes.join(" AND ")}` : "";
        const linhas = await this.conexao.consultar(`${SELECT}${onde}${AGRUPAR} ORDER BY c.data DESC, c.criado_em DESC`, valores);
        return linhas.map(daLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<Conhecimento | null> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE c.codigo::text = $1 ${AGRUPAR}`, [codigo]);
        return linhas.length ? daLinha(linhas[0]) : null;
    }

    async editar(item: Conhecimento): Promise<Conhecimento> {
        await this.conexao.transacao(async (conexao) => {
            const linhas = await conexao.consultar(
                `UPDATE conhecimentos SET titulo = $2, categoria = $3, resumo = $4, conteudo = $5, fonte = $6,
                        links = $7, tags = $8, data = $9, atualizado_em = $10
                 WHERE codigo = $1 RETURNING codigo`,
                [item.codigo, item.titulo, item.categoria, item.resumo, item.conteudo, item.fonte,
                    item.links, item.tags, dataParaSql(item.data), item.atualizadoEm],
            );
            if (linhas.length === 0) throw new Error("Item não encontrado");
            await this.gravarProjetos(conexao, item);
        });
        return (await this.buscarPorCodigo(item.codigo)) ?? item;
    }

    async excluir(codigo: string): Promise<void> {
        await this.conexao.consultar("DELETE FROM conhecimentos WHERE codigo = $1", [codigo]);
    }
}
