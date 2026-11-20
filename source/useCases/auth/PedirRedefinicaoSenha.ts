import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroMuitasTentativas } from "../../shared/erros/ErroMuitasTentativas";
import { LimiteTentativas } from "../../shared/seguranca/limiteTentativas";
import GerirLinkSenha from "./GerirLinkSenha";

const QUINZE_MINUTOS = 15 * 60 * 1000;

export function criarLimitePedidosSenha(): LimiteTentativas {
    return new LimiteTentativas(10, QUINZE_MINUTOS);
}

/** "Esqueci a senha": quem tem acesso recebe o link; a resposta é a mesma exista o e-mail ou não. */
export default class PedirRedefinicaoSenha {
    constructor(
        private readonly factory: RepositoryFactoryInterface,
        private readonly limite: LimiteTentativas,
    ) {}

    async execute(email: unknown, ip = "desconhecido"): Promise<void> {
        // Todo pedido conta, não só as falhas: o limite é contra quem usa a rota para disparar e-mails.
        const espera = this.limite.segundosBloqueado(ip);
        if (espera > 0) {
            const minutos = Math.ceil(espera / 60);
            throw new ErroMuitasTentativas(
                `Muitas tentativas de login. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
            );
        }
        this.limite.registrarFalha(ip);

        const endereco = String(email ?? "")
            .trim()
            .toLowerCase();
        const usuario = endereco ? await this.factory.criarUsuarioRepository().buscarPorEmail(endereco) : null;
        if (!usuario?.ativo) return;
        // Sem await: o tempo da resposta não pode revelar se o e-mail existe.
        new GerirLinkSenha(this.factory).emitir(usuario, usuario.senha ? "redefinir" : "convite").catch((erro) => {
            console.error(`Falha ao emitir link de senha para ${usuario.codigo}:`, erro?.message ?? erro);
        });
    }
}
