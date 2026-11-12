# O que o sistema faz hoje (requisitos do sistema real)

> Resumo por módulo das regras em produção. Os requisitos originais (RF/RN da especificação v0.1) ficam como histórico (ADR-009). Guia para as pessoas: `docs/GUIA_DE_USO.md`.

## Papéis
Diretor (ADMIN), gerente (MANAGER) e membro (MEMBER). "Gestão" = diretores e gerentes. Não há cadastro público: a gestão cria as contas. Trainee existe como pessoa, sem login.

## Regras por módulo
| Módulo | Regras |
|---|---|
| Pessoas | Gestão cria, edita e muda status; ninguém é excluído. Troca de área/cargo gera histórico. Perfil (GitHub, calendário, tecnologias) visível a todos os logados |
| Projetos | Gestão cria e edita; um líder por projeto; membro vê só os projetos de que participa ou participou |
| Tarefas | De projeto ou avulsas (Inovação, Capacitação, Execução). Participantes do projeto criam (ficam responsáveis), concluem/reabrem as suas e comentam; gestão organiza tudo |
| Documentos | Pastas com sigilo Todos / Só gestão / Equipe de um projeto; só a gestão organiza; documento é link ou arquivo |
| Base de Inteligência | Todos leem e cadastram; autor ou gestão alteram |
| Iniciativas | Todos veem; criam a gestão e a área Inovação; alteram responsável, criador e gestão |
| Anexos | Até 20 MB; PDF, Office, OpenDocument, CSV, TXT, MD, imagens e ZIP; cada anexo segue as regras do dono |
| Capacitações | Gestão cria, edita, exclui e marca presença. Inscrição e cancelamento até o início (gestão a qualquer hora), respeitando vagas. Só quem compareceu avalia; avaliações com nome só para a gestão, instrutor vê sem nome, demais só a média. Horas cumpridas no perfil |
| Dashboard | Sete indicadores só para a gestão (projetos ativos, membros ativos sem trainees, capacitações em 30 dias, tarefas da semana…) |
| Precificação | Simulação no navegador; pela API só quando a diretoria definir as taxas (QA-01) |

## Não funcionais em vigor
- HTTPS (Traefik); banco fechado para a internet; senhas com bcrypt; JWT de 15 min + refresh de 7 dias.
- Funciona no celular (≥ 375 px) e no computador; levantamento automático por papel (`npm run e2e` no frontend).
- Testes em todo PR (CI). Backup manual antes de cada publicação, com teste de restauração (`docs/PUBLICACAO.md`, seção 8).

## Ainda não existe (ver roteiro)
Homologação, auditoria, LGPD/retenção, precificação pela API, Google Calendar, e-mails, busca global, Board Tático, CRM.
