export class ErroAplicacao extends Error {
    constructor(
        mensagem: string,
        public readonly codigo: string,
        public readonly codigoHttp: number = 400,
    ) {
        super(mensagem);

        this.name = this.constructor.name;

        Object.setPrototypeOf(this, new.target.prototype);
    }
}