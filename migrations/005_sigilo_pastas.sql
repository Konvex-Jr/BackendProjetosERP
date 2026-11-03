-- Sessão 9: sigilo das pastas de documentos (todos / gestao / projeto).
-- Pastas existentes ficam "todos" (comportamento anterior); a gestão revisa depois.
-- Documentos passam a ser só links (arquivo_url); a tabela não muda.

ALTER TABLE pastas ADD COLUMN IF NOT EXISTS sigilo TEXT NOT NULL DEFAULT 'todos';
ALTER TABLE pastas ADD COLUMN IF NOT EXISTS projeto_codigo UUID REFERENCES projetos(codigo) ON DELETE CASCADE;

ALTER TABLE pastas DROP CONSTRAINT IF EXISTS pastas_sigilo_valido;
ALTER TABLE pastas ADD CONSTRAINT pastas_sigilo_valido
    CHECK (sigilo IN ('todos', 'gestao', 'projeto'));

ALTER TABLE pastas DROP CONSTRAINT IF EXISTS pastas_projeto_conforme_sigilo;
ALTER TABLE pastas ADD CONSTRAINT pastas_projeto_conforme_sigilo
    CHECK ((sigilo = 'projeto') = (projeto_codigo IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_pastas_projeto ON pastas(projeto_codigo) WHERE projeto_codigo IS NOT NULL;
