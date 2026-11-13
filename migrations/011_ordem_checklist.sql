-- Sessão de correções (13/11/2026): o checklist da tarefa não tinha ordem garantida. Sem coluna
-- de ordem nem ORDER BY, o PostgreSQL devolvia os itens na ordem física, que muda depois de um
-- UPDATE. Itens já gravados recebem a ordem física atual (a mais próxima da de criação).
ALTER TABLE tarefa_checklist_itens ADD COLUMN IF NOT EXISTS ordem SMALLINT NOT NULL DEFAULT 0;

UPDATE tarefa_checklist_itens i
SET ordem = n.ordem
FROM (
    SELECT codigo, (row_number() OVER (PARTITION BY tarefa_codigo ORDER BY ctid) - 1)::smallint AS ordem
    FROM tarefa_checklist_itens
) n
WHERE i.codigo = n.codigo;
