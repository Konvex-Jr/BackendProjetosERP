-- Fase 4, sessão 14a (09/11/2026): o check-in semanal saiu do sistema na sessão 9 (03/11).
-- A tabela ficou guardada até esta limpeza. Antes de publicar, faça o backup do banco:
-- os registros antigos ficam só no .dump.
DROP INDEX IF EXISTS idx_checkins_semana;
DROP TABLE IF EXISTS checkins;
