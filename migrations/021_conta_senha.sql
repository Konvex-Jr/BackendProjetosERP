-- Sessão 25a: links de senha (convite e redefinição) e "manter conectado" nos refresh tokens.
-- Pode rodar de novo sem quebrar.

CREATE TABLE IF NOT EXISTS links_senha (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_codigo UUID NOT NULL REFERENCES usuarios(codigo) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('convite','redefinir')),
    token_hash CHAR(64) NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_links_senha_usuario ON links_senha(usuario_codigo);

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS lembrar BOOLEAN NOT NULL DEFAULT FALSE;
