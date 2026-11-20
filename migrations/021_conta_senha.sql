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

-- Revogado por rotação (girado) x por logout, troca de senha ou inativação. Só reapresentar um
-- token girado indica vazamento e derruba todas as sessões. Tokens já revogados antes desta
-- migração contam como girados (mantém a regra de antes); o bloco roda uma vez só.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'refresh_tokens' AND column_name = 'girado') THEN
        ALTER TABLE refresh_tokens ADD COLUMN girado BOOLEAN NOT NULL DEFAULT FALSE;
        UPDATE refresh_tokens SET girado = TRUE WHERE revogado_em IS NOT NULL;
    END IF;
END $$;
