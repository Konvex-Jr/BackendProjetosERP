import RepositoryFactoryInterface from "../domain/interfaces/RepositoryFactoryInterface";
import Http from "../infra/http/Http";
import ModelRoutes from "../infra/http/routes/ModelRoutes";
import UsuarioRoutes from "../infra/http/routes/UsuarioRoutes";
import ProjetoRoutes from "../infra/http/routes/ProjetoRoutes";
import TarefaRoutes from "../infra/http/routes/TarefaRoutes";
import AvisoRoutes from "../infra/http/routes/AvisoRoutes";
import AgendaRoutes from "../infra/http/routes/AgendaRoutes";
import OcupacaoRoutes from "../infra/http/routes/OcupacaoRoutes";
import CapacitacaoRoutes from "../infra/http/routes/CapacitacaoRoutes";
import ConfiguracaoRoutes from "../infra/http/routes/ConfiguracaoRoutes";
import AnexoRoutes from "../infra/http/routes/AnexoRoutes";
import BibliotecaRoutes from "../infra/http/routes/BibliotecaRoutes";
import { Permissao } from "../shared/seguranca/catalogoPermissoes";
import { ehTrainee, temPermissao, UsuarioAutenticado } from "../shared/seguranca/permissoes";

/** Item do menu lateral. `chave` e `caminho` são os da tela no frontend; `ordem` define a posição. */
export interface ItemMenu {
    chave: string;
    rotulo: string;
    caminho: string;
    ordem: number;
    /** Sem permissão: visível para qualquer pessoa logada. */
    permissao?: Permissao;
    /** Trainee (sessão 20) não vê o item. */
    semTrainee?: boolean;
    /** Grupo do menu lateral (sessão de interface, 25/11). Sem grupo: fora da lista (Configurações vira a engrenagem do topo). */
    grupo?: GrupoMenu;
}

/** Grupos do menu lateral, nesta ordem. */
export type GrupoMenu = "Trabalho" | "Equipe" | "Gestão";

/** Toda classe de rotas tem este construtor; o Router cria uma instância de cada. */
type CriarRotas = new (http: Http, factory: RepositoryFactoryInterface) => ModelRoutes;

/** Um módulo do sistema: rotas da API, ações do catálogo que ele usa e itens do menu. */
export interface Modulo {
    chave: string;
    nome: string;
    /** Vazio nos módulos só de tela (painel e precificação são calculados no frontend; as regras da precificação ficam em /config/precificacao). */
    rotas: CriarRotas[];
    /** Ações do catálogo que pertencem a este módulo. */
    permissoes: Permissao[];
    menu: ItemMenu[];
}

/**
 * Registro único de módulos. Para criar um módulo novo: adicione as ações em
 * catalogoPermissoes.ts e uma entrada aqui; o Router e o menu leem desta lista.
 * As migrações continuam em migrations/ (numeradas, aplicadas em ordem).
 */
