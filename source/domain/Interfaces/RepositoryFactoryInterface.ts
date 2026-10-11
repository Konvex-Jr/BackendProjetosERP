import UsuarioRepositoryInterface from "./UsuarioRepositoryInterface";

export default interface RepositoryFactoryInterface {

    criarUsuarioRepository(): UsuarioRepositoryInterface;

}