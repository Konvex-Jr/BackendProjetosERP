import ColunaProjeto from "../../../domain/entity/ColunaProjeto";
import Usuario from "../../../domain/entity/Usuario";
import ColunaProjetoRepositoryInterface from "../../../domain/interfaces/ColunaProjetoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSql } from "../../database/conversoes";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

const VIOLACAO_DE_CHAVE_ESTRANGEIRA = "23503";

export default class ColunaProjetoRepositoryDatabase implements ColunaProjetoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async substituir(
        codigoProjeto: string,
        colunas: ColunaProjeto[],
        destinos: Map<string, string>,
        hoje: Date,
        quem: Usuario | null,
        novas: ReadonlySet<string> = new Set(),
    ): Promise<void> {
        await this.conexao.transacao(async (conexao) => {
            // Trava o projeto: dois quadros gravados ao mesmo tempo esperam um pelo outro. NO KEY UPDATE (e não UPDATE)
            // não briga com o FOR KEY SHARE que a chave estrangeira de uma tarefa nova pega no projeto: sem isso,
            // criar tarefa (que trava a coluna com FOR SHARE) e gravar o quadro ao mesmo tempo podiam dar deadlock.
            const projeto = await conexao.consultar("SELECT codigo FROM projetos WHERE codigo = $1 FOR NO KEY UPDATE", [codigoProjeto]);
            if (projeto.length === 0) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.PROJETO.NAO_ENCONTRADO);

            const antigas = (await conexao.consultar("SELECT codigo FROM colunas_projeto WHERE projeto_codigo = $1", [codigoProjeto])).map(
                (l) => l.codigo as string,
            );
            // Coluna que não é nova tem de existir agora, com o projeto travado: se outro quadro a excluiu depois
            // da leitura, ela não pode voltar com o código antigo.
            if (colunas.some((c) => !novas.has(c.codigo) && !antigas.includes(c.codigo))) {
                throw new ErroConflito(MENSAGENS_DE_ERRO.COLUNA.QUADRO_MUDOU, "QUADRO_MUDOU");
            }
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

            // Tarefas das colunas removidas vão para o destino. Só as que ainda estão lá na hora da gravação:
            // a que alguém moveu para outra coluna no meio do caminho fica onde está.
            for (const [removida, destino] of destinos) {
                await conexao.consultar("UPDATE tarefas SET coluna_codigo = $3 WHERE projeto_codigo = $1 AND coluna_codigo = $2", [
                    codigoProjeto,
                    removida,
                    destino,
                ]);
            }

            // Uma passagem por todas as tarefas do projeto, pelo papel atual da coluna de cada uma. Quem já estava
            // concluída e continua numa coluna concluída mantém data e autor; quem entra recebe hoje e `quem`; quem sai perde os dois.
            await conexao.consultar(
                `UPDATE tarefas t
                 SET status = (CASE c.papel WHEN 'entrada' THEN 'pendente' WHEN 'meio' THEN 'andamento' ELSE 'concluida' END)::status_tarefa,
                     data_conclusao = CASE WHEN c.papel = 'concluida' THEN COALESCE(t.data_conclusao, $2::date) ELSE NULL END,
                     concluida_por_codigo = CASE WHEN c.papel = 'concluida'
                                                 THEN (CASE WHEN t.status = 'concluida' THEN t.concluida_por_codigo ELSE $3::uuid END)
                                                 ELSE NULL END
                 FROM colunas_projeto c
                 WHERE c.codigo = t.coluna_codigo AND t.projeto_codigo = $1`,
                [codigoProjeto, dataParaSql(hoje), quem?.codigo ?? null],
            );

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
