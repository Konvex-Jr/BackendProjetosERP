-- Sessão 22: foto de perfil enviada (arquivo WebP no disco) no lugar do link de avatar,
-- e fim das habilidades e tecnologias. Decisão do usuário em 18/11/2026: os dados de
-- avatar_url e de habilidades são descartados; só voltam pelo backup (pg_dump).
DROP TABLE IF EXISTS usuario_habilidades;
DROP TABLE IF EXISTS habilidades;
DROP TYPE IF EXISTS tipo_habilidade;

ALTER TABLE usuarios
    DROP COLUMN IF EXISTS avatar_url,
    ADD COLUMN IF NOT EXISTS foto TEXT;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_foto_formato;
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_foto_formato
    CHECK (foto ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$');
