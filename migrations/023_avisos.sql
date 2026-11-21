-- Sessão 26a: central de avisos (tarefa recebida e capacitação nova).
-- Pode rodar de novo sem quebrar.

CREATE TABLE IF NOT EXISTS avisos (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_codigo UUID NOT NULL REFERENCES usuarios(codigo) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('tarefa_recebida','capacitacao_nova')),
    tarefa_codigo UUID NULL REFERENCES tarefas(codigo) ON DELETE CASCADE,
    capacitacao_codigo UUID NULL REFERENCES capacitacoes(codigo) ON DELETE CASCADE,
    autor_codigo UUID NULL REFERENCES usuarios(codigo) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    lido_em TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS idx_avisos_usuario_criado ON avisos(usuario_codigo, criado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS avisos_tarefa_nao_lida ON avisos (usuario_codigo, tarefa_codigo)
    WHERE tipo = 'tarefa_recebida' AND lido_em IS NULL;
