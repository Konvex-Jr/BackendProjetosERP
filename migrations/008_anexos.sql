-- Sessão 12c: anexos (upload real de arquivos), decisão de 09/11/2026.
-- O arquivo fica no disco (pasta ANEXOS_DIR, volume da VPS que entra no backup);
-- o banco guarda só os dados do arquivo e a quem ele pertence.
-- Dono: um documento de pasta (documento do tipo arquivo), um item da Base ou uma iniciativa.
-- Sem chave estrangeira para o dono (são três tabelas): a aplicação apaga os anexos e os
-- arquivos quando o dono é excluído.

CREATE TABLE IF NOT EXISTS anexos (
    codigo UUID PRIMARY KEY,
    dono_tipo TEXT NOT NULL,
    dono_codigo UUID NOT NULL,
    nome VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(120) NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    arquivo VARCHAR(80) NOT NULL UNIQUE,
    enviado_por UUID REFERENCES usuarios(codigo) ON DELETE SET NULL,
    enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT anexos_dono_valido CHECK (dono_tipo IN ('documento', 'conhecimento', 'iniciativa')),
    CONSTRAINT anexos_tamanho_valido CHECK (tamanho_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_anexos_dono ON anexos(dono_tipo, dono_codigo);

-- Documento de pasta passa a ser link OU arquivo (os dois convivem).
ALTER TABLE documentos ALTER COLUMN arquivo_url DROP NOT NULL;
