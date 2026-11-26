-- Migração 030 (sessão 31a): permissões por cargo; saem o perfil fixo e o projeto sigiloso.
-- Cada cargo ganha posição (1 = presidente; menor = mais alto) e a própria lista de permissões.
-- Carga: o cargo recebe as permissões do perfil MAIS BAIXO entre quem o ocupa hoje (período aberto);
-- sem ocupante = membro. As listas abaixo são cópia de PADRAO_* em source/shared/seguranca/catalogoPermissoes.ts
-- (o teste test/integracao/migracao030.int.ts confere que batem).

ALTER TABLE cargos ADD COLUMN posicao SMALLINT NOT NULL DEFAULT 4;
ALTER TABLE cargos ADD CONSTRAINT cargos_posicao_valida CHECK (posicao >= 1);
CREATE UNIQUE INDEX cargos_um_presidente ON cargos ((posicao)) WHERE posicao = 1;

CREATE TABLE cargo_permissoes (
    cargo_codigo UUID NOT NULL REFERENCES cargos(codigo) ON DELETE CASCADE,
    permissao TEXT NOT NULL,
    PRIMARY KEY (cargo_codigo, permissao)
);

CREATE TABLE conjunto_permissoes (
    conjunto TEXT NOT NULL CHECK (conjunto IN ('sem_cargo', 'trainee')),
    permissao TEXT NOT NULL,
    PRIMARY KEY (conjunto, permissao)
);

