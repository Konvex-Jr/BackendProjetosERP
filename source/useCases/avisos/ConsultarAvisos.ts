import { TipoAviso } from "../../domain/interfaces/AvisoRepositoryInterface";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { calcularSituacao, ItemSituacao, TarefaDoAviso, tarefaDoAviso } from "../../domain/service/situacaoAvisos";
import { hoje as hojeEmSaoPaulo } from "../../shared/datas";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";
import { acessoAoProjeto, podeVerTodosProjetos } from "../../shared/seguranca/visibilidadeProjetos";
import ConsultarOcupacao from "../tarefas/ConsultarOcupacao";

const DIA = 86_400_000;
const MAXIMO_GRAVADOS = 30;
const DIAS_DE_LIDO = 30;

export type AvisoGravado = {
    codigo: string;
    tipo: TipoAviso;
    criadoEm: string;
    lido: boolean;
    autor: { codigo: string; nome: string } | null;
} & ({ tarefa: TarefaDoAviso } | { capacitacao: { codigo: string; titulo: string; data: string; hora: string } });

export interface RespostaAvisos {
    naoLidos: number;
    gravados: AvisoGravado[];
    situacao: ItemSituacao[];
}

/** Central de avisos (spec 26a): gravados (com sigilo na leitura) e situação calculada. */
export default class ConsultarAvisos {
    constructor(
        private readonly factory: RepositoryFactoryInterface,
        private readonly agora: () => Date = () => new Date(),
    ) {}

    async listar(usuario: UsuarioAutenticado): Promise<RespostaAvisos> {
        const f = this.factory;
        const repo = f.criarAvisoRepository();
        await repo.apagarLidosAntes(usuario.codigo, new Date(this.agora().getTime() - DIAS_DE_LIDO * DIA));
        const [registros, minhas, projetos, capacitacoes] = await Promise.all([
            repo.listarDoUsuario(usuario.codigo),
            f.criarTarefaRepository().listarPorResponsavel(usuario.codigo),
            f.criarProjetoRepository().listar(),
            f.criarCapacitacaoRepository().listar(),
        ]);
        const porProjeto = new Map(projetos.map((p) => [p.codigo, p]));
        // Só tarefas de projetos com acesso completo: vale para os gravados e para a situação.
        const visiveis = minhas.filter((t) => {
            const projeto = porProjeto.get(t.projeto.codigo);
            return !!projeto && acessoAoProjeto(usuario, projeto) === "completo";
        });
        const tarefas = new Map(visiveis.map((t) => [t.codigo, t]));
        const porCapacitacao = new Map(capacitacoes.map((c) => [c.codigo, c]));
        const usuarios = f.criarUsuarioRepository();
        const autores = new Map<string, { codigo: string; nome: string } | null>();
        const autorDe = async (codigo: string | null) => {
            if (!codigo) return null;
            if (!autores.has(codigo)) {
                const u = await usuarios.buscarPorCodigo(codigo);
                autores.set(codigo, u ? { codigo: u.codigo, nome: u.nomeExibicao || u.nome } : null);
            }
            return autores.get(codigo)!;
        };

        const gravados: AvisoGravado[] = [];
        let naoLidos = 0;
        for (const r of registros) {
            const base = { codigo: r.codigo, tipo: r.tipo, criadoEm: r.criadoEm.toISOString(), lido: !!r.lidoEm };
            let alvo: { tarefa: TarefaDoAviso } | { capacitacao: { codigo: string; titulo: string; data: string; hora: string } };
            if (r.tipo === "tarefa_recebida") {
                const t = r.codigoTarefa ? tarefas.get(r.codigoTarefa) : undefined;
                if (!t) continue;
                alvo = { tarefa: tarefaDoAviso(t) };
            } else {
                const c = r.codigoCapacitacao ? porCapacitacao.get(r.codigoCapacitacao) : undefined;
                if (!c) continue;
                alvo = { capacitacao: { codigo: c.codigo, titulo: c.titulo, data: c.data.toISOString().slice(0, 10), hora: c.hora } };
            }
            if (!r.lidoEm) naoLidos++;
            if (gravados.length < MAXIMO_GRAVADOS) gravados.push({ ...base, autor: await autorDe(r.codigoAutor), ...alvo });
        }

        const gestao = podeVerTodosProjetos(usuario);
        const situacao = calcularSituacao({
            codigoUsuario: usuario.codigo,
            hoje: hojeEmSaoPaulo(),
            tarefas: visiveis,
            capacitacoes,
            ocupacao: gestao ? await new ConsultarOcupacao(f).todas() : null,
        });
        return { naoLidos, gravados, situacao };
    }

    /** Sem `codigos`: marca todos. Com `codigos`: precisa ser lista de textos; códigos que não são da pessoa são ignorados. */
    async marcarLidos(usuario: UsuarioAutenticado, codigos?: unknown): Promise<{ naoLidos: number }> {
        if (codigos !== undefined && (!Array.isArray(codigos) || codigos.some((c) => typeof c !== "string"))) {
            throw new ErroValidacao(MENSAGENS_DE_ERRO.AVISOS.CODIGOS_INVALIDOS, "AVISOS_CODIGOS_INVALIDOS");
        }
        await this.factory.criarAvisoRepository().marcarLidos(usuario.codigo, codigos as string[] | undefined);
        return { naoLidos: (await this.listar(usuario)).naoLidos };
    }
}
