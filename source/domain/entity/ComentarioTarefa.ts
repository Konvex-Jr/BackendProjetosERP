import { v4 as uuid } from "uuid";
import Usuario from "./Usuario";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";

/** Comentário numa tarefa (sessão 8b). Cada um apaga o próprio; líder e gestão apagam qualquer um. */
export default class ComentarioTarefa {
    readonly codigo: string;
    readonly codigoTarefa: string;
    readonly autor: Usuario;
    readonly texto: string;
    readonly criadoEm: Date;

    constructor(codigoTarefa: string, autor: Usuario, texto: string, criadoEm: Date = new Date(), codigo?: string) {
        this.codigo = codigo ?? uuid();
        this.codigoTarefa = codigoTarefa;
        this.autor = autor;
        this.texto = String(texto ?? "").trim();
        this.criadoEm = criadoEm;
        if (!this.texto) throw new ErroValidacao("Escreva o comentário.", "COMENTARIO_VAZIO");
        if (this.texto.length > 2000) throw new ErroValidacao("O comentário deve ter até 2000 caracteres.", "COMENTARIO_LONGO");
    }

    toJSON() {
        return {
            codigo: this.codigo,
            codigoTarefa: this.codigoTarefa,
            autor: {
                codigo: this.autor.codigo,
                nome: this.autor.nome,
                nomeExibicao: this.autor.nomeExibicao,
                avatarUrl: this.autor.avatarUrl,
            },
            texto: this.texto,
            criadoEm: this.criadoEm,
        };
    }
}
