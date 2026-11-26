import ConexaoBanco from "../../database/ConexaoBanco";
import Usuario from "../../../domain/entity/Usuario";
import SenioridadeUsuario from "../../../domain/entity/SenioridadeUsuario";
import Projeto from "../../../domain/entity/Projeto";
import StatusProjeto from "../../../domain/enum/StatusProjeto";
import StatusPessoa from "../../../domain/enum/StatusPessoa";
import PrioridadeProjeto from "../../../domain/enum/PrioridadeProjeto";
import Area from "../../../domain/entity/Area";
import Participacao from "../../../domain/entity/Participacao";
import ColunaProjeto from "../../../domain/entity/ColunaProjeto";
import PeriodoArea from "../../../domain/entity/PeriodoArea";
import { comEquipeDaArea } from "../../../domain/entity/ProjetoGeral";
import TipoProjeto from "../../../domain/enum/TipoProjeto";
import { lideresDaArea } from "../../../shared/seguranca/liderancaArea";
import AreaRepositoryDatabase from "./AreaRepositoryDatabase";
import PeriodoAreaRepositoryDatabase from "./PeriodoAreaRepositoryDatabase";

/**
 * Funções compartilhadas pelos repositórios em banco para montar pessoas e projetos.
 * Carregam em lote (`WHERE codigo = ANY($1)`), para uma lista de cem itens custar poucas
 * consultas, e não uma por item (o problema "N+1").
 */

/**
 * SELECT base de pessoa, já com senioridade. As áreas atuais vêm dos períodos (preencherAreasAtuais).
 */
export const SELECT_USUARIO = `
    SELECT u.codigo, u.nome, u.email, u.ativo, u.senha_hash, u.status,
           u.nome_exibicao, u.foto, u.telefone, u.linkedin_url, u.calendario_url, u.github_url, u.curso, u.ingresso,
           u.data_entrada, u.data_saida, u.bio, u.email_pessoal, u.motivo_saida, u.fim_trainee,
           s.codigo AS senioridade_codigo,
           s.nome AS senioridade_nome,
           s.valor_hora AS senioridade_valor_hora,
           s.ordem AS senioridade_ordem
    FROM usuarios u
    LEFT JOIN senioridades s ON s.codigo = u.senioridade_codigo
`;

function unicos(codigos: string[]): string[] {
    return [...new Set(codigos)];
}

export function areaDeLinha(linha: any): Area | null {
    if (!linha.area_codigo) return null;
    return new Area(
        linha.area_nome,
        linha.area_pai_codigo ?? null,
        linha.area_ativa ?? true,
        linha.area_codigo,
        linha.area_tem_geral ?? true,
    );
}

export function usuarioDeLinha(linha: any): Usuario {
    const senioridade = linha.senioridade_codigo
        ? new SenioridadeUsuario(
              linha.senioridade_codigo,
              linha.senioridade_nome,
              Number(linha.senioridade_valor_hora),
              Number(linha.senioridade_ordem ?? 0),
          )
        : null;

    return new Usuario(linha.nome, linha.email, linha.ativo, linha.senha_hash ?? "", senioridade, linha.codigo, {
        status: (linha.status as StatusPessoa) ?? undefined,
        nomeExibicao: linha.nome_exibicao,
        foto: linha.foto,
        telefone: linha.telefone,
        linkedinUrl: linha.linkedin_url,
        calendarioUrl: linha.calendario_url,
        githubUrl: linha.github_url,
        curso: linha.curso,
        ingresso: linha.ingresso,
        dataEntrada: linha.data_entrada,
        dataSaida: linha.data_saida,
        bio: linha.bio,
        emailPessoal: linha.email_pessoal,
        motivoSaida: linha.motivo_saida,
        fimTrainee: linha.fim_trainee,
    });
}

/** Pessoas pelos códigos, num Map por código. Códigos repetidos são consultados uma vez só. */
export async function carregarUsuarios(conexao: ConexaoBanco, codigos: string[]): Promise<Map<string, Usuario>> {
    const usuarios = new Map<string, Usuario>();
    const lista = unicos(codigos);

    if (lista.length === 0) {
        return usuarios;
    }

    const linhas = await conexao.consultar(`${SELECT_USUARIO} WHERE u.codigo = ANY($1::uuid[])`, [lista]);

    linhas.forEach((linha) => usuarios.set(linha.codigo, usuarioDeLinha(linha)));
    return usuarios;
}

/**
 * Projetos com área, equipe (todas as participações, inclusive encerradas), responsável e líder.
 * São poucas consultas no total, seja um projeto ou cem: projetos, participações, colunas e pessoas.
 * Se houver projeto geral na lista, mais três: os períodos das áreas deles, os períodos que lideram e as áreas.
 * A equipe do geral vem dos períodos (comEquipeDaArea), nunca de projeto_membros.
 */
