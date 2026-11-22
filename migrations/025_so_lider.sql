-- Sessão 27b: o projeto fica só com o líder. O "responsável" (migração 002) não dava poder nenhum;
-- o líder é escolhido já na criação. Projeto sem líder recebe o antigo responsável, se ele estiver
-- na equipe atual e não for trainee; os demais ficam sem líder para a gestão escolher.
-- Pode rodar de novo sem quebrar.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projetos' AND column_name = 'responsavel_codigo'
    ) THEN
        UPDATE projetos p
        SET lider_codigo = p.responsavel_codigo
        WHERE p.lider_codigo IS NULL
          AND p.responsavel_codigo IS NOT NULL
          AND NOT p.geral_da_area
          AND EXISTS (
              SELECT 1 FROM projeto_membros pm
              WHERE pm.projeto_codigo = p.codigo
                AND pm.usuario_codigo = p.responsavel_codigo
                AND pm.data_saida IS NULL
          )
          AND EXISTS (
              SELECT 1 FROM usuarios u
              WHERE u.codigo = p.responsavel_codigo AND u.status = 'ativo'
          );
        ALTER TABLE projetos DROP COLUMN responsavel_codigo;
    END IF;
END $$;
