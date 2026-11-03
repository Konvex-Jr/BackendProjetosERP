-- Sessão 8b: líder do projeto, quem concluiu a tarefa e comentários em tarefas.

-- Líder: uma pessoa da equipe atual, escolhida pela gestão. Se sair da equipe, o projeto fica sem líder.
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS lider_codigo UUID REFERENCES usuarios(codigo) ON DELETE RESTRICT;

-- Quem concluiu a tarefa (a data já fica em data_conclusao).
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS concluida_por_codigo UUID REFERENCES usuarios(codigo) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS tarefa_comentarios (
    codigo UUID PRIMARY KEY,
    tarefa_codigo UUID NOT NULL REFERENCES tarefas(codigo) ON DELETE CASCADE,
    autor_codigo UUID NOT NULL REFERENCES usuarios(codigo) ON DELETE RESTRICT,
    texto TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tarefa_comentarios_tarefa ON tarefa_comentarios(tarefa_codigo, criado_em);
