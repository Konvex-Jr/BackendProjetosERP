-- Dificuldade vira parte do dia (25/11): cada nível vale uma % do dia da pessoa (teto semanal ÷ 5).
-- Antes valia um total de horas (1, 2, 4, 8) espalhado pelo prazo; os valores antigos são trocados pelo padrão.
-- A tabela mantém o nome horas_dificuldade. Pode rodar de novo sem quebrar.

ALTER TABLE horas_dificuldade DROP CONSTRAINT IF EXISTS horas_dificuldade_horas_check;
ALTER TABLE horas_dificuldade DROP CONSTRAINT IF EXISTS horas_dificuldade_percentual_check;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'horas_dificuldade' AND column_name = 'horas') THEN
        ALTER TABLE horas_dificuldade RENAME COLUMN horas TO percentual;
        ALTER TABLE horas_dificuldade ALTER COLUMN percentual TYPE SMALLINT USING 0;
        UPDATE horas_dificuldade SET percentual = CASE dificuldade
            WHEN 'rapida' THEN 25 WHEN 'facil' THEN 50 WHEN 'media' THEN 75 ELSE 100 END;
    END IF;
END $$;

ALTER TABLE horas_dificuldade ADD CONSTRAINT horas_dificuldade_percentual_check CHECK (percentual BETWEEN 5 AND 100);
