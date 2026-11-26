/**
 * Catálogo central de ações do sistema (sessão 31a). As rotas checam a ação ("projetos.editar"),
 * nunca o cargo: quem pode o quê fica gravado no cargo (grade de Configurações → Permissões).
 * Ações que todo usuário autenticado pode fazer, e as regras de vínculo (autor, líder, responsável,
 * equipe, instrutor), não entram no catálogo.
 */
export const Permissao = {
    PESSOAS_VER: "pessoas.ver",
    PESSOAS_GERIR: "pessoas.gerir",
    PROJETOS_VER: "projetos.ver",
    PROJETOS_ABRIR_DA_AREA: "projetos.abrirDaArea",
    PROJETOS_ABRIR_TODOS: "projetos.abrirTodos",
    PROJETOS_EDITAR: "projetos.editar",
    PROJETOS_EXCLUIR: "projetos.excluir",
    PROJETOS_LIDERAR: "projetos.liderar",
    CLIENTES_VER: "clientes.ver",
    TAREFAS_VER: "tarefas.ver",
    TAREFAS_GERIR_TODAS: "tarefas.gerirTodas",
    AGENDA_VER: "agenda.ver",
    AGENDA_GERIR_TODAS: "agenda.gerirTodas",
    REUNIOES_CRIAR: "reunioes.criar",
    CAPACITACOES_VER: "capacitacoes.ver",
    CAPACITACOES_GERIR: "capacitacoes.gerir",
    CAPACITACOES_PRESENCA: "capacitacoes.presenca",
    BIBLIOTECA_USAR: "biblioteca.usar",
    BIBLIOTECA_VER_TODOS: "biblioteca.verTodos",
    BIBLIOTECA_GERIR: "biblioteca.gerir",
    ESTRATEGIA_VER: "estrategia.ver",
    PRECIFICACAO_SIMULAR: "precificacao.simular",
    GESTAO_VISOES: "gestao.visoes",
    AREAS_LIDERAR_TODAS: "areas.liderarTodas",
    CONFIGURACOES_VER: "configuracoes.ver",
    CONFIG_ESTRUTURA: "config.estrutura",
    CONFIG_DIFICULDADE: "config.dificuldade",
    CONFIG_PRECIFICACAO: "config.precificacao",
    PERMISSOES_GERIR: "permissoes.gerir",
} as const;

export type Permissao = (typeof Permissao)[keyof typeof Permissao];

export type GrupoPermissao = "Pessoas" | "Projetos" | "Tarefas" | "Agenda" | "Capacitações" | "Biblioteca" | "Gestão" | "Configurações";

export interface InfoPermissao {
    chave: Permissao;
    rotulo: string;
    descricao: string;
    grupo: GrupoPermissao;
}

