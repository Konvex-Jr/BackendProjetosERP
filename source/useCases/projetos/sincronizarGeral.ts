import Area from "../../domain/entity/Area";
import Projeto from "../../domain/entity/Projeto";
import { nomeDoGeral, novoGeral } from "../../domain/entity/ProjetoGeral";
import StatusProjeto from "../../domain/enum/StatusProjeto";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { hoje } from "../../shared/datas";

/** O projeto geral da área não aceita edição, exclusão, status, acesso, equipe nem líder (só as colunas do quadro). */
export function exigirNaoGeral(projeto: Projeto): void {
    if (projeto.geralDaArea) throw new ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.GERAL_FIXO, "PROJETO_GERAL_FIXO");
}

/**
 * Mantém o geral da área em dia com a área: cria se faltar; senão renomeia e arquiva ou reativa
 * conforme `area.ativa`. A equipe do geral nunca é gravada (vem dos períodos).
 */
export async function sincronizarGeral(factory: RepositoryFactoryInterface, area: Area): Promise<Projeto> {
    const projetos = factory.criarProjetoRepository();
    const atual = await projetos.buscarGeralDaArea(area.codigo);
    if (!atual) return projetos.criar(novoGeral(area, hoje()));
    return projetos.editar(
        atual.copiar({
            nome: nomeDoGeral(area),
            area,
            status: area.ativa ? StatusProjeto.EM_EXECUCAO : StatusProjeto.ARQUIVADO,
        }),
    );
}
