import { verify } from "jsonwebtoken";
import Auth from "./Auth";
import RepositoryFactoryInterface from "../../../domain/interfaces/RepositoryFactoryInterface";
import UserRepositoryInterface from "../../../domain/interfaces/UsuarioRepositoryInterface";
import { obterChavePublica } from "../../../shared/seguranca/chavesJwt";
import { PermissoesDaPessoa, permissoesEfetivas } from "../../../shared/seguranca/permissoesEfetivas";
import Usuario from "../../../domain/entity/Usuario";

/**
 * Confere o token de acesso (JWT RS256, 15 min por padrão) enviado no cabeçalho `access-token`
 * (não em `Authorization: Bearer`; o CORS do ExpressHttp libera esse nome). Depois busca a pessoa
 * no banco e a coloca em `body.user`, que as rotas repassam aos casos de uso.
 *
 * Buscar no banco a cada requisição custa uma consulta, mas faz a inativação e a troca de papel
 * valerem na hora, sem esperar o token expirar. Desde a 31a, junta as permissões efetivas e o cargo. Token vencido dá 401 e o frontend renova a
 * sessão com o refresh token (POST /auth/refresh).
 */
export default class ExpressAuth implements Auth {
    protected userRepository: UserRepositoryInterface;

    constructor(protected readonly repositoryFactory: RepositoryFactoryInterface) {
        this.userRepository = repositoryFactory.criarUsuarioRepository();
    }

    /** Permissões e cargo de agora (sessão 31a): lidos a cada requisição, a grade vale no próximo clique. */
    protected permissoesDe(usuario: Usuario): Promise<PermissoesDaPessoa> {
        return permissoesEfetivas(usuario, this.repositoryFactory);
    }

    async execute(request: any, response: any, next: any): Promise<any> {
        if (!request.headers || !request.headers["access-token"]) {
            return response.status(401).json({
                message: "Token de acesso ausente.",
            });
        }
        const token = request.headers["access-token"];
        try {
            const publicKey = obterChavePublica();
            // Fixar o algoritmo impede aceitar um token assinado de outro jeito (ex.: "none" ou HS256).
            const data = verify(token, publicKey, { algorithms: ["RS256"] }) as { codigo: string };
            const user = await this.userRepository.buscarPorCodigo(data.codigo);

            if (!user || !user.ativo) {
                return response.status(401).json({ message: "Token inválido ou usuário inativo." });
            }

            // Garante o objeto mesmo sem corpo, para todas as rotas receberem a pessoa do mesmo jeito.
            request.body = request.body ?? {};
            request.body.user = Object.assign(Object.create(Object.getPrototypeOf(user)), user, await this.permissoesDe(user));
            return next();
        } catch (e) {
            return response.status(401).json({
                message: "Token inválido ou expirado.",
            });
        }
    }
}
