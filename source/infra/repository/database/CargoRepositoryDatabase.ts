import Cargo from "../../../domain/entity/Cargo";
import CargoRepositoryInterface from "../../../domain/interfaces/CargoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";
import { violacaoDeUnicidade } from "../../database/conversoes";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";

const SELECT = `SELECT c.codigo, c.nome, c.ativo, c.lidera_area, c.teto_semanal_horas, c.posicao,
    ARRAY(SELECT cp.permissao FROM cargo_permissoes cp WHERE cp.cargo_codigo = c.codigo ORDER BY cp.permissao) AS permissoes
    FROM cargos c`;

export default class CargoRepositoryDatabase implements CargoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async listar(): Promise<Cargo[]> {
        const linhas = await this.conexao.consultar(`${SELECT} ORDER BY c.posicao, c.nome`);
        return linhas.map(paraEntidade);
    }

    async buscarPorCodigo(codigo: string): Promise<Cargo | null> {
        const linhas = await this.conexao.consultar(`${SELECT} WHERE c.codigo = $1`, [codigo]);
        return linhas.length ? paraEntidade(linhas[0]) : null;
    }

    async criar(cargo: Cargo): Promise<Cargo> {
        await this.conexao.transacao(async (conexao) => {
            await this.executar(
                conexao,
                "INSERT INTO cargos (codigo, nome, ativo, lidera_area, teto_semanal_horas, posicao) VALUES ($1, $2, $3, $4, $5, $6)",
                [cargo.codigo, cargo.nome, cargo.ativo, cargo.lideraArea, cargo.tetoSemanalHoras, cargo.posicao],
            );
            await gravarPermissoes(conexao, cargo);
        });
        return cargo;
    }

    async editar(cargo: Cargo): Promise<Cargo> {
        await this.conexao.transacao(async (conexao) => {
            const linhas = await this.executar(
                conexao,
                "UPDATE cargos SET nome = $2, ativo = $3, lidera_area = $4, teto_semanal_horas = $5, posicao = $6 WHERE codigo = $1 RETURNING codigo",
                [cargo.codigo, cargo.nome, cargo.ativo, cargo.lideraArea, cargo.tetoSemanalHoras, cargo.posicao],
            );
            if (linhas.length === 0) throw new ErroNaoEncontrado("Cargo não encontrado.");
            await gravarPermissoes(conexao, cargo);
        });
        return cargo;
    }

    private async executar(conexao: ConexaoBanco, sql: string, parametros: unknown[]): Promise<any[]> {
        try {
            return await conexao.consultar(sql, parametros);
        } catch (erro) {
            if (violacaoDeUnicidade(erro) && String((erro as any).constraint ?? "").includes("presidente")) {
                throw new ErroConflito("Já existe um cargo de presidente (posição 1).", "PRESIDENTE_UNICO");
            }
            if (violacaoDeUnicidade(erro)) throw new ErroConflito("Já existe um cargo com esse nome.", "CARGO_DUPLICADO");
            throw erro;
        }
    }
}

function paraEntidade(linha: any): Cargo {
    return new Cargo(
        linha.nome,
        linha.ativo,
        linha.codigo,
        linha.lidera_area,
        linha.teto_semanal_horas,
        linha.posicao,
        linha.permissoes ?? [],
    );
}

/** Regrava a lista do cargo (a do presidente é sempre todas, então também vai inteira). */
async function gravarPermissoes(conexao: ConexaoBanco, cargo: Cargo): Promise<void> {
    await conexao.consultar("DELETE FROM cargo_permissoes WHERE cargo_codigo = $1", [cargo.codigo]);
    if (cargo.permissoes.length === 0) return;
    await conexao.consultar("INSERT INTO cargo_permissoes (cargo_codigo, permissao) SELECT $1, unnest($2::text[])", [
        cargo.codigo,
        [...cargo.permissoes],
    ]);
}
