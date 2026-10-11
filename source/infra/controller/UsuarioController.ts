import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import CriarUsuario from "../../useCases/CriarUsuario/CriarUsuario";
import CriarUsuarioInput from "../../useCases/CriarUsuario/CriarUsuarioInput";
import CriarUsuarioOutput from "../../useCases/CriarUsuario/CriarUsuarioOutput";
import Loginusuario from "../../useCases/LoginUsuario/LoginUsuario";
import LoginUsuarioInput from "../../useCases/LoginUsuario/LoginUsuarioInput";
import LoginUsuarioOutput from "../../useCases/LoginUsuario/LoginUsuarioOutput";

export default class UsuarioController {

    constructor(protected repositoryFactory: RepositoryFactoryInterface) {
    }

    async criarUsuario(input: CriarUsuarioInput): Promise<CriarUsuarioOutput> {
        const criarUsuario = new CriarUsuario(this.repositoryFactory);
        return await criarUsuario.execute(input);
    }

    async login(input: LoginUsuarioInput): Promise<LoginUsuarioOutput> {
        const loginUsuario = new Loginusuario(this.repositoryFactory);
        return await loginUsuario.execute(input);
    }

}