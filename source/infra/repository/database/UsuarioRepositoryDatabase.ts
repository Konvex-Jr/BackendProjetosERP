import Usuario from "../../../domain/Entity/Usuario";
import UsuarioRepositoryInterface from "../../../domain/Interfaces/UsuarioRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { violacaoDeUnicidade } from "../../database/conversoes";
import { SELECT_USUARIO, usuarioDeLinha } from "./carregadores";

export default class UsuarioRepositoryDatabase implements UsuarioRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async criar(usuario: Usuario): Promise<Usuario | null> {
        const linhas = await this.conexao.consultar(
            `INSERT INTO usuarios (codigo, nome, email, perfil, senioridade_codigo, ativo, senha_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING
             RETURNING codigo`,
            [
                usuario.codigo,
                usuario.nome,
                usuario.email,
                usuario.perfil,
                usuario.senioridade?.codigo ?? null,
                usuario.ativo,
                usuario.senha,
            ],
        );

        return linhas.length > 0 ? usuario : null;
    }

    async listar(): Promise<Usuario[]> {
        const linhas = await this.conexao.consultar(`${SELECT_USUARIO} ORDER BY u.nome`);
        return linhas.map(usuarioDeLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<Usuario | null> {
        const linhas = await this.conexao.consultar(
            `${SELECT_USUARIO} WHERE u.codigo = $1`,
            [codigo],
        );
        return linhas.length > 0 ? usuarioDeLinha(linhas[0]) : null;
    }

    async buscarPorEmail(email: string): Promise<Usuario | null> {
        const linhas = await this.conexao.consultar(
            `${SELECT_USUARIO} WHERE lower(u.email) = lower($1)`,
            [email.trim()],
        );
        return linhas.length > 0 ? usuarioDeLinha(linhas[0]) : null;
    }

    async editar(usuario: Usuario): Promise<Usuario> {
        let linhas: any[];

        try {
            linhas = await this.conexao.consultar(
                `UPDATE usuarios
                 SET nome = $2, email = $3, perfil = $4, senioridade_codigo = $5,
                     ativo = $6, senha_hash = $7
                 WHERE codigo = $1
                 RETURNING codigo`,
                [
                    usuario.codigo,
                    usuario.nome,
                    usuario.email,
                    usuario.perfil,
                    usuario.senioridade?.codigo ?? null,
                    usuario.ativo,
                    usuario.senha,
                ],
            );
        } catch (erro) {
            if (violacaoDeUnicidade(erro)) {
                throw new Error("E-mail já cadastrado");
            }
            throw erro;
        }

        if (linhas.length === 0) {
            throw new Error("Usuário não encontrado");
        }

        return usuario;
    }

    async desativar(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar(
            "UPDATE usuarios SET ativo = false WHERE codigo = $1 RETURNING codigo",
            [codigo],
        );

        if (linhas.length === 0) {
            throw new Error("Usuário não encontrado");
        }
    }
}
