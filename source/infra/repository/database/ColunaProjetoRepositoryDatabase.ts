import ColunaProjeto from "../../../domain/entity/ColunaProjeto";
import Tarefa from "../../../domain/entity/Tarefa";
import ColunaProjetoRepositoryInterface from "../../../domain/interfaces/ColunaProjetoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSqlOuNulo } from "../../database/conversoes";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

const VIOLACAO_DE_CHAVE_ESTRANGEIRA = "23503";

export default class ColunaProjetoRepositoryDatabase implements ColunaProjetoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async substituir(codigoProjeto: string, colunas: ColunaProjeto[], tarefas: Tarefa[]): Promise<void> {
        await this.conexao.transacao(async (conexao) => {
            // Trava o projeto: dois quadros gravados ao mesmo tempo esperam um pelo outro.
            const projeto = await conexao.consultar("SELECT codigo FROM projetos WHERE codigo = $1 FOR UPDATE", [codigoProjeto]);
            if (projeto.length === 0) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);

            const antigas = (await conexao.consultar("SELECT codigo FROM colunas_projeto WHERE projeto_codigo = $1", [codigoProjeto])).map(
                (l) => l.codigo as string,
            );
            const finais = new Set(colunas.map((c) => c.codigo));

            // Os índices únicos de papel e de nome barram trocas diretas (A vira B e B vira A): primeiro todas
            // as colunas atuais saem do caminho (papel meio, nome provisório de 40 caracteres), depois entram os valores finais.
            await conexao.consultar(`UPDATE colunas_projeto SET papel = 'meio', nome = 'tmp-' || codigo WHERE projeto_codigo = $1`, [
                codigoProjeto,
            ]);
            for (let ordem = 0; ordem < colunas.length; ordem++) {
                const c = colunas[ordem];
                if (antigas.includes(c.codigo)) {
                    await conexao.consultar(
                        `UPDATE colunas_projeto SET nome = $3, cor = $4, ordem = $5, papel = $6
                         WHERE codigo = $1 AND projeto_codigo = $2`,
                        [c.codigo, codigoProjeto, c.nome, c.cor, ordem, c.papel],
                    );
                } else {
                    await conexao.consultar(
                        `INSERT INTO colunas_projeto (codigo, projeto_codigo, nome, cor, ordem, papel)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [c.codigo, codigoProjeto, c.nome, c.cor, ordem, c.papel],
                    );
                }
            }

            for (const t of tarefas) {
                const gravadas = await conexao.consultar(
                    `UPDATE tarefas SET coluna_codigo = $3, status = $4, data_conclusao = $5, concluida_por_codigo = $6
                     WHERE codigo = $1 AND projeto_codigo = $2
                     RETURNING codigo`,
                    [
                        t.codigo,
                        codigoProjeto,
                        t.coluna?.codigo ?? null,
                        t.status,
                        dataParaSqlOuNulo(t.dataConclusao),
                        t.concluidaPor?.codigo ?? null,
                    ],
                );
                if (gravadas.length === 0) throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
            }

            const excluidas = antigas.filter((codigo) => !finais.has(codigo));
            if (excluidas.length === 0) return;
            try {
                await conexao.consultar("DELETE FROM colunas_projeto WHERE projeto_codigo = $1 AND codigo = ANY($2::uuid[])", [
                    codigoProjeto,
                    excluidas,
                ]);
            } catch (erro) {
                // Uma tarefa nova caiu na coluna entre a leitura e a gravação: desfaz tudo e pede para recarregar.
                if ((erro as { code?: string })?.code === VIOLACAO_DE_CHAVE_ESTRANGEIRA) {
                    throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
                }
                throw erro;
            }
        });
    }
}
