/** Papel de acesso: diretor = ADMIN, gerente = MANAGER, membro = MEMBER. O que cada um pode está em catalogoPermissoes.ts. */
enum PerfilUsuario {
    DIRETOR = "diretor",
    GERENTE = "gerente",
    MEMBRO = "membro",
}

export default PerfilUsuario;