export async function carregarProjetos(conexao: ConexaoBanco, codigos: string[]): Promise<Map<string, Projeto>> {
    const projetos = new Map<string, Projeto>();
    const lista = unicos(codigos);

    if (lista.length === 0) {
        return projetos;
    }

    const linhas = await conexao.consultar(
        `SELECT p.codigo, p.nome, p.descricao, p.data_inicio, p.data_fim, p.status,
                p.referencia, p.objetivo, p.cliente_nome, p.prioridade, p.progresso,
                p.tags, p.lider_codigo, p.sigiloso, p.criado_por_codigo,
                p.tipo, p.geral_da_area,
                a.codigo AS area_codigo, a.nome AS area_nome, a.area_pai_codigo, a.ativa AS area_ativa, a.tem_geral AS area_tem_geral
         FROM projetos p
         LEFT JOIN areas a ON a.codigo = p.area_codigo
         WHERE p.codigo = ANY($1::uuid[])`,
        [lista],
    );

    const vinculos = await conexao.consultar(
        `SELECT codigo, projeto_codigo, usuario_codigo, funcao, responsabilidades, data_entrada, data_saida
         FROM projeto_membros
         WHERE projeto_codigo = ANY($1::uuid[])
         ORDER BY data_entrada, codigo`,
        [lista],
    );

    // Lidas como estão no banco: nenhuma regra do conjunto de colunas roda ao ler.
    const colunas = await conexao.consultar(
        `SELECT codigo, projeto_codigo, nome, cor, papel
         FROM colunas_projeto
         WHERE projeto_codigo = ANY($1::uuid[])
         ORDER BY projeto_codigo, ordem`,
        [lista],
    );

    const gerais = linhas.filter((l) => l.geral_da_area && l.area_codigo);
    let periodosDosGerais: PeriodoArea[] = [];
    let periodosQueLideram: PeriodoArea[] = [];
    let areas: Area[] = [];
    if (gerais.length > 0) {
        const periodos = new PeriodoAreaRepositoryDatabase(conexao);
        periodosDosGerais = await periodos.listarDasAreas(gerais.map((l) => l.area_codigo));
        periodosQueLideram = await periodos.listarAbertosQueLideram();
        areas = await new AreaRepositoryDatabase(conexao).listar();
    }

    const usuarios = await carregarUsuarios(conexao, [
        ...periodosDosGerais.map((p) => p.codigoUsuario),
        ...vinculos.map((v) => v.usuario_codigo),
        ...linhas.map((l) => l.lider_codigo).filter(Boolean),
    ]);

    for (const linha of linhas) {
        // O geral não tem equipe gravada: a participação e o líder vêm só dos períodos.
        const participacoes = linha.geral_da_area
            ? []
            : vinculos
                  .filter((v) => v.projeto_codigo === linha.codigo)
                  .map(
                      (v) =>
                          new Participacao(
                              usuarios.get(v.usuario_codigo)!,
                              {
                                  funcao: v.funcao,
                                  responsabilidades: v.responsabilidades,
                                  dataEntrada: v.data_entrada,
                                  dataSaida: v.data_saida,
                              },
                              v.codigo,
                          ),
                  );

        const projeto = new Projeto(
            linha.nome,
            linha.descricao,
            linha.data_inicio,
            linha.data_fim,
            linha.status as StatusProjeto,
            participacoes,
            linha.codigo,
            {
                referencia: linha.referencia,
                objetivo: linha.objetivo,
                clienteNome: linha.cliente_nome,
                prioridade: linha.prioridade as PrioridadeProjeto,
                progresso: Number(linha.progresso),
                area: areaDeLinha(linha),
                tags: linha.tags ?? [],
                lider: linha.lider_codigo && !linha.geral_da_area ? (usuarios.get(linha.lider_codigo) ?? null) : null,
                sigiloso: linha.sigiloso,
                criadoPor: linha.criado_por_codigo,
                colunas: colunas
                    .filter((c) => c.projeto_codigo === linha.codigo)
                    .map((c) => new ColunaProjeto(c.nome, c.cor, c.papel, c.codigo)),
                tipo: linha.tipo as TipoProjeto,
                geralDaArea: linha.geral_da_area,
            },
        );

        projetos.set(
            linha.codigo,
            projeto.geralDaArea && projeto.area
                ? comEquipeDaArea(projeto, periodosDosGerais, usuarios, lideresDaArea(projeto.area.codigo, areas, periodosQueLideram))
                : projeto,
        );
    }

    return projetos;
}
