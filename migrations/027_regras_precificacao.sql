-- Sessão 29: regras da simulação de precificação (multiplicadores, impostos, margens, validade).
-- Uma linha só (id = 1), com as regras em JSONB; sem linha, o sistema usa os valores padrão.
-- A simulação não é gravada. Pode rodar de novo sem quebrar.

CREATE TABLE IF NOT EXISTS regras_precificacao (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    regras JSONB NOT NULL CHECK (jsonb_typeof(regras) = 'object'),
    alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
