# ADR-009: o código é a referência

**Status:** aceita (sessão 14b, 11/11/2026). **Substitui:** a especificação v0.1 (15/10/2026) como descrição do sistema.

## Contexto
A especificação original (docs 01 a 10, v0.1) descreve um sistema **planejado** em NestJS + Prisma + Tailwind, com Nginx, agendador e integrações. O sistema que existe foi construído sobre outra base (Express + SQL com `pg`, React em JavaScript + Bootstrap, Traefik) e evoluiu por sessões curtas, com decisões tomadas pela gestão no caminho (sigilo de pastas, fim do check-in, anexos reais, regras das capacitações). Manter a especificação como "verdade" fazia quem chega estudar um sistema que não existe.

## Decisão
1. **O código nos repositórios é a referência** do que o sistema faz. Os documentos `docs/sistema/02` a `04` descrevem o sistema **real** e são atualizados no mesmo PR que muda o comportamento descrito.
2. A especificação original vira **histórico e fonte de ideias**: requisitos ainda não feitos (precificação, Google Calendar, e-mail, auditoria, busca global, Board Tático) seguem valendo como intenção, mas só entram quando a gestão priorizar.
3. Das ADRs originais, continuam valendo: **001** (monólito modular), **004** (Calendar só livre/ocupado, quando existir), **005** (e-mail em resumo + alertas, quando existir), **006** (pessoas não são excluídas), **007** (áreas, cargos e senioridades configuráveis) e **008** (Board Tático como visão, quando existir). Mudaram: **002** (o frontend é JavaScript, não TypeScript; backend sem NestJS/Prisma) e **003** (documento é link **ou** arquivo desde a sessão 12c).

## Consequências
- Quem chega lê o README e `docs/sistema/`, não a especificação.
- PR que muda regra, tabela ou tela precisa atualizar o doc correspondente (o revisor confere).
- Divergências entre especificação e código não são bugs: são decisões, e as relevantes ficam registradas aqui ou no doc de acompanhamento da gestão.
