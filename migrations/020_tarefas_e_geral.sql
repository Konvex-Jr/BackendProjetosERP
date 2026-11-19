-- Sessão 24b: responsável por item do checklist; projeto geral opcional por área e nome do geral sem bolinha.
-- Pode rodar de novo sem quebrar.

ALTER TABLE tarefa_checklist_itens
    ADD COLUMN IF NOT EXISTS responsavel_codigo UUID NULL REFERENCES usuarios(codigo) ON DELETE SET NULL;

-- Área sem projeto geral (ex.: Presidência Executiva): a gestão desliga pela tela. Todas começam com geral.
ALTER TABLE areas ADD COLUMN IF NOT EXISTS tem_geral BOOLEAN NOT NULL DEFAULT TRUE;

-- "<Área> · geral" vira "<Área> geral". Só os gerais; rodar de novo não muda nada.
UPDATE projetos p SET nome = a.nome || ' geral'
FROM areas a
WHERE p.geral_da_area AND p.area_codigo = a.codigo AND p.nome <> a.nome || ' geral';
