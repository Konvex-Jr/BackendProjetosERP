-- Sessão 23b: projetos internos e projeto geral por área. A tarefa avulsa (categoria) deixa de existir:
-- toda tarefa passa a ter projeto. Pode rodar de novo sem quebrar.

ALTER TABLE projetos ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'cliente';
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS geral_da_area BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projetos_tipo_valido') THEN
        ALTER TABLE projetos ADD CONSTRAINT projetos_tipo_valido CHECK (tipo IN ('cliente', 'interno'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projetos_interno_com_area') THEN
        ALTER TABLE projetos ADD CONSTRAINT projetos_interno_com_area CHECK (tipo = 'cliente' OR area_codigo IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projetos_geral_fixo') THEN
        ALTER TABLE projetos ADD CONSTRAINT projetos_geral_fixo CHECK (NOT geral_da_area OR (tipo = 'interno' AND NOT sigiloso));
    END IF;
END $$;

-- Um projeto geral por área.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projetos_geral_area ON projetos (area_codigo) WHERE geral_da_area;

-- Cria a área de cada categoria que tem tarefa avulsa e ainda não tem área com esse nome (sem acento e sem maiúsculas).
DO $$
DECLARE
    cat RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tarefas' AND column_name = 'categoria') THEN
        FOR cat IN
            SELECT * FROM (VALUES
                ('inovacao', 'Inovação'),
                ('execucao', 'Execução'),
                ('capacitacao', 'Capacitação')
            ) AS c (codigo, nome)
        LOOP
            IF EXISTS (SELECT 1 FROM tarefas WHERE categoria = cat.codigo)
               AND NOT EXISTS (SELECT 1 FROM areas WHERE lower(unaccent(nome)) = cat.codigo) THEN
                INSERT INTO areas (nome, area_pai_codigo)
                VALUES (cat.nome, (
                    SELECT codigo FROM areas
                    WHERE lower(unaccent(nome)) = 'projetos' OR area_pai_codigo IS NULL
                    ORDER BY (lower(unaccent(nome)) = 'projetos') DESC, nome
                    LIMIT 1
                ));
            END IF;
        END LOOP;
    END IF;
END $$;

-- Cada área sem projeto geral ganha o seu (arquivado se a área estiver inativa).
INSERT INTO projetos (nome, descricao, data_inicio, data_fim, status, area_codigo, tipo, geral_da_area)
SELECT a.nome || ' · geral', 'Tarefas da área ' || a.nome || ' que ainda não são projeto.',
       (now() AT TIME ZONE 'America/Sao_Paulo')::date, DATE '2099-12-31',
       CASE WHEN a.ativa THEN 'em_execucao' ELSE 'arquivado' END::status_projeto,
       a.codigo, 'interno', true
FROM areas a
WHERE NOT EXISTS (SELECT 1 FROM projetos p WHERE p.area_codigo = a.codigo AND p.geral_da_area);

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

-- As avulsas vão para o projeto geral da área da categoria, na coluna que corresponde ao status.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tarefas' AND column_name = 'categoria') THEN
        ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS tarefas_projeto_ou_categoria;
        ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS tarefas_categoria_valida;

        UPDATE tarefas t
        SET projeto_codigo = g.codigo,
            coluna_codigo = (
                SELECT cp.codigo FROM colunas_projeto cp
                WHERE cp.projeto_codigo = g.codigo
                  AND cp.papel = CASE t.status::text
                                     WHEN 'pendente' THEN 'entrada'
                                     WHEN 'andamento' THEN 'meio'
                                     ELSE 'concluida'
                                 END
                ORDER BY cp.ordem
                LIMIT 1
            )
        FROM areas a
        JOIN projetos g ON g.area_codigo = a.codigo AND g.geral_da_area
        WHERE t.projeto_codigo IS NULL
          AND lower(unaccent(a.nome)) = t.categoria;

        DROP INDEX IF EXISTS idx_tarefas_categoria;
        ALTER TABLE tarefas DROP COLUMN categoria;
    END IF;
END $$;

ALTER TABLE tarefas ALTER COLUMN projeto_codigo SET NOT NULL;
