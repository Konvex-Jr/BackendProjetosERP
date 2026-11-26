import ClasseProjeto from "../../../domain/entity/ClasseProjeto";
import ClasseProjetoRepositoryInterface from "../../../domain/interfaces/ClasseProjetoRepositoryInterface";
import { ErroConflito } from "../../../shared/erros/ErroConflito";
import { ErroNaoEncontrado } from "../../../shared/erros/ErroNaoEncontrado";
import { MENSAGENS_DE_ERRO } from "../../../shared/erros/mensagensDeErro";

/** As mesmas classes iniciais da migração 031. */
export function classesIniciais(): ClasseProjeto[] {
    return [
        new ClasseProjeto("landing-page", "Landing page", 1),
        new ClasseProjeto("site-institucional", "Site institucional", 2),
        new ClasseProjeto("e-commerce", "E-commerce", 3),
        new ClasseProjeto("crm", "CRM", 4),
        new ClasseProjeto("saas", "SaaS", 5),
        new ClasseProjeto("aplicativo", "Aplicativo", 6),
        new ClasseProjeto("outro", "Outro", 7),
    ];
}

export default class ClasseProjetoRepositoryMemory implements ClasseProjetoRepositoryInterface {
    private classes: ClasseProjeto[] = classesIniciais();

    async listar(): Promise<ClasseProjeto[]> {
        return [...this.classes].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    }

    async buscarPorCodigo(codigo: string): Promise<ClasseProjeto | null> {
        return this.classes.find((c) => c.codigo === codigo) ?? null;
    }

    async criar(classe: ClasseProjeto): Promise<ClasseProjeto> {
        if (this.classes.some((c) => c.codigo === classe.codigo) || this.duplicada(classe)) {
            throw new ErroConflito(MENSAGENS_DE_ERRO.CLASSE.DUPLICADA, "CLASSE_DUPLICADA");
        }
        this.classes.push(classe);
        return classe;
    }

    async editar(classe: ClasseProjeto): Promise<ClasseProjeto> {
        const i = this.classes.findIndex((c) => c.codigo === classe.codigo);
        if (i === -1) throw new ErroNaoEncontrado(MENSAGENS_DE_ERRO.CLASSE.NAO_ENCONTRADA);
        if (this.duplicada(classe)) throw new ErroConflito(MENSAGENS_DE_ERRO.CLASSE.DUPLICADA, "CLASSE_DUPLICADA");
        this.classes[i] = classe;
        return classe;
    }

    private duplicada(classe: ClasseProjeto): boolean {
        const nome = classe.nome.trim().toLowerCase();
        return this.classes.some((c) => c.codigo !== classe.codigo && c.nome.trim().toLowerCase() === nome);
    }
}
