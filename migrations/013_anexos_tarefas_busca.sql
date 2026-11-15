-- Biblioteca e anexos (sessão 19, 15/11/2026): anexos passam a aceitar tarefas e a busca ignora acentos.
-- Faça o backup do banco antes. Nenhum dado é apagado nem alterado.
-- Reversão (manual): exige que não exista anexo de tarefa. Se descartá-los for aceitável, rode
--   DELETE FROM anexos WHERE dono_tipo = 'tarefa'; e depois, para apagar os arquivos do disco,
--   node dist/source/scripts/conferirAnexos.js --apagar-sem-registro
--   Então ALTER TABLE anexos DROP CONSTRAINT anexos_dono_valido;
--   e ALTER TABLE anexos ADD CONSTRAINT anexos_dono_valido CHECK (dono_tipo IN ('biblioteca', 'capacitacao'));
--   A extensão unaccent pode ficar (DROP EXTENSION unaccent só se nada mais a usar).

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE anexos DROP CONSTRAINT IF EXISTS anexos_dono_valido;
ALTER TABLE anexos ADD CONSTRAINT anexos_dono_valido CHECK (dono_tipo IN ('biblioteca', 'capacitacao', 'tarefa'));
