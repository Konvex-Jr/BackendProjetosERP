import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import Usuario from "../../domain/entity/Usuario";
import { hoje } from "../../domain/entity/Participacao";
import StatusPessoa, { STATUS_DE_SAIDA } from "../../domain/enum/StatusPessoa";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

export interface AlterarStatusPessoaInput {
    codigo: string;
    status: StatusPessoa;
    /** Data de saída para Inativo (padrão: hoje). */
    dataSaida?: Date | null;
    /** Obrigatório ao mudar para Inativo; em Inativo → Inativo só troca se vier preenchido. */
    motivoSaida?: string | null;
    /**
     * Se verdadeiro (padrão), encerra as participações em aberto com a mesma data de saída.
     * A decisão final está em aberto (QA-31); por isso a pessoa que faz a mudança escolhe.
     */
    encerrarParticipacoes?: boolean;
}

export interface AlterarStatusPessoaOutput {
    usuario: Usuario;
    participacoesEncerradas: number;
    /** Períodos em aberto nas áreas que a saída encerrou (sempre, com a data de saída). */
    periodosEncerrados: number;
}

/**
 * PR-01 e RN-01: a saída muda o status para Inativo e registra a data.
 * Nada é apagado: projetos, tarefas, documentos e capacitações continuam ligados à pessoa.
 */
export default class AlterarStatusPessoa {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: AlterarStatusPessoaInput): Promise<AlterarStatusPessoaOutput> {
        if (!Object.values(StatusPessoa).includes(input.status)) {
            throw new ErroValidacao("Status de pessoa inválido.", "STATUS_PESSOA_INVALIDO");
        }
        const usuarios = this.factory.criarUsuarioRepository();
        const atual = await usuarios.buscarPorCodigo(input.codigo);
        if (!atual) throw new ErroNaoEncontrado("Usuário não encontrado.");

        // Trainee é só a etapa de entrada (sessão 20): quem já saiu dela não volta.
        if (input.status === StatusPessoa.TRAINEE && atual.status !== StatusPessoa.TRAINEE) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.STATUS_TRAINEE_SO_NA_ENTRADA, "STATUS_TRAINEE_SO_NA_ENTRADA");
        }

        const saindo = STATUS_DE_SAIDA.includes(input.status);
        // Saída no futuro deixaria os períodos nas áreas com fim no futuro (e travaria a edição deles).
        if (saindo && input.dataSaida && input.dataSaida.getTime() > hoje().getTime()) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.SAIDA_NO_FUTURO, "SAIDA_NO_FUTURO");
        }
        if (input.motivoSaida !== undefined && input.motivoSaida !== null && typeof input.motivoSaida !== "string") {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.MOTIVO_SAIDA_OBRIGATORIO, "MOTIVO_SAIDA_OBRIGATORIO");
        }
        const motivoInformado = (input.motivoSaida ?? "").trim();
        const entrandoNaSaida = !STATUS_DE_SAIDA.includes(atual.status) && saindo;
        if (entrandoNaSaida && !motivoInformado) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.USUARIO.MOTIVO_SAIDA_OBRIGATORIO, "MOTIVO_SAIDA_OBRIGATORIO");
        }
        const dataSaida = saindo ? (input.dataSaida ?? atual.dataSaida ?? hoje()) : null;
        const motivoSaida = saindo ? motivoInformado || atual.motivoSaida : null;
        // O fim do período de trainee vale só na passagem de Trainee para Ativo.
        const fimTrainee = atual.status === StatusPessoa.TRAINEE && input.status === StatusPessoa.ATIVO ? hoje() : undefined;
        const usuario = atual.copiar({ status: input.status, dataSaida, motivoSaida, fimTrainee });
        await usuarios.editar(usuario);

        let participacoesEncerradas = 0;
        let periodosEncerrados = 0;
        // Quem fica sem acesso (saída) tem as sessões encerradas na hora.
        if (!usuario.ativo) {
            await this.factory.criarRefreshTokenRepository().revogarTodosDoUsuario(usuario.codigo);
        }
        if (saindo) {
            // Quem sai deixa as áreas na data de saída, mesmo mantendo as participações (spec 23, seção 5.2).
            periodosEncerrados = await this.factory.criarPeriodoAreaRepository().encerrarAbertosDe(usuario.codigo, dataSaida!);
            if (input.encerrarParticipacoes !== false) {
                const projetos = this.factory.criarProjetoRepository();
                for (const projeto of await projetos.listarPorMembro(usuario.codigo)) {
                    const aberta = projeto.participacaoAtivaDe(usuario.codigo);
                    if (!aberta) continue;
                    const saida = dataSaida!.getTime() < aberta.dataEntrada.getTime() ? aberta.dataEntrada : dataSaida!;
                    await projetos.editar(
                        projeto.copiar({
                            participacoes: projeto.participacoes.map((p) =>
                                p.codigo === aberta.codigo ? p.copiar({ dataSaida: saida }) : p,
                            ),
                        }),
                    );
                    participacoesEncerradas += 1;
                }
            }
        }
        return { usuario, participacoesEncerradas, periodosEncerrados };
    }
}