export const MODULOS: Modulo[] = [
    {
        chave: "painel",
        nome: "Painel",
        rotas: [AvisoRoutes],
        permissoes: [Permissao.ESTRATEGIA_VER, Permissao.GESTAO_VISOES, Permissao.AREAS_LIDERAR_TODAS],
        menu: [
            { chave: "dashboard", rotulo: "Dashboard", caminho: "/", ordem: 10, grupo: "Trabalho" },
            {
                chave: "estrategia",
                rotulo: "Relatórios",
                caminho: "/estrategia",
                ordem: 50,
                permissao: Permissao.ESTRATEGIA_VER,
                grupo: "Gestão",
            },
        ],
    },
    {
        chave: "precificacao",
        nome: "Precificação",
        rotas: [],
        permissoes: [Permissao.PRECIFICACAO_SIMULAR],
        menu: [
            {
                chave: "precificacao",
                rotulo: "Simulador de Precificação",
                caminho: "/precificacao",
                ordem: 70,
                permissao: Permissao.PRECIFICACAO_SIMULAR,
                grupo: "Gestão",
            },
        ],
    },
    {
        chave: "pessoas",
        nome: "Pessoas",
        rotas: [UsuarioRoutes],
        permissoes: [Permissao.PESSOAS_VER, Permissao.PESSOAS_GERIR],
        menu: [
            // "Meu perfil" saiu do menu na sessão 22: abre pelo avatar do topo (/perfil, de todos; outra pessoa em /perfil/:codigo).
            { chave: "usuarios", rotulo: "Pessoas", caminho: "/usuarios", ordem: 30, permissao: Permissao.PESSOAS_GERIR, grupo: "Equipe" },
        ],
    },
    {
        chave: "projetos",
        nome: "Projetos",
        rotas: [ProjetoRoutes],
        permissoes: [
            Permissao.PROJETOS_VER,
            Permissao.PROJETOS_ABRIR_DA_AREA,
            Permissao.PROJETOS_ABRIR_TODOS,
            Permissao.PROJETOS_EDITAR,
            Permissao.PROJETOS_EXCLUIR,
            Permissao.PROJETOS_LIDERAR,
            Permissao.CLIENTES_VER,
        ],
        menu: [{ chave: "projetos", rotulo: "Projetos", caminho: "/projetos", ordem: 20, grupo: "Trabalho" }],
    },
    {
        chave: "tarefas",
        nome: "Tarefas",
        rotas: [TarefaRoutes, OcupacaoRoutes],
        permissoes: [Permissao.TAREFAS_VER, Permissao.TAREFAS_GERIR_TODAS],
        // Painel global (sessão 8c): as tarefas dos meus projetos, inclusive o geral da minha área (sessão 23b);
        // a gestão filtra por pessoa.
        menu: [{ chave: "tarefas", rotulo: "Tarefas", caminho: "/tarefas", ordem: 15, grupo: "Trabalho" }],
    },
    {
        // Sessão 28b: agenda unificada (reuniões, prazos das tarefas e capacitações). Todos veem a própria.
        chave: "agenda",
        nome: "Agenda",
        rotas: [AgendaRoutes],
        permissoes: [Permissao.AGENDA_VER, Permissao.AGENDA_GERIR_TODAS, Permissao.REUNIOES_CRIAR],
        // Sem item de menu desde 25/11: a Agenda mora no Dashboard.
        menu: [],
    },
    {
        chave: "capacitacoes",
        nome: "Capacitações",
        rotas: [CapacitacaoRoutes],
        permissoes: [Permissao.CAPACITACOES_VER, Permissao.CAPACITACOES_GERIR, Permissao.CAPACITACOES_PRESENCA],
        menu: [{ chave: "capacitacoes", rotulo: "Capacitações", caminho: "/capacitacoes", ordem: 35, grupo: "Equipe" }],
    },
    {
        // Sessão 17: junta Gestão, Base e Iniciativas. Todos veem (o sigilo é por item); na posição da Base.
        chave: "biblioteca",
        nome: "Biblioteca",
        rotas: [BibliotecaRoutes],
        permissoes: [Permissao.BIBLIOTECA_USAR, Permissao.BIBLIOTECA_VER_TODOS, Permissao.BIBLIOTECA_GERIR],
        menu: [{ chave: "biblioteca", rotulo: "Biblioteca", caminho: "/biblioteca", ordem: 40, semTrainee: true, grupo: "Equipe" }],
    },
    {
        // Sessão 12c: arquivos anexados (hoje, a itens da Biblioteca e a capacitações; sem item de menu).
        chave: "anexos",
        nome: "Anexos",
        rotas: [AnexoRoutes],
        permissoes: [],
        menu: [],
    },
    {
        chave: "config",
        nome: "Configurações",
        rotas: [ConfiguracaoRoutes],
        permissoes: [
            Permissao.CONFIGURACOES_VER,
            Permissao.CONFIG_ESTRUTURA,
            Permissao.CONFIG_DIFICULDADE,
            Permissao.CONFIG_PRECIFICACAO,
            Permissao.PERMISSOES_GERIR,
        ],
        menu: [
            {
                chave: "configuracoes",
                rotulo: "Configurações",
                caminho: "/configuracoes",
                ordem: 90,
                permissao: Permissao.CONFIGURACOES_EDITAR,
            },
        ],
    },
];

function itensVisiveis(usuario: UsuarioAutenticado, modulo: Modulo): ItemMenu[] {
    return modulo.menu.filter(
        (item) => (!item.permissao || temPermissao(usuario, item.permissao)) && !(item.semTrainee && ehTrainee(usuario)),
    );
}

// O frontend recebe chave, rótulo, caminho e grupo; `permissao` e `ordem` são detalhes do backend.
const semPermissao = ({ chave, rotulo, caminho, grupo }: ItemMenu) => ({ chave, rotulo, caminho, ...(grupo ? { grupo } : {}) });

/** Módulos com itens de menu que a pessoa pode ver (módulos sem item visível ficam de fora). */
export function menuDoUsuario(usuario: UsuarioAutenticado, modulos: Modulo[] = MODULOS) {
    return modulos
        .map((modulo) => ({ chave: modulo.chave, nome: modulo.nome, itens: itensVisiveis(usuario, modulo).map(semPermissao) }))
        .filter((modulo) => modulo.itens.length > 0);
}

/** Itens visíveis, em lista única e na ordem do menu lateral. */
export function menuOrdenado(usuario: UsuarioAutenticado, modulos: Modulo[] = MODULOS) {
    return modulos
        .flatMap((modulo) => itensVisiveis(usuario, modulo))
        .sort((a, b) => a.ordem - b.ordem)
        .map(semPermissao);
}
