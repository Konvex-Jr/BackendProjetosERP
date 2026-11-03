-- Sessão 8c: tarefas avulsas (sem projeto), com categoria, e quem criou a tarefa.
-- Toda tarefa tem projeto OU categoria (nunca os dois, nunca nenhum).

ALTER TABLE tarefas ALTER COLUMN projeto_codigo DROP NOT NULL;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS criada_por_codigo UUID REFERENCES usuarios(codigo) ON DELETE RESTRICT;

ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS tarefas_categoria_valida;
ALTER TABLE tarefas ADD CONSTRAINT tarefas_categoria_valida
    CHECK (categoria IS NULL OR categoria IN ('inovacao', 'capacitacao', 'execucao'));

ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS tarefas_projeto_ou_categoria;
ALTER TABLE tarefas ADD CONSTRAINT tarefas_projeto_ou_categoria
    CHECK ((projeto_codigo IS NULL) <> (categoria IS NULL));

CREATE INDEX IF NOT EXISTS idx_tarefas_categoria ON tarefas(categoria) WHERE categoria IS NOT NULL;
