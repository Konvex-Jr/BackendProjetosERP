import PeriodoArea, { erroSobreposicao, sobrepoe } from "../../../domain/entity/PeriodoArea";
import PeriodoAreaRepositoryInterface from "../../../domain/interfaces/PeriodoAreaRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

const UM_DIA = 86_400_000;

/** Ordem da trajetória: abertos primeiro, depois por início decrescente. */
function ordenar(a: PeriodoArea, b: PeriodoArea): number {
    if (a.aberto !== b.aberto) return a.aberto ? -1 : 1;
    return b.inicio.getTime() - a.inicio.getTime();
}

export default class PeriodoAreaRepositoryMemory implements PeriodoAreaRepositoryInterface {
    private periodos: PeriodoArea[] = [];

    async listarDe(codigoUsuario: string): Promise<PeriodoArea[]> {
        return this.periodos.filter((p) => p.codigoUsuario === codigoUsuario).sort(ordenar);
    }

    async listarAbertosDe(codigosUsuario: string[]): Promise<PeriodoArea[]> {
        return this.periodos
            .filter((p) => p.aberto && codigosUsuario.includes(p.codigoUsuario))
            .sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.area.nome.localeCompare(b.area.nome));
    }

    async buscarPorCodigo(codigo: string): Promise<PeriodoArea | null> {
        return this.periodos.find((p) => p.codigo === codigo) ?? null;
    }

    async criar(periodo: PeriodoArea): Promise<PeriodoArea> {
        this.conferirSobreposicao(periodo);
        this.periodos.push(periodo);
        return periodo;
    }

    async editar(periodo: PeriodoArea): Promise<PeriodoArea> {
        const indice = this.periodos.findIndex((p) => p.codigo === periodo.codigo);
        if (indice === -1) throw new ErroNaoEncontrado("Período não encontrado.");
        this.conferirSobreposicao(periodo);
        this.periodos[indice] = periodo;
        return periodo;
    }

    async excluir(codigo: string): Promise<void> {
        const antes = this.periodos.length;
        this.periodos = this.periodos.filter((p) => p.codigo !== codigo);
        if (this.periodos.length === antes) throw new ErroNaoEncontrado("Período não encontrado.");
    }

    async encerrarAbertosDe(codigoUsuario: string, fim: Date): Promise<number> {
        let encerrados = 0;
        this.periodos = this.periodos.map((p) => {
            if (p.codigoUsuario !== codigoUsuario || !p.aberto) return p;
            encerrados++;
            const dia = new Date(Math.max(fim.getTime(), p.inicio.getTime() + UM_DIA));
            // carregar: o fim pode ser amanhã (início hoje), como no banco.
            return PeriodoArea.carregar(p.codigoUsuario, p.area, p.cargo, p.inicio, dia, p.codigoRegistradoPor, p.codigo);
        });
        return encerrados;
    }

    /** Faz o papel da constraint de exclusão do banco. */
    private conferirSobreposicao(periodo: PeriodoArea): void {
        const conflito = this.periodos.find(
            (p) =>
                p.codigo !== periodo.codigo &&
                p.codigoUsuario === periodo.codigoUsuario &&
                p.area.codigo === periodo.area.codigo &&
                sobrepoe(p, periodo),
        );
        if (conflito) throw erroSobreposicao(conflito);
    }
}
