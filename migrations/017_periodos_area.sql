-- Sessão 23a: a pessoa passa a ter vários períodos em áreas, cada um com cargo opcional.
-- Substitui usuarios.area_codigo/cargo_codigo e o histórico de áreas e cargos.
-- Voltar = restaurar o pg_dump feito antes do deploy.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE cargos ADD COLUMN IF NOT EXISTS lidera_area BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE cargos SET lidera_area = TRUE WHERE unaccent(lower(nome)) ~ '^(gerente|diretor)';

CREATE TABLE IF NOT EXISTS periodos_area (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_codigo UUID NOT NULL REFERENCES usuarios(codigo) ON DELETE RESTRICT,
    area_codigo UUID NOT NULL REFERENCES areas(codigo) ON DELETE RESTRICT,
    cargo_codigo UUID REFERENCES cargos(codigo) ON DELETE RESTRICT,
    inicio DATE NOT NULL,
    fim DATE,
    registrado_por UUID REFERENCES usuarios(codigo) ON DELETE SET NULL,
    registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT periodos_area_fim_depois_do_inicio CHECK (fim IS NULL OR fim > inicio),
    CONSTRAINT periodos_area_sem_sobreposicao EXCLUDE USING gist (
        usuario_codigo WITH =,
        area_codigo WITH =,
        daterange(inicio, fim, '[)') WITH &&
    )
);
CREATE INDEX IF NOT EXISTS idx_periodos_area_usuario ON periodos_area(usuario_codigo);

-- Carga: um período por pessoa que hoje tem área (só roda enquanto a coluna antiga existe).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usuarios' AND column_name = 'area_codigo'
    ) THEN
        INSERT INTO periodos_area (usuario_codigo, area_codigo, cargo_codigo, inicio, fim)
        SELECT codigo, area_codigo, cargo_codigo,
               CASE WHEN fim IS NULL THEN inicio ELSE LEAST(inicio, fim - 1) END,
               fim
        FROM (
            SELECT u.codigo, u.area_codigo, u.cargo_codigo,
                   COALESCE(
                       u.data_entrada,
                       (SELECT max(h.data_vigencia) FROM historico_areas h
                        WHERE h.usuario_codigo = u.codigo AND h.area_nova_codigo = u.area_codigo),
                       CURRENT_DATE
                   ) AS inicio,
                   CASE WHEN u.status IN ('alumni', 'inativo') THEN COALESCE(u.data_saida, CURRENT_DATE) END AS fim
            FROM usuarios u
            WHERE u.area_codigo IS NOT NULL
        ) base;
    END IF;
END $$;

DROP TABLE IF EXISTS historico_areas, historico_cargos;
DROP INDEX IF EXISTS idx_usuarios_area;
ALTER TABLE usuarios DROP COLUMN IF EXISTS area_codigo, DROP COLUMN IF EXISTS cargo_codigo;
