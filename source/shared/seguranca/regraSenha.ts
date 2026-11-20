import { ErroValidacao } from "../erros/ErroValidacao";

export type FaltaDaSenha = "tamanho" | "maiuscula" | "numero" | "especial";

const TEXTOS: Record<FaltaDaSenha, string> = {
    tamanho: "pelo menos 8 caracteres",
    maiuscula: "uma letra maiúscula",
    numero: "um número",
    especial: "um caractere especial",
};

/** O que falta para a senha nova cumprir a regra (vazio = serve). Vale no link e na troca do perfil, não no login. */
export function faltasDaSenha(senha: string): FaltaDaSenha[] {
    const faltas: FaltaDaSenha[] = [];
    if (senha.length < 8) faltas.push("tamanho");
    if (!/\p{Lu}/u.test(senha)) faltas.push("maiuscula");
    if (!/\p{Nd}/u.test(senha)) faltas.push("numero");
    if (!/[^\p{L}\p{Nd}]/u.test(senha)) faltas.push("especial");
    return faltas;
}

export function validarNovaSenha(senha: unknown): string {
    const faltas = typeof senha === "string" ? faltasDaSenha(senha) : (Object.keys(TEXTOS) as FaltaDaSenha[]);
    if (typeof senha !== "string" || faltas.length > 0) {
        const itens = faltas.map((f) => TEXTOS[f]);
        const lista = itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0];
        throw new ErroValidacao(`A senha precisa ter ${lista}.`, "SENHA_FRACA");
    }
    return senha;
}

export function validarConfirmacao(senha: string, confirmacao: unknown): void {
    if (confirmacao !== senha) throw new ErroValidacao("A confirmação da senha não é igual à senha.", "SENHA_CONFIRMACAO_DIFERENTE");
}
