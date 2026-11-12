import Capacitacao from "../../../domain/entity/Capacitacao";
import { Referencia } from "../../../domain/entity/Conhecimento";
import CapacitacaoRepositoryInterface from "../../../domain/interfaces/CapacitacaoRepositoryInterface";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

export default class CapacitacaoRepositoryMemory implements CapacitacaoRepositoryInterface {
    private itens: Capacitacao[] = [];

    private indice(codigo: string): number {
        const i = this.itens.findIndex((c) => c.codigo === codigo);
        if (i === -1) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CAPACITACAO.NAO_ENCONTRADA);
        return i;
    }

    async listar(): Promise<Capacitacao[]> {
        return [...this.itens].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    }

    async buscarPorCodigo(codigo: string): Promise<Capacitacao | null> {
        return this.itens.find((c) => c.codigo === codigo) ?? null;
    }

    async criar(capacitacao: Capacitacao): Promise<Capacitacao> {
        this.itens.push(capacitacao);
        return capacitacao;
    }

    async editar(capacitacao: Capacitacao): Promise<Capacitacao> {
        const i = this.indice(capacitacao.codigo);
        this.itens[i] = capacitacao.com({ inscricoes: this.itens[i].inscricoes });
        return this.itens[i];
    }

    async excluir(codigo: string): Promise<void> {
        this.itens = this.itens.filter((c) => c.codigo !== codigo);
    }

    async inscrever(codigo: string, usuario: Referencia): Promise<boolean> {
        const i = this.indice(codigo);
        const atual = this.itens[i];
        if (atual.inscricaoDe(usuario.codigo)) return true;
        if (atual.vagasRestantes === 0) return false;
        this.itens[i] = atual.com({ inscricoes: [...atual.inscricoes, { usuario, presente: null }] });
        return true;
    }

    async cancelarInscricao(codigo: string, codigoUsuario: string): Promise<void> {
        const i = this.indice(codigo);
        this.itens[i] = this.itens[i].com({ inscricoes: this.itens[i].inscricoes.filter((x) => x.usuario.codigo !== codigoUsuario) });
    }

    async marcarPresencas(codigo: string, presentes: string[]): Promise<void> {
        const i = this.indice(codigo);
        this.itens[i] = this.itens[i].com({
            inscricoes: this.itens[i].inscricoes.map((x) => ({ ...x, presente: presentes.includes(x.usuario.codigo) })),
        });
    }
}
