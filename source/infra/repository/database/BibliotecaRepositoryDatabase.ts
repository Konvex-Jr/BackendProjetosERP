import ItemBiblioteca from "../../../domain/entity/ItemBiblioteca";
import BibliotecaRepositoryInterface, { FiltrosBiblioteca } from "../../../domain/interfaces/BibliotecaRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

const SELECT = `
    SELECT b.codigo, b.titulo, b.conteudo, b.links, b.tags, b.sigilo, b.criado_em, b.atualizado_em,
           b.projeto_codigo, p.nome AS projeto_nome, b.autor_codigo, u.nome AS autor_nome
    FROM biblioteca_itens b
    LEFT JOIN projetos p ON p.codigo = b.projeto_codigo
    LEFT JOIN usuarios u ON u.codigo = b.autor_codigo
`;

function daLinha(l: any): ItemBiblioteca {
    return new ItemBiblioteca({
        codigo: l.codigo,
        titulo: l.titulo,
        conteudo: l.conteudo,
        links: l.links ?? [],
        tags: l.tags ?? [],
        sigilo: l.sigilo,
        projeto: l.projeto_codigo ? { codigo: l.projeto_codigo, nome: l.projeto_nome } : null,
        autor: l.autor_codigo ? { codigo: l.autor_codigo, nome: l.autor_nome } : null,
        criadoEm: l.criado_em,
        atualizadoEm: l.atualizado_em,
    });
}

/** Escapa % e _ para o ILIKE procurar o texto literal. */
const literal = (texto: string) => `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export default class BibliotecaRepositoryDatabase implements BibliotecaRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async criar(item: ItemBiblioteca): Promise<ItemBiblioteca> {
        await this.conexao.consultar(
            `INSERT INTO biblioteca_itens (codigo, titulo, conteudo, links, tags, projeto_codigo, sigilo, autor_codigo, criado_em, atualizado_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                item.codigo,
                item.titulo,
                item.conteudo,
                item.links,
                item.tags,
                item.projeto?.codigo ?? null,
                item.sigilo,
                item.autor?.codigo ?? null,
                item.criadoEm,
                item.atualizadoEm,
            ],
        );
        return (await this.buscarPorCodigo(item.codigo)) ?? item;
    }

    async listar(f: FiltrosBiblioteca = {}): Promise<ItemBiblioteca[]> {
        const condicoes: string[] = [];
        const valores: unknown[] = [];
        const param = (valor: unknown) => {
            valores.push(valor);
            return `$${valores.length}`;
        };

        if (f.busca) {
            const p = param(literal(f.busca));
            condicoes.push(`(b.titulo ILIKE ${p} OR b.conteudo ILIKE ${p} OR EXISTS (SELECT 1 FROM unnest(b.tags) t WHERE t ILIKE ${p}))`);
        }
        if (f.tag) condicoes.push(`${param(f.tag.toLowerCase())} = ANY(b.tags)`);
        if (f.codigoProjeto) condicoes.push(`b.projeto_codigo::text = ${param(f.codigoProjeto)}`);
        if (f.sigilo) condicoes.push(`b.sigilo = ${param(f.sigilo)}`);
        if (f.codigoAutor) condicoes.push(`b.autor_codigo::text = ${param(f.codigoAutor)}`);

        const onde = condicoes.length ? ` WHERE ${condicoes.join(" AND ")}` : "";
        const linhas = await this.conexao.consultar(`${SELECT}${onde} ORDER BY b.atualizado_em DESC, b.criado_em DESC`, valores);
        return linhas.map(daLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<ItemBiblioteca | null> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE b.codigo::text = $1`, [codigo]);
        return linhas.length ? daLinha(linhas[0]) : null;
    }

    async editar(item: ItemBiblioteca): Promise<ItemBiblioteca> {
        const linhas = await this.conexao.consultar(
            `UPDATE biblioteca_itens SET titulo = $2, conteudo = $3, links = $4, tags = $5, projeto_codigo = $6,
                    sigilo = $7, atualizado_em = $8
             WHERE codigo = $1 RETURNING codigo`,
            [item.codigo, item.titulo, item.conteudo, item.links, item.tags, item.projeto?.codigo ?? null, item.sigilo, item.atualizadoEm],
        );
        if (linhas.length === 0) throw new ErroNaoEncontrado("Item não encontrado.");
        return (await this.buscarPorCodigo(item.codigo)) ?? item;
    }

    async excluir(codigo: string): Promise<void> {
        await this.conexao.consultar("DELETE FROM biblioteca_itens WHERE codigo::text = $1", [codigo]);
    }

    async desligarProjeto(codigoProjeto: string): Promise<void> {
        await this.conexao.consultar(
            "UPDATE biblioteca_itens SET projeto_codigo = NULL WHERE projeto_codigo::text = $1 AND sigilo <> 'projeto'",
            [codigoProjeto],
        );
    }
}
