-- Sessão 24b: responsável por item do checklist.
-- Pode rodar de novo sem quebrar.

ALTER TABLE tarefa_checklist_itens
    ADD COLUMN IF NOT EXISTS responsavel_codigo UUID NULL REFERENCES usuarios(codigo) ON DELETE SET NULL;
