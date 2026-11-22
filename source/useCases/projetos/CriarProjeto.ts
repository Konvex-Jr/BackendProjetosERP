import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/entity/Projeto";
import Participacao from "../../domain/entity/Participacao";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { resolverDetalhesProjeto } from "./dadosProjeto";
import CriarProjetoInput from "./CriarProjetoInput";
import StatusPessoa from "../../domain/enum/StatusPessoa";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/** RF-020: cadastra um projeto. */
export default class CriarProjeto {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: CriarProjetoInput): Promise<Projeto> {
        const usuarios = this.factory.criarUsuarioRepository();
        const participacoes: Participacao[] = [];
        const codigos = [...new Set([...(input.codigosMembros ?? []), ...(input.codigoLider ? [input.codigoLider] : [])])];
        for (const codigo of codigos) {
            const usuario = await usuarios.buscarPorCodigo(codigo);
            if (!usuario || !usuario.naEj) throw new ErroNaoEncontrado(`Pessoa da EJ não encontrada: ${codigo}`);
            participacoes.push(new Participacao(usuario, { dataEntrada: input.dataInicio }));
        }
        const detalhes = await resolverDetalhesProjeto(this.factory, input);
        detalhes.criadoPor = input.criadoPor ?? null;
        if (input.sigiloso !== undefined) detalhes.sigiloso = input.sigiloso;
        if (input.codigoLider) {
            const lider = participacoes.find((p) => p.usuario.codigo === input.codigoLider)!.usuario;
            // Trainee (sessão 20) não lidera.
            if (lider.status === StatusPessoa.TRAINEE) {
                throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.TRAINEE_NAO_LIDERA, "TRAINEE_NAO_LIDERA");
            }
            detalhes.lider = lider;
        }
        const projeto = new Projeto(
            String(input.nome ?? "").trim(),
            String(input.descricao ?? "").trim(),
            input.dataInicio,
            input.dataFim,
            input.status,
            participacoes,
            undefined,
            detalhes,
        );
        return this.factory.criarProjetoRepository().criar(projeto);
    }
}
