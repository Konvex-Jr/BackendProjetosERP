import Usuario from "../../domain/entity/Usuario";

/** A pessoa criada e se o e-mail de convite saiu (falha no envio não desfaz o cadastro). */
type CriarUsuarioOutput = { usuario: Usuario; conviteEnviado: boolean };
export default CriarUsuarioOutput;
