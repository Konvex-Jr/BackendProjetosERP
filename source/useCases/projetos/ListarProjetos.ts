import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { FiltroProjetos } from "../../domain/interfaces/ProjetoRepositoryInterface";
import Projeto from "../../domain/entity/Projeto";

/** Lista projetos com filtros. Com codigoUsuario, traz os projetos de que a pessoa participa ou participou. */
export default class ListarProjetos {
    private readonly projetos;
    constructor(factory: RepositoryFactoryInterface) {
        this.projetos = factory.criarProjetoRepository();
    }
    async execute(filtro: (FiltroProjetos & { codigoUsuario?: string }) | string = {}): Promise<Projeto[]> {
        const opcoes = typeof filtro === "string" ? { codigoUsuario: filtro } : filtro;
        const { codigoUsuario, ...resto } = opcoes;
        if (!codigoUsuario) return this.projetos.listar(resto);
        const permitidos = new Set((await this.projetos.listar(resto)).map((p) => p.codigo));
        // Equipe atual ou antiga (o geral pode repetir); o acesso é decidido depois,
        // na regra de acesso por projeto.
        const doUsuario = new Map<string, Projeto>();
        for (const p of await this.projetos.listarPorMembro(codigoUsuario)) doUsuario.set(p.codigo, p);
        return [...doUsuario.values()].filter((p) => permitidos.has(p.codigo));
    }
}
