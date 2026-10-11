import SenioridadeUsuario from "../../../domain/Entity/SenioridadeUsuario";
import SenioridadeRepositoryInterface from "../../../domain/Interfaces/SenioridadeRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

export default class SenioridadeRepositoryDatabase implements SenioridadeRepositoryInterface {
    private readonly conexao: ConexaoBanco;

    constructor(conexao: ConexaoBanco) {
        this.conexao = conexao;
    }

    async listar(): Promise<SenioridadeUsuario[]> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo, nome, valor_hora FROM senioridades ORDER BY valor_hora",
        );
        return linhas.map((l) => this.paraEntidade(l));
    }

    async buscarPorCodigo(codigo: string): Promise<SenioridadeUsuario | null> {
        const linhas = await this.conexao.consultar(
            "SELECT codigo, nome, valor_hora FROM senioridades WHERE codigo = $1",
            [codigo],
        );
        return linhas.length > 0 ? this.paraEntidade(linhas[0]) : null;
    }

    private paraEntidade(linha: any): SenioridadeUsuario {
        return new SenioridadeUsuario(linha.codigo, linha.nome, Number(linha.valor_hora));
    }
}