CREATE TEMPORARY TABLE padrao_030 (perfil TEXT NOT NULL, permissao TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO padrao_030
SELECT 'diretor', unnest(ARRAY['pessoas.ver', 'pessoas.gerir', 'projetos.ver', 'projetos.abrirDaArea', 'projetos.abrirTodos',
    'projetos.editar', 'projetos.excluir', 'projetos.liderar', 'clientes.ver', 'tarefas.ver', 'tarefas.gerirTodas', 'agenda.ver',
    'agenda.gerirTodas', 'reunioes.criar', 'capacitacoes.ver', 'capacitacoes.gerir', 'capacitacoes.presenca', 'biblioteca.usar',
    'biblioteca.verTodos', 'biblioteca.gerir', 'estrategia.ver', 'precificacao.simular', 'gestao.visoes', 'areas.liderarTodas',
    'configuracoes.ver', 'config.estrutura', 'config.dificuldade', 'config.precificacao', 'permissoes.gerir'])
UNION ALL
SELECT 'gerente', unnest(ARRAY['pessoas.ver', 'pessoas.gerir', 'projetos.ver', 'projetos.abrirDaArea', 'projetos.editar',
    'projetos.liderar', 'tarefas.ver', 'tarefas.gerirTodas', 'agenda.ver', 'agenda.gerirTodas', 'reunioes.criar', 'capacitacoes.ver',
    'capacitacoes.gerir', 'capacitacoes.presenca', 'biblioteca.usar', 'biblioteca.verTodos', 'biblioteca.gerir', 'estrategia.ver',
    'precificacao.simular', 'gestao.visoes'])
UNION ALL
SELECT 'membro', unnest(ARRAY['projetos.ver', 'projetos.liderar', 'tarefas.ver', 'agenda.ver', 'reunioes.criar', 'capacitacoes.ver',
    'biblioteca.usar'])
UNION ALL
SELECT 'trainee', unnest(ARRAY['projetos.ver', 'tarefas.ver', 'agenda.ver', 'reunioes.criar', 'capacitacoes.ver']);

-- Perfil de cada cargo: o mais baixo entre os ocupantes de hoje (membro < gerente < diretor); sem ocupante = membro.
CREATE TEMPORARY TABLE perfil_cargo_030 ON COMMIT DROP AS
SELECT c.codigo AS cargo_codigo,
       COALESCE(
           (SELECT CASE min(CASE u.perfil::text WHEN 'membro' THEN 1 WHEN 'gerente' THEN 2 ELSE 3 END)
                       WHEN 1 THEN 'membro' WHEN 2 THEN 'gerente' WHEN 3 THEN 'diretor' END
              FROM periodos_area p
              JOIN usuarios u ON u.codigo = p.usuario_codigo
             WHERE p.cargo_codigo = c.codigo AND p.fim IS NULL AND u.ativo AND u.status::text IN ('ativo', 'trainee')),
           'membro') AS perfil
  FROM cargos c;

UPDATE cargos c
   SET posicao = CASE pc.perfil WHEN 'diretor' THEN 2 WHEN 'gerente' THEN 3 ELSE 4 END
  FROM perfil_cargo_030 pc
 WHERE pc.cargo_codigo = c.codigo;

-- Presidente: o cargo ativo cujo nome começa por "Presid". Com diretores e cargos no banco, ele precisa existir e ter ocupante.
DO $$
DECLARE
    tem_diretor BOOLEAN;
    candidatos INT;
    presidente UUID;
    ocupado BOOLEAN;
BEGIN
    -- Só cobra o presidente de quem já usa cargos (produção desde a 23a). Banco sem cargo nenhum (instalação nova,
    -- testes antigos) segue sem presidente; o seedAdmin cria o cargo depois.
    SELECT EXISTS (SELECT 1 FROM usuarios WHERE perfil::text = 'diretor' AND ativo)
       AND EXISTS (SELECT 1 FROM cargos WHERE ativo) INTO tem_diretor;
    SELECT count(*) INTO candidatos FROM cargos WHERE ativo AND nome ILIKE 'Presid%';
    IF candidatos = 1 THEN
        SELECT codigo INTO presidente FROM cargos WHERE ativo AND nome ILIKE 'Presid%';
        SELECT EXISTS (
            SELECT 1 FROM periodos_area p JOIN usuarios u ON u.codigo = p.usuario_codigo
             WHERE p.cargo_codigo = presidente AND p.fim IS NULL AND u.ativo AND u.status::text IN ('ativo', 'trainee')
        ) INTO ocupado;
    END IF;
    IF tem_diretor AND (candidatos <> 1 OR NOT ocupado) THEN
        RAISE EXCEPTION 'Migração 030: precisa de exatamente um cargo ativo de presidente (nome começando por "Presid"), com alguém num período aberto nele. Encontrados: % cargo(s); ocupado: %. Acerte em Configurações e em Pessoas antes de publicar.',
            candidatos, COALESCE(ocupado, false);
    END IF;
    IF candidatos = 1 THEN
        UPDATE cargos SET posicao = 1 WHERE codigo = presidente;
        UPDATE perfil_cargo_030 SET perfil = 'diretor' WHERE cargo_codigo = presidente;
    END IF;
END $$;

INSERT INTO cargo_permissoes (cargo_codigo, permissao)
SELECT pc.cargo_codigo, pd.permissao
  FROM perfil_cargo_030 pc
  JOIN padrao_030 pd ON pd.perfil = pc.perfil;

INSERT INTO conjunto_permissoes (conjunto, permissao)
SELECT 'sem_cargo', permissao FROM padrao_030 WHERE perfil = 'membro'
UNION ALL
SELECT 'trainee', permissao FROM padrao_030 WHERE perfil = 'trainee';

ALTER TABLE usuarios DROP COLUMN perfil;
DROP TYPE perfil_usuario;
-- O CHECK projetos_geral_fixo da 018 usava `sigiloso` e cai junto com a coluna: recriado sem ela (geral é sempre interno).
ALTER TABLE projetos DROP COLUMN sigiloso;
ALTER TABLE projetos DROP CONSTRAINT IF EXISTS projetos_geral_fixo;
ALTER TABLE projetos ADD CONSTRAINT projetos_geral_fixo CHECK (NOT geral_da_area OR tipo = 'interno');
