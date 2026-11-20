-- Migração 022 (sessão 25b): e-mail pessoal, motivo da saída, fim do trainee, cursos fixos e fim do status Alumni.
-- Alumni antigo vira inativo com motivo 'Alumni' (a data de saída fica). A migração NÃO inventa fim_trainee:
-- ninguém sabe a data real, então fica NULL até a gestão informar.
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS email_pessoal VARCHAR(254),
    ADD COLUMN IF NOT EXISTS motivo_saida VARCHAR(500),
    ADD COLUMN IF NOT EXISTS fim_trainee DATE;

UPDATE usuarios SET motivo_saida = 'Alumni' WHERE status::text = 'alumni';

ALTER TYPE status_pessoa RENAME TO status_pessoa_021;
CREATE TYPE status_pessoa AS ENUM ('ativo', 'trainee', 'inativo');
ALTER TABLE usuarios ALTER COLUMN status DROP DEFAULT;
ALTER TABLE usuarios ALTER COLUMN status TYPE status_pessoa
    USING (CASE WHEN status::text = 'alumni' THEN 'inativo' ELSE status::text END)::status_pessoa;
ALTER TABLE usuarios ALTER COLUMN status SET DEFAULT 'ativo';
DROP TYPE status_pessoa_021;

UPDATE usuarios SET curso = CASE
    WHEN lower(unaccent(trim(curso))) LIKE 'ciencia%comput%' OR lower(unaccent(trim(curso))) IN ('bcc', 'cc') THEN 'Ciência da Computação'
    WHEN lower(unaccent(trim(curso))) LIKE 'eng%mec%' THEN 'Engenharia Mecânica'
    WHEN lower(unaccent(trim(curso))) LIKE 'eng%eletr%' THEN 'Engenharia Elétrica'
    ELSE NULL
END
WHERE curso IS NOT NULL;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_curso_valido;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_curso_valido
    CHECK (curso IS NULL OR curso IN ('Ciência da Computação', 'Engenharia Mecânica', 'Engenharia Elétrica'));
