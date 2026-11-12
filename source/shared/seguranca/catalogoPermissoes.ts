import PerfilUsuario from "../../domain/enum/PerfilUsuario";

/**
 * Catálogo central de ações do sistema. As rotas checam a ação ("projetos.editar"),
 * nunca o papel diretamente; quem pode o quê fica só no mapa PERMISSOES_POR_PAPEL.
 * Correspondência: diretor = ADMIN, gerente = MANAGER, membro = MEMBER.
 * Ações que todo usuário autenticado pode fazer não entram no catálogo.
 */
export const Permissao = {
    PESSOAS_GERIR: "pessoas.gerir",
    PESSOAS_GERIR_DIRETORES: "pessoas.gerirDiretores",
    PROJETOS_VER_TODOS: "projetos.verTodos",
    PROJETOS_EDITAR: "projetos.editar",
    PROJETOS_EXCLUIR: "projetos.excluir",
    TAREFAS_GERIR_TODAS: "tarefas.gerirTodas",
    /** Criar e organizar tarefas avulsas (sem projeto). Sessão 8c. */
    TAREFAS_ATRIBUIR: "tarefas.atribuir",
    CAPACITACOES_GERIR: "capacitacoes.gerir",
    /** Ler pastas de qualquer sigilo (gestão). Sessão 9. */
    DOCUMENTOS_VER_TODAS: "documentos.verTodas",
    DOCUMENTOS_GERIR: "documentos.gerir",
    /** Editar e excluir qualquer item da Base de Inteligência (o autor altera o próprio). Sessão 12a. */
    CONHECIMENTO_GERIR: "conhecimento.gerir",
    /** Criar, editar e excluir qualquer iniciativa de inovação (a área de Inovação também cria). Sessão 12b. */
    INICIATIVAS_GERIR: "iniciativas.gerir",
    CONFIGURACOES_EDITAR: "configuracoes.editar",
    ESTRATEGIA_VER: "estrategia.ver",
    PRECIFICACAO_SIMULAR: "precificacao.simular",
} as const;

export type Permissao = (typeof Permissao)[keyof typeof Permissao];

export const TODAS_AS_PERMISSOES: Permissao[] = Object.values(Permissao);

/**
 * Gerente: tudo o que o diretor faz, menos três ações que ficam só com a diretoria:
 * gerir outros diretores, excluir projetos e editar as configurações.
 */
const DO_GESTOR: Permissao[] = [
    Permissao.PESSOAS_GERIR,
    Permissao.PROJETOS_VER_TODOS,
    Permissao.PROJETOS_EDITAR,
    Permissao.TAREFAS_GERIR_TODAS,
    Permissao.TAREFAS_ATRIBUIR,
    Permissao.CAPACITACOES_GERIR,
    Permissao.DOCUMENTOS_VER_TODAS,
    Permissao.DOCUMENTOS_GERIR,
    Permissao.CONHECIMENTO_GERIR,
    Permissao.INICIATIVAS_GERIR,
    Permissao.ESTRATEGIA_VER,
    Permissao.PRECIFICACAO_SIMULAR,
];

export const PERMISSOES_POR_PAPEL: Record<PerfilUsuario, readonly Permissao[]> = {
    [PerfilUsuario.DIRETOR]: TODAS_AS_PERMISSOES,
    [PerfilUsuario.GERENTE]: DO_GESTOR,
    // Membro não tem ação do catálogo: o que ele pode fazer vem das regras por item
    // (autor do item, responsável pela tarefa, participante do projeto...).
    [PerfilUsuario.MEMBRO]: [],
};

/**
 * Ações liberadas para o papel. Papel desconhecido ou ausente recebe lista vazia (na dúvida,
 * nega). Devolve uma cópia para quem chama não alterar o mapa por engano.
 */
export function permissoesDoPapel(perfil: PerfilUsuario | string | null | undefined): Permissao[] {
    return [...(PERMISSOES_POR_PAPEL[perfil as PerfilUsuario] ?? [])];
}
