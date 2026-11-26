import Cargo, { POSICAO_PADRAO } from "../../domain/entity/Cargo";
import RepositoryFactoryInterface from "../../domain/interfaces/RepositoryFactoryInterface";
import { ErroConflito } from "../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../shared/erros/ErroNaoEncontrado";
import { ErroProibido } from "../../shared/erros/ErroProibido";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";
import { PADRAO_MEMBRO } from "../../shared/seguranca/catalogoPermissoes";
import { ehPresidente, exigirAlterarCargo, exigirPosicaoAbaixo } from "../../shared/seguranca/hierarquia";
import { UsuarioAutenticado } from "../../shared/seguranca/permissoes";

/**
 * ADR-007: cria ou edita um cargo. Cargos não são excluídos, só desativados.
 * Sessão 31a: posição na hierarquia. Só se cria ou edita cargo abaixo do seu, sem subir acima de si; o cargo do
 * presidente só o presidente renomeia, e ele fica sempre na posição 1 e ativo. As permissões mudam pela grade
 * (GerirPermissoes); cargo novo começa com as de membro que quem cria também tem.
 */
export default class SalvarCargo {
    constructor(private readonly factory: RepositoryFactoryInterface) {}

    async execute(input: {
        codigo?: string;
        nome: string;
        ativo?: boolean;
        lideraArea?: boolean;
        tetoSemanalHoras?: number;
        posicao?: number;
        quem: UsuarioAutenticado;
    }): Promise<Cargo> {
        const repo = this.factory.criarCargoRepository();
        const atual = input.codigo ? await repo.buscarPorCodigo(input.codigo) : null;
        if (input.codigo && !atual) throw new ErroNaoEncontrado("Cargo não encontrado.");
        const posicao = input.posicao ?? atual?.posicao ?? POSICAO_PADRAO;
        const ativo = input.ativo ?? atual?.ativo ?? true;

        if (atual?.ehPresidente()) {
            if (!ehPresidente(input.quem) || posicao !== 1 || !ativo) {
                throw new ErroProibido(MENSAGENS_DE_ERRO.HIERARQUIA.PRESIDENTE_FIXO);
            }
        } else {
            if (atual) exigirAlterarCargo(input.quem, atual);
            if (!atual || posicao !== atual.posicao) exigirPosicaoAbaixo(input.quem, posicao);
        }
        if (atual && atual.ativo && !ativo && (await this.temOcupantes(atual.codigo))) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.CARGO.COM_OCUPANTES, "CARGO_COM_OCUPANTES");
        }

        const permissoes = atual ? atual.permissoes : PADRAO_MEMBRO.filter((p) => (input.quem.permissoes ?? []).includes(p));
        const cargo = new Cargo(
            input.nome,
            ativo,
            atual?.codigo,
            input.lideraArea ?? atual?.lideraArea ?? false,
            input.tetoSemanalHoras ?? atual?.tetoSemanalHoras,
            posicao,
            permissoes,
        );
        return atual ? repo.editar(cargo) : repo.criar(cargo);
    }

    private async temOcupantes(codigoCargo: string): Promise<boolean> {
        const areas = await this.factory.criarAreaRepository().listar();
        const periodos = await this.factory.criarPeriodoAreaRepository().listarDasAreas(areas.map((a) => a.codigo));
        return periodos.some((p) => p.aberto && p.cargo?.codigo === codigoCargo);
    }
}
