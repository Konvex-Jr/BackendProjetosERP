import Projeto from "../../../domain/entity/Projeto";
import ProjetoRepositoryInterface, { FiltroProjetos } from "../../../domain/interfaces/ProjetoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql, dataParaSqlOuNulo, violacaoDeUnicidade } from "../../database/conversoes";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { normalizarBusca } from "../../../shared/texto";
import { carregarProjetos } from "./carregadores";
import { validarColunas } from "../../../domain/entity/ColunaProjeto";

const COLUNAS = `nome, descricao, data_inicio, data_fim, status, referencia, objetivo, cliente_nome,
    prioridade, progresso, area_codigo, tags, lider_codigo, criado_por_codigo,
    tipo, geral_da_area`;

function valores(projeto: Projeto): unknown[] {
    return [
        projeto.nome,
        projeto.descricao,
        dataParaSql(projeto.dataInicio),
        dataParaSql(projeto.dataFim),
        projeto.status,
        projeto.referencia,
        projeto.objetivo,
        projeto.clienteNome,
        projeto.prioridade,
        projeto.progresso,
        projeto.area?.codigo ?? null,
        projeto.tags,
        // O geral não tem líder gravado: quem lidera vem dos períodos da área.
        projeto.geralDaArea ? null : (projeto.lider?.codigo ?? null),
        projeto.criadoPor,
        projeto.tipo,
        projeto.geralDaArea,
    ];
}

