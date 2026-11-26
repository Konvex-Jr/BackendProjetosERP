import { exigirPodeLiderar } from "../../shared/seguranca/permissoesEfetivas";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Projeto from "../../domain/entity/Projeto";
import Participacao from "../../domain/entity/Participacao";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { resolverDetalhesProjeto } from "./dadosProjeto";
import CriarProjetoInput from "./CriarProjetoInput";

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
        if (input.codigoLider) {
            const lider = participacoes.find((p) => p.usuario.codigo === input.codigoLider)!.usuario;
            // Sessão 31a: lidera quem tem projetos.liderar (o trainee, por padrão, não tem).
            await exigirPodeLiderar(lider, this.factory);
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
