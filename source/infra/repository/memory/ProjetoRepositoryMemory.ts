import Projeto from "../../../domain/entity/Projeto";
import Usuario from "../../../domain/entity/Usuario";
import { comEquipeDaArea } from "../../../domain/entity/ProjetoGeral";
import ProjetoRepositoryInterface, { FiltroProjetos } from "../../../domain/interfaces/ProjetoRepositoryInterface";
import PeriodoAreaRepositoryInterface from "../../../domain/interfaces/PeriodoAreaRepositoryInterface";
import AreaRepositoryInterface from "../../../domain/interfaces/AreaRepositoryInterface";
import UsuarioRepositoryInterface from "../../../domain/interfaces/UsuarioRepositoryInterface";
import { lideresDaArea } from "../../../shared/seguranca/liderancaArea";
import { normalizarBusca } from "../../../shared/texto";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

/**
 * Projetos em memória. Como no banco, a equipe e a liderança do projeto geral não são guardadas:
 * são montadas a cada leitura pelos períodos da área (sessão 23b).
 */
export default class ProjetoRepositoryMemory implements ProjetoRepositoryInterface {
    private projetos: Projeto[];

    constructor(
        private readonly periodos: PeriodoAreaRepositoryInterface,
        private readonly areas: AreaRepositoryInterface,
        private readonly usuarios: UsuarioRepositoryInterface,
    ) {
        this.projetos = [];
    }

    async criar(projeto: Projeto): Promise<Projeto> {
        this.projetos.push(this.paraGuardar(projeto));
        return projeto;
    }

    async listar(filtro: FiltroProjetos = {}): Promise<Projeto[]> {
        const busca = normalizarBusca(filtro.busca);
        return this.montar(
            this.projetos
                .filter((p) => !filtro.status?.length || filtro.status.includes(p.status))
                .filter((p) => !filtro.codigoArea || p.area?.codigo === filtro.codigoArea)
                .filter((p) => !filtro.codigoLider || p.lider?.codigo === filtro.codigoLider)
                .filter((p) => !filtro.tipo || p.tipo === filtro.tipo)
                .filter(
                    (p) =>
                        !busca ||
                        normalizarBusca(
                            `${p.nome} ${p.referencia ?? ""} ${p.clientes.map((c) => `${c.nome} ${c.empresa ?? ""}`).join(" ")}`,
                        ).includes(busca),
                ),
        );
    }

    async listarPorMembro(codigoUsuario: string): Promise<Projeto[]> {
        const comuns = this.projetos.filter((p) => !p.geralDaArea && p.participacoes.some((m) => m.usuario.codigo === codigoUsuario));
        const gerais = (await this.montar(this.projetos.filter((p) => p.geralDaArea))).filter(
            (p) => p.participacoes.some((m) => m.usuario.codigo === codigoUsuario) || p.lideresDaArea.includes(codigoUsuario),
        );
        return [...comuns, ...gerais];
    }

    async buscarPorCodigo(codigo: string): Promise<Projeto | null> {
        const projeto = this.projetos.find((p) => p.codigo === codigo);
        return projeto ? (await this.montar([projeto]))[0] : null;
    }

    async buscarGeralDaArea(codigoArea: string): Promise<Projeto | null> {
        const projeto = this.projetos.find((p) => p.geralDaArea && p.area?.codigo === codigoArea);
        return projeto ? (await this.montar([projeto]))[0] : null;
    }

    async editar(projeto: Projeto): Promise<Projeto> {
        const indice = this.projetos.findIndex((p) => p.codigo === projeto.codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Projeto não encontrado.");
        }

        this.projetos[indice] = this.paraGuardar(projeto);
        return projeto;
    }

    async excluir(codigo: string): Promise<void> {
        const indice = this.projetos.findIndex((p) => p.codigo === codigo);

        if (indice === -1) {
            throw new ErroNaoEncontrado("Projeto não encontrado.");
        }

        this.projetos.splice(indice, 1);
    }

    /** Na memória não há concorrência a segurar. */
    async travar(_codigo: string): Promise<void> {}

    /** O geral é guardado sem equipe e sem líder, como no banco. */
    private paraGuardar(projeto: Projeto): Projeto {
        return projeto.geralDaArea ? projeto.copiar({ participacoes: [], lider: null, lideresDaArea: [] }) : projeto;
    }

    /** Monta a equipe e a liderança dos gerais da lista; os outros projetos voltam como estão. */
    private async montar(projetos: Projeto[]): Promise<Projeto[]> {
        const gerais = projetos.filter((p) => p.geralDaArea && p.area);
        if (gerais.length === 0) return projetos;

        const periodosDosGerais = await this.periodos.listarDasAreas(gerais.map((p) => p.area!.codigo));
        const periodosQueLideram = await this.periodos.listarAbertosQueLideram();
        const areas = await this.areas.listar();
        const usuarios = new Map<string, Usuario>();
        for (const codigo of new Set(periodosDosGerais.map((p) => p.codigoUsuario))) {
            const usuario = await this.usuarios.buscarPorCodigo(codigo);
            if (usuario) usuarios.set(codigo, usuario);
        }

        return projetos.map((p) =>
            p.geralDaArea && p.area
                ? comEquipeDaArea(p, periodosDosGerais, usuarios, lideresDaArea(p.area.codigo, areas, periodosQueLideram))
                : p,
        );
    }
}
