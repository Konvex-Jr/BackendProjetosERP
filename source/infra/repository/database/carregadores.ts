import ConexaoBanco from "../../database/ConexaoBanco";
import Usuario from "../../../domain/Entity/Usuario";
import SenioridadeUsuario from "../../../domain/Entity/SenioridadeUsuario";
import Projeto from "../../../domain/Entity/Projeto";
import Capacitacao from "../../../domain/Entity/Capacitacao";
import PerfilUsuario from "../../../domain/Enum/PerfilUsuario";
import StatusProjeto from "../../../domain/Enum/StatusProjeto";
import TipoCapacitacao from "../../../domain/Enum/TipoCapacitacao";

export const SELECT_USUARIO = `
    SELECT u.codigo, u.nome, u.email, u.perfil, u.ativo, u.senha_hash,
           s.codigo AS senioridade_codigo,
           s.nome AS senioridade_nome,
           s.valor_hora AS senioridade_valor_hora
    FROM usuarios u
    LEFT JOIN senioridades s ON s.codigo = u.senioridade_codigo
`;

function unicos(codigos: string[]): string[] {
    return [...new Set(codigos)];
}

export function usuarioDeLinha(linha: any): Usuario {
    const senioridade = linha.senioridade_codigo
        ? new SenioridadeUsuario(
              linha.senioridade_codigo,
              linha.senioridade_nome,
              Number(linha.senioridade_valor_hora),
          )
        : null;

    return new Usuario(
        linha.nome,
        linha.email,
        linha.perfil as PerfilUsuario,
        linha.ativo,
        linha.senha_hash,
        senioridade,
        linha.codigo,
    );
}

export async function carregarUsuarios(
    conexao: ConexaoBanco,
    codigos: string[],
): Promise<Map<string, Usuario>> {
    const usuarios = new Map<string, Usuario>();
    const lista = unicos(codigos);

    if (lista.length === 0) {
        return usuarios;
    }

    const linhas = await conexao.consultar(
        `${SELECT_USUARIO} WHERE u.codigo = ANY($1::uuid[])`,
        [lista],
    );

    linhas.forEach((linha) => usuarios.set(linha.codigo, usuarioDeLinha(linha)));
    return usuarios;
}

export async function carregarProjetos(
    conexao: ConexaoBanco,
    codigos: string[],
): Promise<Map<string, Projeto>> {
    const projetos = new Map<string, Projeto>();
    const lista = unicos(codigos);

    if (lista.length === 0) {
        return projetos;
    }

    const linhas = await conexao.consultar(
        `SELECT codigo, nome, descricao, data_inicio, data_fim, status
         FROM projetos
         WHERE codigo = ANY($1::uuid[])`,
        [lista],
    );

    const vinculos = await conexao.consultar(
        `SELECT projeto_codigo, usuario_codigo
         FROM projeto_membros
         WHERE projeto_codigo = ANY($1::uuid[])`,
        [lista],
    );

    const usuarios = await carregarUsuarios(
        conexao,
        vinculos.map((v) => v.usuario_codigo),
    );

    for (const linha of linhas) {
        const membros = vinculos
            .filter((v) => v.projeto_codigo === linha.codigo)
            .map((v) => usuarios.get(v.usuario_codigo)!);

        projetos.set(
            linha.codigo,
            new Projeto(
                linha.nome,
                linha.descricao,
                linha.data_inicio,
                linha.data_fim,
                linha.status as StatusProjeto,
                membros,
                linha.codigo,
            ),
        );
    }

    return projetos;
}

export async function carregarCapacitacoes(
    conexao: ConexaoBanco,
    codigos: string[],
): Promise<Map<string, Capacitacao>> {
    const capacitacoes = new Map<string, Capacitacao>();
    const lista = unicos(codigos);

    if (lista.length === 0) {
        return capacitacoes;
    }

    const linhas = await conexao.consultar(
        `SELECT codigo, titulo, data, to_char(hora, 'HH24:MI') AS hora,
                instrutor_codigo, vagas, tipo, sala
         FROM capacitacoes
         WHERE codigo = ANY($1::uuid[])`,
        [lista],
    );

    const inscricoes = await conexao.consultar(
        `SELECT capacitacao_codigo, usuario_codigo
         FROM capacitacao_inscricoes
         WHERE capacitacao_codigo = ANY($1::uuid[])
         ORDER BY inscrito_em`,
        [lista],
    );

    const usuarios = await carregarUsuarios(conexao, [
        ...linhas.map((l) => l.instrutor_codigo),
        ...inscricoes.map((i) => i.usuario_codigo),
    ]);

    for (const linha of linhas) {
        const inscritos = inscricoes
            .filter((i) => i.capacitacao_codigo === linha.codigo)
            .map((i) => usuarios.get(i.usuario_codigo)!);

        capacitacoes.set(
            linha.codigo,
            new Capacitacao(
                linha.titulo,
                linha.data,
                linha.hora,
                usuarios.get(linha.instrutor_codigo)!,
                linha.vagas,
                linha.tipo as TipoCapacitacao,
                linha.sala,
                inscritos,
                linha.codigo,
            ),
        );
    }

    return capacitacoes;
}
