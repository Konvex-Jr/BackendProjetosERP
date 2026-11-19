-- Sessão 24a: dificuldade da tarefa, horas por dificuldade e teto semanal por cargo.
-- Pode rodar de novo sem quebrar.

ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS dificuldade VARCHAR(10) NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_dificuldade_valida') THEN
        ALTER TABLE tarefas ADD CONSTRAINT tarefas_dificuldade_valida CHECK (dificuldade IN ('rapida', 'facil', 'media', 'dificil'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS horas_dificuldade (
    dificuldade VARCHAR(10) PRIMARY KEY CHECK (dificuldade IN ('rapida', 'facil', 'media', 'dificil')),
    horas NUMERIC(4, 1) NOT NULL CHECK (horas BETWEEN 0.5 AND 40)
);

INSERT INTO horas_dificuldade (dificuldade, horas) VALUES
    ('rapida', 1),
    ('facil', 2),
    ('media', 4),
    ('dificil', 8)
ON CONFLICT DO NOTHING;

-- Teto de horas por semana: padrão 10; diretoria, presidência e vice-presidência 20.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cargos' AND column_name = 'teto_semanal_horas') THEN
        ALTER TABLE cargos ADD COLUMN teto_semanal_horas SMALLINT NOT NULL DEFAULT 10 CHECK (teto_semanal_horas BETWEEN 1 AND 40);
        UPDATE cargos SET teto_semanal_horas = 20 WHERE unaccent(lower(nome)) ~ '^(diretor|presidente|vice)';
    END IF;
END $$;

-- A alocação manual por participação saiu: a carga vem das tarefas (dificuldade → horas).
ALTER TABLE projeto_membros DROP COLUMN IF EXISTS alocacao;
