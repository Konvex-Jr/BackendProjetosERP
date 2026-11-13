/**
 * Base dos erros esperados (regra de negócio, validação, permissão). O ExpressHttp responde com
 * `codigoHttp`, a mensagem e o `codigo` (texto fixo, como "SENHA_CURTA", que o frontend pode testar).
 * Qualquer erro que não seja desta família vira 500 genérico (ver responderErro).
 */
export class ErroAplicacao extends Error {
    constructor(
        mensagem: string,
        public readonly codigo: string,
        public readonly codigoHttp: number = 400,
    ) {
        super(mensagem);

        this.name = this.constructor.name;

        // Mantém `instanceof ErroValidacao` (etc.) funcionando mesmo se o alvo de compilação
        // voltar a ES5, em que subclasses de Error perdem o protótipo (hoje é es2016).
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
