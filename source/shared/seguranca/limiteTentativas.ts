/**
 * Conta falhas por chave numa janela de tempo e diz quando bloquear (auditoria de 13/11/2026:
 * o login não tinha limite de tentativas). Fica em memória: a API roda num processo só, e
 * reiniciar o container zerar a contagem é aceitável.
 */
export class LimiteTentativas {
    private readonly falhas = new Map<string, number[]>();

    constructor(
        private readonly maximo: number,
        private readonly janelaMs: number,
        private readonly agora: () => number = Date.now,
    ) {}

    /** Falhas ainda dentro da janela; também descarta chaves velhas para o mapa não crescer. */
    private recentes(chave: string): number[] {
        const limite = this.agora() - this.janelaMs;
        const lista = (this.falhas.get(chave) ?? []).filter((t) => t > limite);
        if (lista.length) this.falhas.set(chave, lista);
        else this.falhas.delete(chave);
        return lista;
    }

    /** 0 se pode tentar; senão, quantos segundos faltam para liberar. */
    segundosBloqueado(chave: string): number {
        const lista = this.recentes(chave);
        if (lista.length < this.maximo) return 0;
        // Libera quando a falha mais antiga que ainda conta sai da janela.
        const liberaEm = lista[lista.length - this.maximo] + this.janelaMs;
        return Math.max(1, Math.ceil((liberaEm - this.agora()) / 1000));
    }

    registrarFalha(chave: string): void {
        this.falhas.set(chave, [...this.recentes(chave), this.agora()]);
        if (this.falhas.size > 10_000) this.limparVencidas();
    }

    limpar(chave: string): void {
        this.falhas.delete(chave);
    }

    private limparVencidas(): void {
        for (const chave of [...this.falhas.keys()]) this.recentes(chave);
    }
}
