-- Sessão 20: projetos sigilosos (com lista de acesso) e trainee com login.
-- Pode rodar de novo sem quebrar.

ALTER TABLE projetos
    ADD COLUMN IF NOT EXISTS sigiloso BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS criado_por_codigo UUID NULL REFERENCES usuarios(codigo) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS projeto_acesso (
    projeto_codigo UUID NOT NULL REFERENCES projetos(codigo) ON DELETE CASCADE,
    usuario_codigo UUID NOT NULL REFERENCES usuarios(codigo) ON DELETE CASCADE,
    PRIMARY KEY (projeto_codigo, usuario_codigo)
);

-- Trainee passa a entrar no sistema, sempre como membro e sem liderar projeto.
UPDATE projetos SET lider_codigo = NULL
WHERE lider_codigo IN (SELECT codigo FROM usuarios WHERE status = 'trainee');

UPDATE usuarios SET perfil = 'membro' WHERE status = 'trainee';

-- A coluna "ativo" acompanha STATUS_COM_ACESSO (ativo e trainee).
UPDATE usuarios SET ativo = true WHERE status = 'trainee';
