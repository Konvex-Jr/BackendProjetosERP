-- Sessão 31b: vários clientes por projeto (contatos só para quem tem clientes.ver), classe do projeto
-- e sigilo "Só diretoria" na Biblioteca (contratos).

CREATE TABLE IF NOT EXISTS classes_projeto (
    codigo TEXT PRIMARY KEY,
    nome VARCHAR(80) NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT classes_projeto_nome_preenchido CHECK (btrim(nome) <> '')
);
-- Nome único sem diferenciar maiúsculas (como na versão em memória).
CREATE UNIQUE INDEX IF NOT EXISTS classes_projeto_nome_unico ON classes_projeto (lower(btrim(nome)));

INSERT INTO classes_projeto (codigo, nome, ordem) VALUES
    ('landing-page', 'Landing page', 1),
    ('site-institucional', 'Site institucional', 2),
    ('e-commerce', 'E-commerce', 3),
    ('crm', 'CRM', 4),
    ('saas', 'SaaS', 5),
    ('aplicativo', 'Aplicativo', 6),
    ('outro', 'Outro', 7)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE projetos ADD COLUMN IF NOT EXISTS classe_codigo TEXT REFERENCES classes_projeto (codigo) ON DELETE RESTRICT;

-- Clientes: lista de { nome, empresa, telefone, email }. O nome do cliente antigo vira o primeiro da lista.
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS clientes JSONB NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projetos' AND column_name = 'cliente_nome') THEN
        UPDATE projetos
           SET clientes = jsonb_build_array(jsonb_build_object('nome', btrim(cliente_nome), 'empresa', NULL, 'telefone', NULL, 'email', NULL))
         WHERE coalesce(btrim(cliente_nome), '') <> '' AND clientes = '[]'::jsonb;
        ALTER TABLE projetos DROP COLUMN cliente_nome;
    END IF;
END $$;
ALTER TABLE projetos DROP CONSTRAINT IF EXISTS projetos_clientes_lista;
ALTER TABLE projetos ADD CONSTRAINT projetos_clientes_lista CHECK (jsonb_typeof(clientes) = 'array');

ALTER TABLE biblioteca_itens DROP CONSTRAINT IF EXISTS biblioteca_itens_sigilo;
ALTER TABLE biblioteca_itens ADD CONSTRAINT biblioteca_itens_sigilo CHECK (sigilo IN ('todos', 'gestao', 'projeto', 'diretoria'));
