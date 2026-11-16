-- Sessão 21: kanban editável por projeto. Cada projeto tem as suas colunas; a tarefa de projeto fica numa delas.
-- Pode rodar de novo sem quebrar.

CREATE TABLE IF NOT EXISTS colunas_projeto (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_codigo UUID NOT NULL REFERENCES projetos(codigo) ON DELETE CASCADE,
    nome VARCHAR(40) NOT NULL,
    cor VARCHAR(10) NOT NULL CHECK (cor IN ('cinza', 'azul', 'verde', 'amarelo', 'laranja', 'vermelho', 'roxo', 'rosa')),
    ordem INT NOT NULL,
    papel VARCHAR(10) NOT NULL CHECK (papel IN ('entrada', 'meio', 'concluida')),
    UNIQUE (codigo, projeto_codigo)
);

-- Uma coluna de entrada, uma concluída e nomes sem repetir (maiúsculas não contam) por projeto.
CREATE UNIQUE INDEX IF NOT EXISTS idx_colunas_projeto_entrada ON colunas_projeto (projeto_codigo) WHERE papel = 'entrada';
CREATE UNIQUE INDEX IF NOT EXISTS idx_colunas_projeto_concluida ON colunas_projeto (projeto_codigo) WHERE papel = 'concluida';
CREATE UNIQUE INDEX IF NOT EXISTS idx_colunas_projeto_nome ON colunas_projeto (projeto_codigo, lower(nome));

ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS coluna_codigo UUID NULL;

-- Todo projeto sem colunas recebe as quatro padrão.
INSERT INTO colunas_projeto (projeto_codigo, nome, cor, ordem, papel)
SELECT p.codigo, c.nome, c.cor, c.ordem, c.papel
FROM projetos p
CROSS JOIN (VALUES
    ('A fazer', 'cinza', 0, 'entrada'),
    ('Fazendo', 'azul', 1, 'meio'),
    ('Revisando', 'amarelo', 2, 'meio'),
    ('Concluído', 'verde', 3, 'concluida')
) AS c (nome, cor, ordem, papel)
WHERE NOT EXISTS (SELECT 1 FROM colunas_projeto cp WHERE cp.projeto_codigo = p.codigo);

-- Cada tarefa de projeto vai para a coluna que corresponde ao status.
UPDATE tarefas t
SET coluna_codigo = (
    SELECT cp.codigo FROM colunas_projeto cp
    WHERE cp.projeto_codigo = t.projeto_codigo
      AND cp.papel = CASE t.status::text
                         WHEN 'pendente' THEN 'entrada'
                         WHEN 'andamento' THEN 'meio'
                         ELSE 'concluida'
                     END
    ORDER BY cp.ordem
    LIMIT 1
)
WHERE t.projeto_codigo IS NOT NULL AND t.coluna_codigo IS NULL;

-- Acerto de conclusão: concluída sem data recebe o prazo; não concluída não guarda data nem autor da conclusão.
UPDATE tarefas SET data_conclusao = data_fim WHERE status = 'concluida' AND data_conclusao IS NULL;
UPDATE tarefas SET data_conclusao = NULL, concluida_por_codigo = NULL
WHERE status <> 'concluida' AND (data_conclusao IS NOT NULL OR concluida_por_codigo IS NOT NULL);

DO $$
BEGIN
    -- NO ACTION (e não RESTRICT nem CASCADE): ao excluir o projeto, o banco confere só no fim do comando,
    -- quando tarefas e colunas já saíram juntas. Excluir uma coluna com tarefa continua barrado.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_coluna_do_projeto_fk') THEN
        ALTER TABLE tarefas ADD CONSTRAINT tarefas_coluna_do_projeto_fk
            FOREIGN KEY (coluna_codigo, projeto_codigo) REFERENCES colunas_projeto (codigo, projeto_codigo);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_coluna_com_projeto') THEN
        ALTER TABLE tarefas ADD CONSTRAINT tarefas_coluna_com_projeto
            CHECK ((projeto_codigo IS NULL) = (coluna_codigo IS NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_conclusao_coerente') THEN
        ALTER TABLE tarefas ADD CONSTRAINT tarefas_conclusao_coerente
            CHECK ((status = 'concluida') = (data_conclusao IS NOT NULL));
    END IF;
END $$;
