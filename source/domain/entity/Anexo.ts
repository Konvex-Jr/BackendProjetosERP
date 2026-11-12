import { v4 as uuid } from "uuid";
import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { DonoAnexo, extensaoDe, LIMITE_ANEXO_BYTES, TIPOS_ANEXO } from "../enum/Anexo";
import { Referencia } from "./Conhecimento";

const M = MENSAGENS_DE_ERRO.ANEXO;

export interface DadosAnexo {
    codigo?: string;
    donoTipo: DonoAnexo;
    donoCodigo: string;
    nome: string;
    tamanhoBytes: number;
    /** Nome do arquivo no disco (gerado; nunca vem de quem envia). */
    arquivo?: string;
    enviadoPor: Referencia | null;
    enviadoEm?: Date;
}

// eslint-disable-next-line no-control-regex -- tirar os caracteres de controle é o objetivo
const CARACTERES_PROIBIDOS = /[\u0000-\u001f\u007f"]/g;

/** Arquivo anexado a um documento de pasta, a um item da Base ou a uma iniciativa. */
export default class Anexo {
    readonly codigo: string;
    readonly donoTipo: DonoAnexo;
    readonly donoCodigo: string;
    readonly nome: string;
    readonly tipoMime: string;
    readonly tamanhoBytes: number;
    readonly arquivo: string;
    readonly enviadoPor: Referencia | null;
    readonly enviadoEm: Date;

    constructor(dados: DadosAnexo) {
        this.codigo = dados.codigo ?? uuid();
        this.donoTipo = dados.donoTipo;
        this.donoCodigo = dados.donoCodigo;
        // Só o nome, sem caminho, e sem caracteres de controle.
        this.nome = String(dados.nome ?? "")
            .split(/[\\/]/)
            .pop()!
            .replace(CARACTERES_PROIBIDOS, "")
            .trim();
        this.tamanhoBytes = dados.tamanhoBytes;
        this.arquivo = dados.arquivo ?? uuid();
        this.enviadoPor = dados.enviadoPor;
        this.enviadoEm = dados.enviadoEm ?? new Date();
        this.tipoMime = TIPOS_ANEXO[extensaoDe(this.nome)] ?? "";
        this.validar();
    }

    get extensao(): string {
        return extensaoDe(this.nome);
    }

    private validar(): void {
        if (!Object.values(DonoAnexo).includes(this.donoTipo)) throw new ErroValidacao(M.DONO_INVALIDO, "DONO_ANEXO_INVALIDO");
        if (!this.nome) throw new ErroValidacao(M.NOME_OBRIGATORIO, "NOME_ANEXO_OBRIGATORIO");
        if (this.nome.length > 255) throw new ErroValidacao(M.NOME_LONGO, "NOME_ANEXO_LONGO");
        if (!this.tipoMime) throw new ErroValidacao(M.TIPO_NAO_ACEITO, "TIPO_ANEXO_NAO_ACEITO");
        if (!Number.isInteger(this.tamanhoBytes) || this.tamanhoBytes <= 0) throw new ErroValidacao(M.VAZIO, "ANEXO_VAZIO");
        if (this.tamanhoBytes > LIMITE_ANEXO_BYTES) throw new ErroValidacao(M.GRANDE_DEMAIS, "ANEXO_GRANDE_DEMAIS");
    }

    /** O que a API mostra (sem o nome do arquivo no disco). */
    toJSON() {
        return {
            codigo: this.codigo,
            nome: this.nome,
            tipoMime: this.tipoMime,
            tamanhoBytes: this.tamanhoBytes,
            enviadoPor: this.enviadoPor,
            enviadoEm: this.enviadoEm,
        };
    }
}
