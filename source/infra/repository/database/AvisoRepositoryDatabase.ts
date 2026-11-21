import AvisoRepositoryInterface, { NovoAviso, RegistroAviso, TipoAviso } from "../../../domain/interfaces/AvisoRepositoryInterface";
import ConexaoBanco from "../../database/ConexaoBanco";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Avisos no PostgreSQL. */
export default class AvisoRepositoryDatabase implements AvisoRepositoryInterface {
    constructor(private readonly conexao: ConexaoBanco) {}

    async criarVarios(avisos: NovoAviso[]): Promise<void> {
        for (const a of avisos) {
            await this.conexao.consultar(
                `INSERT INTO avisos (usuario_codigo, tipo, tarefa_codigo, capacitacao_codigo, autor_codigo)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (usuario_codigo, tarefa_codigo) WHERE tipo = 'tarefa_recebida' AND lido_em IS NULL DO NOTHING`,
                [a.codigoUsuario, a.tipo, a.codigoTarefa, a.codigoCapacitacao, a.codigoAutor],
            );
        }
    }

    async listarDoUsuario(codigoUsuario: string): Promise<RegistroAviso[]> {
        const linhas = await this.conexao.consultar(
            `SELECT codigo, usuario_codigo, tipo, tarefa_codigo, capacitacao_codigo, autor_codigo, criado_em, lido_em
             FROM avisos WHERE usuario_codigo = $1 ORDER BY criado_em DESC, codigo`,
            [codigoUsuario],
        );
        return linhas.map((l: any) => ({
            codigo: l.codigo,
            codigoUsuario: l.usuario_codigo,
            tipo: l.tipo as TipoAviso,
            codigoTarefa: l.tarefa_codigo,
            codigoCapacitacao: l.capacitacao_codigo,
            codigoAutor: l.autor_codigo,
            criadoEm: l.criado_em,
            lidoEm: l.lido_em,
        }));
    }

    async marcarLidos(codigoUsuario: string, codigos?: string[]): Promise<void> {
        if (!codigos) {
            await this.conexao.consultar("UPDATE avisos SET lido_em = now() WHERE usuario_codigo = $1 AND lido_em IS NULL", [
                codigoUsuario,
            ]);
            return;
        }
        const validos = codigos.filter((c) => UUID.test(c));
        if (!validos.length) return;
        await this.conexao.consultar(
            "UPDATE avisos SET lido_em = now() WHERE usuario_codigo = $1 AND lido_em IS NULL AND codigo = ANY($2::uuid[])",
            [codigoUsuario, validos],
        );
    }

    async apagarLidosAntes(codigoUsuario: string, limite: Date): Promise<void> {
        await this.conexao.consultar("DELETE FROM avisos WHERE usuario_codigo = $1 AND lido_em IS NOT NULL AND lido_em < $2", [
            codigoUsuario,
            limite,
        ]);
    }
}
