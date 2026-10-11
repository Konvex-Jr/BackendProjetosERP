import { compare } from "bcrypt";
import { readFileSync } from "fs";
import { sign } from "jsonwebtoken";

import RepositoryFactoryInterface from "../../domain/Interfaces/RepositoryFactoryInterface";
import UsuarioRepositoryInterface from "../../domain/Interfaces/UsuarioRepositoryInterface";
import LoginUsuarioInput from "./LoginUsuarioInput";
import LoginUsuarioOutput from "./LoginUsuarioOutput";

export const MENSAGEM_CREDENCIAIS_INVALIDAS = "Credenciais inválidas";

export default class LoginUsuario {
    readonly usuarioRepository: UsuarioRepositoryInterface;

    constructor(repositoryFactory: RepositoryFactoryInterface) {
        this.usuarioRepository = repositoryFactory.criarUsuarioRepository();
    }

    async execute(input: LoginUsuarioInput): Promise<LoginUsuarioOutput> {
        const email = input.email.trim().toLowerCase();
        const usuario = await this.usuarioRepository.buscarPorEmail(email);

        if (!usuario || !usuario.ativo) {
            throw new Error(MENSAGEM_CREDENCIAIS_INVALIDAS);
        }

        const senhaConfere = await compare(input.senha, usuario.senha);
        if (!senhaConfere) {
            throw new Error(MENSAGEM_CREDENCIAIS_INVALIDAS);
        }

        const chavePrivada = readFileSync("./private.key");
        const payload = {
            codigo: usuario.codigo,
            email: usuario.email,
        };
        const token = sign(payload, chavePrivada, {
            algorithm: "RS256",
            expiresIn: "2h",
        });

        return { token };
    }
}