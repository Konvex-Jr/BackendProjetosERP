import RepositoryFactoryInterface from "../domain/Interfaces/RepositoryFactoryInterface";
import Http from "../infra/http/Http";
import ModelRoutes from "../infra/http/Routes/ModelRoutes";
import UsuarioRoutes from "../infra/http/Routes/UsuarioRoutes";
import ProjetoRoutes from "../infra/http/Routes/ProjetoRoutes";
import TarefaRoutes from "../infra/http/Routes/TarefaRoutes";
import CapacitacaoRoutes from "../infra/http/Routes/CapacitacaoRoutes";
import CheckinRoutes from "../infra/http/Routes/CheckinRoutes";
import PastaRoutes from "../infra/http/Routes/PastaRoutes";
import DocumentoRoutes from "../infra/http/Routes/DocumentoRoutes";
import ConfiguracaoRoutes from "../infra/http/Routes/ConfiguracaoRoutes";
import { Permissao } from "../shared/seguranca/catalogoPermissoes";
import { temPermissao, UsuarioAutenticado } from "../shared/seguranca/permissoes";

export interface ItemMenu {
    rotulo: string;
    caminho: string;
    /** Sem permissão: visível para qualquer pessoa logada. */
    permissao?: Permissao;
}

type CriarRotas = new (http: Http, factory: RepositoryFactoryInterface) => ModelRoutes;

export interface Modulo {
    chave: string;
    nome: string;
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
        chave: "pessoas",
        nome: "Pessoas",
        rotas: [UsuarioRoutes],
        permissoes: [Permissao.PESSOAS_GERIR, Permissao.PESSOAS_GERIR_DIRETORES],
        menu: [{ rotulo: "Pessoas", caminho: "/pessoas" }],
    },
    {
        chave: "projetos",
        nome: "Projetos",
        rotas: [ProjetoRoutes],
        permissoes: [Permissao.PROJETOS_EDITAR, Permissao.PROJETOS_EXCLUIR],
        menu: [{ rotulo: "Projetos", caminho: "/projetos" }],
    },
    {
        chave: "tarefas",
        nome: "Tarefas",
        rotas: [TarefaRoutes],
        permissoes: [Permissao.TAREFAS_GERIR_TODAS],
        menu: [{ rotulo: "Tarefas", caminho: "/tarefas" }],
    },
    {
        chave: "capacitacoes",
        nome: "Capacitações",
        rotas: [CapacitacaoRoutes],
        permissoes: [Permissao.CAPACITACOES_GERIR],
        menu: [{ rotulo: "Capacitações", caminho: "/capacitacoes" }],
    },
    {
        chave: "checkins",
        nome: "Check-ins",
        rotas: [CheckinRoutes],
        permissoes: [Permissao.CHECKINS_VER_TODOS],
        menu: [{ rotulo: "Check-ins", caminho: "/checkins" }],
    },
    {
        chave: "documentos",
        nome: "Documentos",
        rotas: [PastaRoutes, DocumentoRoutes],
        permissoes: [Permissao.DOCUMENTOS_GERIR],
        menu: [{ rotulo: "Documentos", caminho: "/documentos" }],
    },
    {
        chave: "config",
        nome: "Configurações",
        rotas: [ConfiguracaoRoutes],
        permissoes: [Permissao.CONFIGURACOES_EDITAR],
        menu: [{ rotulo: "Configurações", caminho: "/configuracoes", permissao: Permissao.CONFIGURACOES_EDITAR }],
    },
];

/** Módulos e itens de menu que a pessoa pode ver (módulos sem item visível ficam de fora). */
export function menuDoUsuario(usuario: UsuarioAutenticado, modulos: Modulo[] = MODULOS) {
    return modulos
        .map((modulo) => ({
            chave: modulo.chave,
            nome: modulo.nome,
            itens: modulo.menu
                .filter((item) => !item.permissao || temPermissao(usuario, item.permissao))
                .map(({ rotulo, caminho }) => ({ rotulo, caminho })),
        }))
        .filter((modulo) => modulo.itens.length > 0);
}
