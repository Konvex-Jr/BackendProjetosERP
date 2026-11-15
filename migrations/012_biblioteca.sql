-- Biblioteca (sessão 17): Gestão (pastas/documentos), Base de Inteligência e Iniciativas viram a Biblioteca.
-- Decisão de 14/11/2026 ("começar do zero"): os dados dos três módulos antigos são APAGADOS, sem cópia.
-- Faça o backup do banco e da pasta de anexos antes. Os arquivos no disco dos anexos apagados saem depois,
-- com: node dist/source/scripts/conferirAnexos.js --apagar-sem-registro

-- Parte 1: cria a tabela.
CREATE TABLE IF NOT EXISTS biblioteca_itens (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(160) NOT NULL,
    conteudo TEXT NOT NULL DEFAULT '',
    links TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    projeto_codigo UUID REFERENCES projetos(codigo) ON DELETE SET NULL,
    sigilo TEXT NOT NULL DEFAULT 'todos',
    autor_codigo UUID REFERENCES usuarios(codigo) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT biblioteca_itens_sigilo CHECK (sigilo IN ('todos', 'gestao', 'projeto')),
    CONSTRAINT biblioteca_itens_sigilo_projeto CHECK (sigilo <> 'projeto' OR projeto_codigo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_itens_atualizado ON biblioteca_itens(atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_biblioteca_itens_projeto ON biblioteca_itens(projeto_codigo);
CREATE INDEX IF NOT EXISTS idx_biblioteca_itens_tags ON biblioteca_itens USING GIN (tags);

-- Parte 2: tarefas deixam de apontar para iniciativas.
DROP INDEX IF EXISTS idx_tarefas_iniciativa;
ALTER TABLE tarefas DROP COLUMN IF EXISTS iniciativa_codigo;

-- Parte 3: anexos só de itens da Biblioteca e de capacitações. Apaga antes os registros dos donos antigos,
-- senão o CHECK novo não entra.
DELETE FROM anexos WHERE dono_tipo IN ('documento', 'conhecimento', 'iniciativa');
ALTER TABLE anexos DROP CONSTRAINT IF EXISTS anexos_dono_valido;
ALTER TABLE anexos ADD CONSTRAINT anexos_dono_valido CHECK (dono_tipo IN ('biblioteca', 'capacitacao'));

-- Parte 4: tabelas dos módulos antigos (as de ligação antes das principais).
DROP TABLE IF EXISTS iniciativa_conhecimentos;
DROP TABLE IF EXISTS iniciativa_projetos;
DROP TABLE IF EXISTS iniciativas;
DROP TABLE IF EXISTS conhecimento_projetos;
DROP TABLE IF EXISTS conhecimentos;
DROP TABLE IF EXISTS documentos;
DROP TABLE IF EXISTS pastas;
