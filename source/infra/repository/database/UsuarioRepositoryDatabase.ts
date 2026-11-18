import Usuario from "../../../domain/entity/Usuario";
import UsuarioRepositoryInterface, { FiltroPessoas } from "../../../domain/interfaces/UsuarioRepositoryInterface";
import StatusPessoa from "../../../domain/enum/StatusPessoa";
import ConexaoBanco from "../../database/ConexaoBanco";
import { dataParaSqlOuNulo, violacaoDeUnicidade } from "../../database/conversoes";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { normalizarBusca } from "../../../shared/texto";
import { SELECT_USUARIO, usuarioDeLinha } from "./carregadores";

const COLUNAS = `nome, email, perfil, senioridade_codigo, ativo, senha_hash, status,
    nome_exibicao, foto, telefone, linkedin_url, curso, semestre,
    data_entrada, data_saida, bio, calendario_url, github_url`;

// No UPDATE do editar a foto fica de fora: só o definirFoto grava essa coluna. Senão uma edição
// que leu a pessoa antes de um PUT /auth/foto escreveria de volta a foto antiga, já apagada do disco.
const LISTA_COLUNAS = COLUNAS.split(",").map((c) => c.trim());
const POSICAO_FOTO = LISTA_COLUNAS.indexOf("foto");
const COLUNAS_EDITAR = LISTA_COLUNAS.filter((_, i) => i !== POSICAO_FOTO);

function valores(usuario: Usuario): unknown[] {
    return [
        usuario.nome,
        usuario.email,
        usuario.perfil,
        usuario.senioridade?.codigo ?? null,
        usuario.ativo,
        usuario.senha,
        usuario.status,
        usuario.nomeExibicao,
        usuario.foto,
        usuario.telefone,
        usuario.linkedinUrl,
        usuario.curso,
        usuario.semestre,
        dataParaSqlOuNulo(usuario.dataEntrada),
        dataParaSqlOuNulo(usuario.dataSaida),
        usuario.bio,
        usuario.calendarioUrl,
        usuario.githubUrl,
    ];
}

export default class UsuarioRepositoryDatabase implements UsuarioRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async criar(usuario: Usuario): Promise<Usuario | null> {
        return this.conexao.transacao(async (conexao) => {
            const linhas = await conexao.consultar(
                `INSERT INTO usuarios (codigo, ${COLUNAS})
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                 ON CONFLICT DO NOTHING
                 RETURNING codigo`,
                [usuario.codigo, ...valores(usuario)],
            );
            // E-mail repetido não lança erro aqui: devolve null e o caso de uso (CriarUsuario) avisa.
            if (linhas.length === 0) return null;
            return usuario;
        });
    }

    async listar(filtro: FiltroPessoas = {}): Promise<Usuario[]> {
        const condicoes: string[] = [];
        const parametros: unknown[] = [];
        if (filtro.status?.length) {
            parametros.push(filtro.status);
            condicoes.push(`u.status = ANY($${parametros.length}::status_pessoa[])`);
        }
        const busca = normalizarBusca(filtro.busca);
        if (busca) {
            // translate tira os acentos no banco, como normalizarBusca faz no texto buscado:
            // assim "joao" acha "João".
            parametros.push(`%${busca}%`);
            condicoes.push(
                `translate(lower(u.nome || ' ' || coalesce(u.nome_exibicao, '') || ' ' || u.email),
                    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE $${parametros.length}`,
            );
        }
        const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
        const linhas = await this.conexao.consultar(`${SELECT_USUARIO} ${where} ORDER BY u.nome`, parametros);
        return linhas.map(usuarioDeLinha);
    }

    async buscarPorCodigo(codigo: string): Promise<Usuario | null> {
        const linhas = await this.conexao.consultar(`${SELECT_USUARIO} WHERE u.codigo = $1`, [codigo]);
        return linhas.length > 0 ? usuarioDeLinha(linhas[0]) : null;
    }

    async buscarPorEmail(email: string): Promise<Usuario | null> {
        const linhas = await this.conexao.consultar(`${SELECT_USUARIO} WHERE lower(u.email) = lower($1)`, [email.trim()]);
        return linhas.length > 0 ? usuarioDeLinha(linhas[0]) : null;
    }

    async editar(usuario: Usuario): Promise<Usuario> {
        try {
            await this.conexao.transacao(async (conexao) => {
                const linhas = await conexao.consultar(
                    `UPDATE usuarios SET (${COLUNAS_EDITAR.join(", ")}) =
                        (${COLUNAS_EDITAR.map((_, i) => `$${i + 2}`).join(", ")})
                     WHERE codigo = $1
                     RETURNING codigo`,
                    [usuario.codigo, ...valores(usuario).filter((_, i) => i !== POSICAO_FOTO)],
                );
                if (linhas.length === 0) throw new ErroNaoEncontrado("Usuário não encontrado.");
            });
        } catch (erro) {
            if (violacaoDeUnicidade(erro)) {
                throw new ErroConflito("Este e-mail já está cadastrado.", "EMAIL_JA_CADASTRADO");
            }
            throw erro;
        }
        return usuario;
    }

    async desativar(codigo: string): Promise<void> {
        const linhas = await this.conexao.consultar("UPDATE usuarios SET status = $2, ativo = false WHERE codigo = $1 RETURNING codigo", [
            codigo,
            StatusPessoa.INATIVO,
        ]);
        if (linhas.length === 0) throw new ErroNaoEncontrado("Usuário não encontrado.");
    }

    async definirFoto(codigo: string, foto: string | null): Promise<string | null> {
        // O SELECT ... FOR UPDATE trava a linha e lê a foto anterior no mesmo comando.
        const linhas = await this.conexao.consultar(
            `UPDATE usuarios u SET foto = $2
             FROM (SELECT foto FROM usuarios WHERE codigo = $1 FOR UPDATE) antes
             WHERE u.codigo = $1
             RETURNING antes.foto AS anterior`,
            [codigo, foto],
        );
        if (linhas.length === 0) throw new ErroNaoEncontrado("Usuário não encontrado.");
        return linhas[0].anterior ?? null;
    }
}
