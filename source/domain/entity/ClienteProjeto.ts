import { ErroValidacao } from "../../shared/erros/ErroValidacao";
import { MENSAGENS_DE_ERRO } from "../../shared/erros/mensagensDeErro";

/**
 * Cliente de um projeto (sessão 31b). Nome e empresa são vistos por quem abre o projeto;
 * telefone e e-mail só por quem tem `clientes.ver` (a rota corta, ver `clientesParaResposta`).
 */
export interface ClienteProjeto {
    nome: string;
    empresa: string | null;
    telefone: string | null;
    email: string | null;
}

export const MAXIMO_CLIENTES = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(valor: unknown, maximo: number, campo: string): string | null {
    if (valor === undefined || valor === null) return null;
    if (typeof valor !== "string") throw new ErroValidacao(MENSAGENS_DE_ERRO.CLIENTES.CAMPO_INVALIDO(campo, maximo), "CLIENTE_INVALIDO");
    const limpo = valor.trim();
    if (limpo.length > maximo) throw new ErroValidacao(MENSAGENS_DE_ERRO.CLIENTES.CAMPO_INVALIDO(campo, maximo), "CLIENTE_INVALIDO");
    return limpo || null;
}

/** Confere e normaliza a lista que chega da API ou do banco. Erro diz qual cliente e qual campo. */
export function montarClientes(lista: unknown): ClienteProjeto[] {
    if (lista === undefined || lista === null) return [];
    if (!Array.isArray(lista) || lista.length > MAXIMO_CLIENTES) {
        throw new ErroValidacao(MENSAGENS_DE_ERRO.CLIENTES.LISTA_INVALIDA, "CLIENTES_INVALIDOS");
    }
    return lista.map((item: any, i) => {
        const n = i + 1;
        if (!item || typeof item !== "object") throw new ErroValidacao(MENSAGENS_DE_ERRO.CLIENTES.LISTA_INVALIDA, "CLIENTES_INVALIDOS");
        const nome = texto(item.nome, 150, `nome do cliente ${n}`);
        if (!nome) throw new ErroValidacao(MENSAGENS_DE_ERRO.CLIENTES.NOME_OBRIGATORIO(n), "CLIENTE_SEM_NOME");
        const telefone = texto(item.telefone, 30, `telefone do cliente ${n}`);
        if (telefone) {
            const digitos = telefone.replace(/\D/g, "").length;
            if (digitos < 10 || digitos > 13)
                throw new ErroValidacao(MENSAGENS_DE_ERRO.CLIENTES.TELEFONE_INVALIDO(n), "CLIENTE_TELEFONE_INVALIDO");
        }
        const email = texto(item.email, 254, `e-mail do cliente ${n}`);
        if (email && !EMAIL.test(email)) throw new ErroValidacao(MENSAGENS_DE_ERRO.CLIENTES.EMAIL_INVALIDO(n), "CLIENTE_EMAIL_INVALIDO");
        return { nome, empresa: texto(item.empresa, 150, `empresa do cliente ${n}`), telefone, email };
    });
}

/** Sem `clientes.ver`: só nome e empresa. */
export function clientesSemContato(clientes: readonly ClienteProjeto[]): Array<Pick<ClienteProjeto, "nome" | "empresa">> {
    return clientes.map((c) => ({ nome: c.nome, empresa: c.empresa }));
}
