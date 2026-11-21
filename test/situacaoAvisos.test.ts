import Capacitacao from "../source/domain/entity/Capacitacao";
import Tarefa from "../source/domain/entity/Tarefa";
import StatusProjeto from "../source/domain/enum/StatusProjeto";
import StatusTarefa from "../source/domain/enum/StatusTarefa";
import { calcularSituacao } from "../source/domain/service/situacaoAvisos";

const HOJE = new Date("2026-11-18T00:00:00.000Z"); // quarta

function tarefa(codigo: string, fim: string, o: { status?: StatusTarefa; projeto?: StatusProjeto; resp?: string[] } = {}): Tarefa {
    return {
        codigo,
        titulo: `T ${codigo}`,
        dataFim: new Date(fim),
        status: o.status ?? StatusTarefa.ANDAMENTO,
        projeto: { codigo: "p1", nome: "Proj", status: o.projeto ?? StatusProjeto.EM_EXECUCAO },
        responsaveis: (o.resp ?? ["u1"]).map((c) => ({ codigo: c })),
    } as unknown as Tarefa;
}

function capacitacao(codigo: string, data: string, inscritos: string[]): Capacitacao {
    return {
        codigo,
        titulo: `C ${codigo}`,
        data: new Date(data),
        hora: "18:30",
        inscricaoDe: (u: string) => (inscritos.includes(u) ? { usuario: { codigo: u }, presente: null } : null),
    } as unknown as Capacitacao;
}

const calcular = (
    tarefas: Tarefa[],
    capacitacoes: Capacitacao[] = [],
    ocupacao: { codigoUsuario: string; nome: string; percentual: number }[] | null = null,
) => calcularSituacao({ codigoUsuario: "u1", hoje: HOJE, tarefas, capacitacoes, ocupacao });

describe("calcularSituacao", () => {
    it("separa atrasadas, a vencer (hoje e amanhã) e ignora depois", () => {
        const r = calcular([
            tarefa("a", "2026-11-17T15:00:00Z"),
            tarefa("b", "2026-11-18T15:00:00Z"),
            tarefa("c", "2026-11-19T15:00:00Z"),
            tarefa("d", "2026-11-20T15:00:00Z"),
        ]);
        expect(r.map((i) => i.tipo)).toEqual(["tarefas_atrasadas", "tarefas_a_vencer"]);
        expect(r[0]).toMatchObject({ tarefas: [{ codigo: "a", dataFim: "2026-11-17", projeto: { codigo: "p1", nome: "Proj" } }] });
        expect(r[1]).toMatchObject({ tarefas: [{ codigo: "b" }, { codigo: "c" }] });
    });

    it("ignora concluída, projeto concluído/arquivado e quem não é responsável", () => {
        const r = calcular([
            tarefa("a", "2026-11-10T00:00:00Z", { status: StatusTarefa.CONCLUIDA }),
            tarefa("b", "2026-11-10T00:00:00Z", { projeto: StatusProjeto.CONCLUIDO }),
            tarefa("c", "2026-11-10T00:00:00Z", { projeto: StatusProjeto.ARQUIVADO }),
            tarefa("d", "2026-11-10T00:00:00Z", { resp: ["u2"] }),
        ]);
        expect(r).toEqual([]);
    });

    it("ordena atrasadas da mais antiga para a mais recente", () => {
        const r = calcular([tarefa("novo", "2026-11-17T00:00:00Z"), tarefa("velho", "2026-11-01T00:00:00Z")]);
        expect(r[0]).toMatchObject({ tarefas: [{ codigo: "velho" }, { codigo: "novo" }] });
    });

    it("capacitação inscrita hoje ou amanhã aparece; outras não", () => {
        const r = calcular(
            [],
            [
                capacitacao("hoje", "2026-11-18T00:00:00Z", ["u1"]),
                capacitacao("amanha", "2026-11-19T00:00:00Z", ["u1"]),
                capacitacao("naoInscrita", "2026-11-18T00:00:00Z", []),
                capacitacao("depois", "2026-11-20T00:00:00Z", ["u1"]),
            ],
        );
        expect(r).toEqual([
            { tipo: "capacitacao_proxima", capacitacao: { codigo: "hoje", titulo: "C hoje", data: "2026-11-18", hora: "18:30" } },
            { tipo: "capacitacao_proxima", capacitacao: { codigo: "amanha", titulo: "C amanha", data: "2026-11-19", hora: "18:30" } },
        ]);
    });

    it("sobrecarga só para gestão e só acima de 100%, do maior para o menor", () => {
        const o = [
            { codigoUsuario: "x", nome: "X", percentual: 100 },
            { codigoUsuario: "y", nome: "Y", percentual: 130 },
            { codigoUsuario: "z", nome: "Z", percentual: 150 },
        ];
        expect(calcular([], [], null)).toEqual([]);
        expect(calcular([], [], o)).toEqual([
            {
                tipo: "sobrecarga",
                pessoas: [
                    { codigoUsuario: "z", nome: "Z", percentual: 150 },
                    { codigoUsuario: "y", nome: "Y", percentual: 130 },
                ],
            },
        ]);
    });

    it("ordem: atrasadas, a vencer, capacitações, sobrecarga", () => {
        const r = calcular(
            [tarefa("a", "2026-11-10T00:00:00Z"), tarefa("b", "2026-11-18T00:00:00Z")],
            [capacitacao("c", "2026-11-18T00:00:00Z", ["u1"])],
            [{ codigoUsuario: "y", nome: "Y", percentual: 130 }],
        );
        expect(r.map((i) => i.tipo)).toEqual(["tarefas_atrasadas", "tarefas_a_vencer", "capacitacao_proxima", "sobrecarga"]);
    });
});
