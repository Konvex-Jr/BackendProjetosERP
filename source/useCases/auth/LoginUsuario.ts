import { compare } from "bcrypt";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/interfaces/UsuarioRepositoryInterface";
import LoginUsuarioInput from "./LoginUsuarioInput";
import LoginUsuarioOutput from "./LoginUsuarioOutput";
import { emitirSessao } from "./emitirSessao";
import { ErroNaoAutorizado } from "../../shared/erros/ErroNaoAutorizado";
import { ErroMuitasTentativas } from "../../shared/erros/ErroMuitasTentativas";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { LimiteTentativas } from "../../shared/seguranca/limiteTentativas";

export const MENSAGEM_CREDENCIAIS_INVALIDAS = MENSAGENS_DE_ERRO.AUTENTICACAO.CREDENCIAIS_INVALIDAS;

const QUINZE_MINUTOS = 15 * 60 * 1000;

/**
 * Limites do login (auditoria de 13/11/2026). Por e-mail + IP: 5 erros em 15 min bloqueiam
 * aquele par, sem trancar a pessoa de verdade, que entra de outro lugar. Por IP: 30 erros em
 * 15 min, contra quem testa muitos e-mails. Só falhas contam; login certo zera o par.
 */
export interface LimitesLogin {
    porEmailEIp: LimiteTentativas;
    porIp: LimiteTentativas;
}

export function criarLimitesLogin(): LimitesLogin {
    return { porEmailEIp: new LimiteTentativas(5, QUINZE_MINUTOS), porIp: new LimiteTentativas(30, QUINZE_MINUTOS) };
}

/** RF-001: login por e-mail e senha, com token de acesso e refresh token. */
export default class LoginUsuario {
    readonly usuarioRepository: UsuarioRepositoryInterface;

    constructor(
        private readonly repositoryFactory: RepositoryFactoryInterface,
        private readonly limites: LimitesLogin = criarLimitesLogin(),
    ) {
        this.usuarioRepository = repositoryFactory.criarUsuarioRepository();
    }

    async execute(input: LoginUsuarioInput, ip = "desconhecido"): Promise<LoginUsuarioOutput> {
        const email = String(input.email ?? "")
            .trim()
            .toLowerCase();
        const chavePar = `${email}|${ip}`;
        const espera = Math.max(this.limites.porEmailEIp.segundosBloqueado(chavePar), this.limites.porIp.segundosBloqueado(ip));
        if (espera > 0) {
            const minutos = Math.ceil(espera / 60);
            throw new ErroMuitasTentativas(
                `Muitas tentativas de login. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
            );
        }

        const usuario = await this.usuarioRepository.buscarPorEmail(email);
        // Mesma mensagem para e-mail inexistente, senha errada e pessoa sem acesso (CT-001).
        const senhaConfere = !!usuario?.ativo && !!usuario.senha && (await compare(String(input.senha ?? ""), usuario.senha));
        if (!usuario || !senhaConfere) {
            this.limites.porEmailEIp.registrarFalha(chavePar);
            this.limites.porIp.registrarFalha(ip);
            throw new ErroNaoAutorizado(MENSAGEM_CREDENCIAIS_INVALIDAS);
        }
        this.limites.porEmailEIp.limpar(chavePar);
        return emitirSessao(this.repositoryFactory, usuario);
    }
}
