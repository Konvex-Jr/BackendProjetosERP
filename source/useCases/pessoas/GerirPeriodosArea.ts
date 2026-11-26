import PeriodoArea, { validarNovoPeriodo } from "../../domain/entity/PeriodoArea";
import Usuario from "../../domain/entity/Usuario";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

export interface PeriodoAreaEntrada {
    codigoArea: string;
    codigoCargo?: string | null;
    inicio: Date;
    fim?: Date | null;
}

/**
 * A gestão lança e corrige os períodos de uma pessoa nas áreas (spec 23, seção 5).
 * A permissão (quem pode gerir o perfil) fica na rota; aqui ficam as regras do período.
 */
export default class GerirPeriodosArea {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async listar(codigoUsuario: string): Promise<PeriodoArea[]> {
        await this.pessoa(codigoUsuario);
        return this.factory.criarPeriodoAreaRepository().listarDe(codigoUsuario);
    }

    async criar(codigoUsuario: string, entrada: PeriodoAreaEntrada, codigoAutor: string): Promise<PeriodoArea> {
        const pessoa = await this.pessoa(codigoUsuario);
        const { area, cargo } = await this.areaECargo(entrada);
        const periodo = new PeriodoArea(codigoUsuario, area, cargo, entrada.inicio, entrada.fim ?? null, codigoAutor);
        const repositorio = this.factory.criarPeriodoAreaRepository();
        validarNovoPeriodo(periodo, await repositorio.listarDe(codigoUsuario), null, pessoa);
        return repositorio.criar(periodo);
    }

    async editar(codigoUsuario: string, codigoPeriodo: string, entrada: PeriodoAreaEntrada): Promise<PeriodoArea> {
        const pessoa = await this.pessoa(codigoUsuario);
        const anterior = await this.periodoDa(codigoUsuario, codigoPeriodo);
        const { area, cargo } = await this.areaECargo(entrada);
        const periodo = anterior.copiar({ area, cargo, inicio: entrada.inicio, fim: entrada.fim ?? null });
        const repositorio = this.factory.criarPeriodoAreaRepository();
        if (!(periodo.aberto && periodo.cargo?.codigo === anterior.cargo?.codigo)) await this.exigirPresidenteNaoVago(anterior);
        validarNovoPeriodo(periodo, await repositorio.listarDe(codigoUsuario), anterior, pessoa);
        return repositorio.editar(periodo);
    }

    async excluir(codigoUsuario: string, codigoPeriodo: string): Promise<void> {
        await this.pessoa(codigoUsuario);
        await this.exigirPresidenteNaoVago(await this.periodoDa(codigoUsuario, codigoPeriodo));
        await this.factory.criarPeriodoAreaRepository().excluir(codigoPeriodo);
    }

    /**
     * Sessão 31a: o cargo do presidente (posição 1) nunca fica vago. Encerrar, trocar o cargo ou excluir o último
     * período aberto nele = 400 PRESIDENTE_VAGO; antes, dá-se o cargo a outra pessoa.
     */
    private async exigirPresidenteNaoVago(anterior: PeriodoArea): Promise<void> {
        if (!anterior.aberto || !anterior.cargo) return;
        const cargo = await this.factory.criarCargoRepository().buscarPorCodigo(anterior.cargo.codigo);
        if (!cargo?.ehPresidente()) return;
        const areas = await this.factory.criarAreaRepository().listar();
        const periodos = await this.factory.criarPeriodoAreaRepository().listarDasAreas(areas.map((a) => a.codigo));
        const outros = periodos.filter((p) => p.aberto && p.cargo?.codigo === cargo.codigo && p.codigo !== anterior.codigo);
        if (outros.length === 0) throw new ErroValidacao(MENSAGENS_DE_ERRO.HIERARQUIA.PRESIDENTE_VAGO, "PRESIDENTE_VAGO");
    }

    private async pessoa(codigoUsuario: string): Promise<Usuario> {
        const pessoa = await this.factory.criarUsuarioRepository().buscarPorCodigo(codigoUsuario);
        if (!pessoa) throw new ErroNaoEncontrado("Usuário não encontrado.");
        return pessoa;
    }

    /** Período de outra pessoa = 404, como se não existisse. */
    private async periodoDa(codigoUsuario: string, codigoPeriodo: string): Promise<PeriodoArea> {
        const periodo = await this.factory.criarPeriodoAreaRepository().buscarPorCodigo(codigoPeriodo);
        if (!periodo || periodo.codigoUsuario !== codigoUsuario) throw new ErroNaoEncontrado("Período não encontrado.");
        return periodo;
    }

    private async areaECargo(entrada: PeriodoAreaEntrada) {
        const area = await this.factory.criarAreaRepository().buscarPorCodigo(entrada.codigoArea);
        if (!area) throw new ErroNaoEncontrado("Área não encontrada.");
        let cargo = null;
        if (entrada.codigoCargo) {
            cargo = await this.factory.criarCargoRepository().buscarPorCodigo(entrada.codigoCargo);
            if (!cargo) throw new ErroNaoEncontrado("Cargo não encontrado.");
        }
        return { area, cargo };
    }
}
