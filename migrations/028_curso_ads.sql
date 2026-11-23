-- Curso novo aceito no cadastro: Análise e Desenvolvimento de Sistemas.
-- Só troca o CHECK; pode rodar de novo sem quebrar.

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_curso_valido;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_curso_valido
    CHECK (curso IS NULL OR curso IN ('Análise e Desenvolvimento de Sistemas', 'Ciência da Computação', 'Engenharia Elétrica', 'Engenharia Mecânica'));