export default class ProjetoRepositoryDatabase implements ProjetoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async criar(projeto: Projeto): Promise<Projeto> {
        await this.gravar(async (conexao) => {
            await conexao.consultar(
                `INSERT INTO projetos (codigo, ${COLUNAS})
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                [projeto.codigo, ...valores(projeto)],
            );
            await this.gravarParticipacoes(conexao, projeto);
            await this.gravarColunas(conexao, projeto);
        });
        return projeto;
    }

    async listar(filtro: FiltroProjetos = {}): Promise<Projeto[]> {
        const condicoes: string[] = [];
        const parametros: unknown[] = [];
        if (filtro.status?.length) {
            parametros.push(filtro.status);
            condicoes.push(`status = ANY($${parametros.length}::status_projeto[])`);
        }
        if (filtro.codigoArea) {
            parametros.push(filtro.codigoArea);
            condicoes.push(`area_codigo = $${parametros.length}`);
        }
        if (filtro.tipo) {
            parametros.push(filtro.tipo);
            condicoes.push(`tipo = $${parametros.length}`);
        }
        if (filtro.codigoLider) {
            parametros.push(filtro.codigoLider);
            condicoes.push(`lider_codigo = $${parametros.length}`);
        }
        const busca = normalizarBusca(filtro.busca);
        if (busca) {
            parametros.push(`%${busca}%`);
            condicoes.push(
                `translate(lower(nome || ' ' || coalesce(referencia, '') || ' ' || coalesce(cliente_nome, '')),
                    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE $${parametros.length}`,
            );
        }
        const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
        const linhas = await this.conexao.consultar(`SELECT codigo FROM projetos ${where} ORDER BY data_inicio, nome`, parametros);
        return this.hidratar(linhas.map((l) => l.codigo));
    }

    async listarPorMembro(codigoUsuario: string): Promise<Projeto[]> {
        const linhas = await this.conexao.consultar(
            `SELECT DISTINCT p.codigo, p.data_inicio, p.nome
             FROM projetos p
             JOIN projeto_membros pm ON pm.projeto_codigo = p.codigo
             WHERE pm.usuario_codigo = $1 AND NOT p.geral_da_area
             ORDER BY p.data_inicio, p.nome`,
            [codigoUsuario],
        );
        // Um geral por área: carregar todos e filtrar pela equipe e liderança montadas pelos períodos.
        const gerais = await this.conexao.consultar("SELECT codigo FROM projetos WHERE geral_da_area ORDER BY nome");
        const dosGerais = (await this.hidratar(gerais.map((l) => l.codigo))).filter(
            (p) => p.participacoes.some((m) => m.usuario.codigo === codigoUsuario) || p.lideresDaArea.includes(codigoUsuario),
        );
        return [...(await this.hidratar(linhas.map((l) => l.codigo))), ...dosGerais];
    }

    async buscarPorCodigo(codigo: string): Promise<Projeto | null> {
        const projetos = await carregarProjetos(this.conexao, [codigo]);
        return projetos.get(codigo) ?? null;
    }

    async buscarGeralDaArea(codigoArea: string): Promise<Projeto | null> {
        const linhas = await this.conexao.consultar("SELECT codigo FROM projetos WHERE geral_da_area AND area_codigo = $1", [codigoArea]);
        if (linhas.length === 0) return null;
        return this.buscarPorCodigo(linhas[0].codigo);
    }

    async editar(projeto: Projeto): Promise<Projeto> {
        await this.gravar(async (conexao) => {
            const linhas = await conexao.consultar(
                `UPDATE projetos SET (${COLUNAS}) =
                    ($2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                 WHERE codigo = $1
                 RETURNING codigo`,
                [projeto.codigo, ...valores(projeto)],
            );
            if (linhas.length === 0) throw new ErroNaoEncontrado("Projeto não encontrado.");
            await this.gravarParticipacoes(conexao, projeto);
        });
        return projeto;
    }

    async excluir(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar("DELETE FROM projetos WHERE codigo = $1 RETURNING codigo", [codigo]);
        if (linhas.length === 0) throw new ErroNaoEncontrado("Projeto não encontrado.");
    }

    async travar(codigo: string): Promise<void> {
        await this.conexao.consultar("SELECT codigo FROM projetos WHERE codigo = $1 FOR UPDATE", [codigo]);
    }

    private async gravar(operacao: (conexao: ConexaoBanco) => Promise<void>): Promise<void> {
        try {
            await this.conexao.transacao(operacao);
        } catch (erro: any) {
            // Duas restrições únicas podem estourar: o código (referência) do projeto e a
            // participação ativa repetida da mesma pessoa (idx_projeto_membros_ativo).
            if (violacaoDeUnicidade(erro)) {
                throw new ErroConflito(
                    erro.constraint === "idx_projetos_referencia"
                        ? "Já existe um projeto com esse código."
                        : "A pessoa já participa deste projeto.",
                    "PROJETO_DUPLICADO",
                );
            }
            throw erro;
        }
    }

    /** Grava as colunas do projeto novo, na ordem. Só na criação: depois, quem muda as colunas é o caso de uso das colunas. */
    private async gravarColunas(conexao: ConexaoBanco, projeto: Projeto): Promise<void> {
        validarColunas(projeto.colunas);
        for (let ordem = 0; ordem < projeto.colunas.length; ordem++) {
            const c = projeto.colunas[ordem];
            await conexao.consultar(
                `INSERT INTO colunas_projeto (codigo, projeto_codigo, nome, cor, ordem, papel)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [c.codigo, projeto.codigo, c.nome, c.cor, ordem, c.papel],
            );
        }
    }

    /**
     * Insere participações novas e atualiza as existentes. Nunca apaga: quem sai
     * recebe data de saída e continua no histórico (RF-014, RN-01).
     */
    private async gravarParticipacoes(conexao: ConexaoBanco, projeto: Projeto): Promise<void> {
        // A equipe do geral vem dos períodos da área e nunca é gravada.
        if (projeto.geralDaArea) return;
        // Encerra antes de inserir, para que alguém que saiu e voltou não esbarre no índice de participação ativa.
        const ordenadas = [...projeto.participacoes].sort((a, b) => Number(a.ativa) - Number(b.ativa));
        for (const p of ordenadas) {
            await conexao.consultar(
                `INSERT INTO projeto_membros
                    (codigo, projeto_codigo, usuario_codigo, funcao, responsabilidades, data_entrada, data_saida)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (codigo) DO UPDATE SET
                    funcao = EXCLUDED.funcao,
                    responsabilidades = EXCLUDED.responsabilidades,
                    data_saida = EXCLUDED.data_saida`,
                [
                    p.codigo,
                    projeto.codigo,
                    p.usuario.codigo,
                    p.funcao,
                    p.responsabilidades,
                    dataParaSql(p.dataEntrada),
                    dataParaSqlOuNulo(p.dataSaida),
                ],
            );
        }
    }

    /** Monta os projetos mantendo a ordem dos códigos (a do ORDER BY de quem chamou). */
    private async hidratar(codigos: string[]): Promise<Projeto[]> {
        const projetos = await carregarProjetos(this.conexao, codigos);
        return codigos.map((codigo) => projetos.get(codigo)!);
    }
}