/** Ordem da grade: por grupo, como na tela. */
export const CATALOGO: readonly InfoPermissao[] = [
    { chave: Permissao.PESSOAS_VER, grupo: "Pessoas", rotulo: "Ver Pessoas", descricao: "Abre a lista de pessoas da EJ." },
    {
        chave: Permissao.PESSOAS_GERIR,
        grupo: "Pessoas",
        rotulo: "Gerir pessoas",
        descricao: "Convida, edita, muda o status e os períodos de quem está abaixo do seu cargo.",
    },
    { chave: Permissao.PROJETOS_VER, grupo: "Projetos", rotulo: "Ver Projetos", descricao: "Abre a tela de Projetos (os cartões)." },
    {
        chave: Permissao.PROJETOS_ABRIR_DA_AREA,
        grupo: "Projetos",
        rotulo: "Abre os projetos da área",
        descricao: "Vê completos os projetos da área do seu cargo (sem as subáreas).",
    },
    {
        chave: Permissao.PROJETOS_ABRIR_TODOS,
        grupo: "Projetos",
        rotulo: "Abre todos os projetos",
        descricao: "Vê completos todos os projetos.",
    },
    {
        chave: Permissao.PROJETOS_EDITAR,
        grupo: "Projetos",
        rotulo: "Criar e editar projetos",
        descricao: "Cria projetos e edita os que abre.",
    },
    {
        chave: Permissao.PROJETOS_EXCLUIR,
        grupo: "Projetos",
        rotulo: "Excluir projetos",
        descricao: "Exclui projetos e tudo o que eles têm.",
    },
    {
        chave: Permissao.PROJETOS_LIDERAR,
        grupo: "Projetos",
        rotulo: "Pode ser líder de projeto",
        descricao: "Pode ser escolhido como líder.",
    },
    {
        chave: Permissao.CLIENTES_VER,
        grupo: "Projetos",
        rotulo: "Vê dados do cliente e contratos",
        descricao: "Contatos do cliente e documentos com sigilo da diretoria.",
    },
    { chave: Permissao.TAREFAS_VER, grupo: "Tarefas", rotulo: "Ver Tarefas", descricao: "Abre a tela de Tarefas." },
    {
        chave: Permissao.TAREFAS_GERIR_TODAS,
        grupo: "Tarefas",
        rotulo: "Organizar tarefas de todos",
        descricao: "Organiza as tarefas dos projetos que abre, como o líder.",
    },
    { chave: Permissao.AGENDA_VER, grupo: "Agenda", rotulo: "Ver a agenda", descricao: "Vê a própria agenda no Dashboard." },
    {
        chave: Permissao.AGENDA_GERIR_TODAS,
        grupo: "Agenda",
        rotulo: "Agenda de todos",
        descricao: "Vê a agenda de outras pessoas e altera reuniões de outros.",
    },
    { chave: Permissao.REUNIOES_CRIAR, grupo: "Agenda", rotulo: "Criar reuniões", descricao: "Marca reuniões pelo ERP." },
    { chave: Permissao.CAPACITACOES_VER, grupo: "Capacitações", rotulo: "Ver Capacitações", descricao: "Abre a tela de Capacitações." },
    {
        chave: Permissao.CAPACITACOES_GERIR,
        grupo: "Capacitações",
        rotulo: "Criar capacitações",
        descricao: "Cria, edita e exclui capacitações.",
    },
    {
        chave: Permissao.CAPACITACOES_PRESENCA,
        grupo: "Capacitações",
        rotulo: "Fazer a chamada",
        descricao: "Marca presença em qualquer capacitação (o instrutor sempre marca na dele).",
    },
    { chave: Permissao.BIBLIOTECA_USAR, grupo: "Biblioteca", rotulo: "Usar a Biblioteca", descricao: "Abre a Biblioteca e cria itens." },
    {
        chave: Permissao.BIBLIOTECA_VER_TODOS,
        grupo: "Biblioteca",
        rotulo: "Ver todos os itens",
        descricao: "Lê itens de qualquer sigilo da Biblioteca.",
    },
    {
        chave: Permissao.BIBLIOTECA_GERIR,
        grupo: "Biblioteca",
        rotulo: "Gerir a Biblioteca",
        descricao: "Edita e exclui itens de outros e usa o sigilo da gestão.",
    },
    { chave: Permissao.ESTRATEGIA_VER, grupo: "Gestão", rotulo: "Ver Relatórios", descricao: "Abre Relatórios e os indicadores." },
    {
        chave: Permissao.PRECIFICACAO_SIMULAR,
        grupo: "Gestão",
        rotulo: "Simular precificação",
        descricao: "Abre o Simulador de Precificação.",
    },
    {
        chave: Permissao.GESTAO_VISOES,
        grupo: "Gestão",
        rotulo: "Visões da gestão",
        descricao: "Alocação, Campinho, ocupação de todos, aviso de sobrecarga e passagens antigas no perfil.",
    },
    {
        chave: Permissao.AREAS_LIDERAR_TODAS,
        grupo: "Gestão",
        rotulo: "Lidera todas as áreas",
        descricao: "Conta como líder de todas as áreas (projeto geral).",
    },
    { chave: Permissao.CONFIGURACOES_VER, grupo: "Configurações", rotulo: "Ver Configurações", descricao: "Abre a tela de Configurações." },
    {
        chave: Permissao.CONFIG_ESTRUTURA,
        grupo: "Configurações",
        rotulo: "Áreas, cargos e senioridades",
        descricao: "Cria e edita áreas, cargos (abaixo do seu), senioridades e o projeto geral.",
    },
    {
        chave: Permissao.CONFIG_DIFICULDADE,
        grupo: "Configurações",
        rotulo: "Dificuldade",
        descricao: "Muda a % do dia de cada dificuldade.",
    },
    {
        chave: Permissao.CONFIG_PRECIFICACAO,
        grupo: "Configurações",
        rotulo: "Regras de precificação",
        descricao: "Muda as regras do simulador.",
    },
    {
        chave: Permissao.PERMISSOES_GERIR,
        grupo: "Configurações",
        rotulo: "Permissões",
        descricao: "Muda esta grade nos cargos abaixo do seu.",
    },
];

export const TODAS_AS_PERMISSOES: Permissao[] = CATALOGO.map((i) => i.chave);

export function ehPermissao(valor: unknown): valor is Permissao {
    return typeof valor === "string" && TODAS_AS_PERMISSOES.includes(valor as Permissao);
}

const P = Permissao;

/** Padrões da migração 030 e dos dados fictícios: o comportamento de cada perfil antigo. */
export const PADRAO_DIRETOR: readonly Permissao[] = TODAS_AS_PERMISSOES;

const SO_DIRETORIA: readonly Permissao[] = [
    P.PROJETOS_ABRIR_TODOS,
    P.PROJETOS_EXCLUIR,
    P.CLIENTES_VER,
    P.AREAS_LIDERAR_TODAS,
    P.CONFIGURACOES_VER,
    P.CONFIG_ESTRUTURA,
    P.CONFIG_DIFICULDADE,
    P.CONFIG_PRECIFICACAO,
    P.PERMISSOES_GERIR,
];

export const PADRAO_GERENTE: readonly Permissao[] = TODAS_AS_PERMISSOES.filter((p) => !SO_DIRETORIA.includes(p));

export const PADRAO_MEMBRO: readonly Permissao[] = [
    P.PROJETOS_VER,
    P.PROJETOS_LIDERAR,
    P.TAREFAS_VER,
    P.AGENDA_VER,
    P.REUNIOES_CRIAR,
    P.CAPACITACOES_VER,
    P.BIBLIOTECA_USAR,
];

export const PADRAO_TRAINEE: readonly Permissao[] = PADRAO_MEMBRO.filter((p) => p !== P.PROJETOS_LIDERAR && p !== P.BIBLIOTECA_USAR);
