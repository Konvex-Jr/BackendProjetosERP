-- Sessão 13 (09/11/2026): capacitações pela API e perfil completo.
-- Decisões: só a gestão cria e edita; a gestão marca presença e conta horas; só quem
-- compareceu avalia; feedback com nome só para a gestão (o instrutor lê sem nome);
-- material da capacitação como anexo (dono "capacitacao").

ALTER TABLE capacitacoes
    ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS duracao_horas NUMERIC(4,1) NOT NULL DEFAULT 1;

-- presente: nulo = ainda não marcado; true/false = a gestão marcou.
ALTER TABLE capacitacao_inscricoes
    ADD COLUMN IF NOT EXISTS presente BOOLEAN,
    ADD COLUMN IF NOT EXISTS inscrito_em TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_capacitacoes_data ON capacitacoes(data);

-- Perfil completo: links do calendário e do GitHub (tecnologias usam habilidades do tipo "tecnologia").
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS calendario_url TEXT,
    ADD COLUMN IF NOT EXISTS github_url TEXT;

ALTER TABLE anexos DROP CONSTRAINT IF EXISTS anexos_dono_valido;
ALTER TABLE anexos ADD CONSTRAINT anexos_dono_valido
    CHECK (dono_tipo IN ('documento', 'conhecimento', 'iniciativa', 'capacitacao'));
