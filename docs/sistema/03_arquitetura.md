# Arquitetura do sistema real (novembro de 2026)

> Descreve o que está em produção em https://erp.konvexjr.com.br. Ver ADR-009: o código é a referência. Revisão de arquitetura e dívida técnica: [05_revisao_arquitetura.md](05_revisao_arquitetura.md).

## Visão geral
Monólito modular com API REST, um banco PostgreSQL e um frontend React servido à parte. Sem fila, sem agendador, sem integrações externas por enquanto.

```
Navegador ──HTTPS──> Traefik (evolution-traefik, rede traefik-public)
                      ├─ erp.konvexjr.com.br/      → konvex-frontend (nginx com o build do Vite)
                      └─ erp.konvexjr.com.br/api/  → konvex-backend :5001 (tira o /api)
                                                      ├─ konvex-db (PostgreSQL 17, só na rede interna e 127.0.0.1)
                                                      └─ /app/anexos (pasta da VPS /docker/erp-konvex/anexos)
```

## Stack
| Camada | Tecnologia |
|---|---|
| Backend | Node 24, Express, TypeScript, SQL direto com `pg` (sem ORM), Jest |
| Frontend | React 18 em JavaScript, Vite, Bootstrap, `HashRouter`, testes com `node --test` |
| Banco | PostgreSQL 17; migrações SQL numeradas em `migrations/`, aplicadas por `scripts/migrar.js` antes de a API subir (CMD do Dockerfile) |
| Autenticação | JWT (RS256, chaves `private.key`/`public.key`) de 15 min + refresh token de 7 dias guardado com hash |
| Arquivos | Disco da VPS (`ANEXOS_DIR`), até 20 MB por arquivo |
| Infra | Docker Compose na VPS, Traefik para HTTPS, backup manual com `pg_dump` + `tar` |
| CI | GitHub Actions em todo PR (testes, integração com PostgreSQL, build, validação dos compose) |

## Backend em camadas
- `source/domain`: entidades (`Entity/`), enums e interfaces dos repositórios. Validação de valores na entidade.
- `source/useCases`: um caso de uso por operação nos módulos antigos (`CriarTarefa`, `ExcluirPasta`…) e um caso de uso por módulo nos novos (`SalvarConhecimento`, `SalvarIniciativa`, `GerirAnexos`, `GerirCapacitacoes`).
- `source/infra`: repositórios em memória (testes) e em banco, rotas HTTP, armazenamento de anexos, migrações.
- `source/shared/seguranca`: permissões por papel (`catalogoPermissoes.ts`, `permissoes.ts`) e regras de acesso por item (`visibilidadeProjetos`, `sigiloPastas`, `regrasTarefa`, `regrasConhecimento`, `regrasIniciativa`, `regrasCapacitacao`).
- `source/modulos/registro.ts`: registro único dos módulos e do menu; `GET /auth/permissoes` devolve o menu de cada pessoa.
- Erros: `ErroValidacao` (400), `ErroProibido` (403), `ErroConflito` (409); mensagens em `source/shared/erros/mensagensDeErro.ts` dizem qual campo está errado.

## Módulos
| Módulo | Faz | Rotas |
|---|---|---|
| auth | Login, refresh, logout, perfil próprio, troca de senha, menu e permissões | `/auth/*` |
| pessoas | Pessoas, status, áreas/cargos (com histórico), tecnologias | `/usuarios`, `/habilidades` |
| config | Áreas (hierárquicas), cargos, senioridades | `/areas`, `/cargos`, `/senioridades` |
| projetos | Projetos, equipe com alocação, líder | `/projetos` |
| tarefas | Tarefas de projeto e avulsas, kanban, comentários | `/tarefas` |
| documentos | Pastas com sigilo e documentos (link ou arquivo) | `/pastas`, `/documentos` |
| conhecimento | Base de Inteligência | `/conhecimento` |
| iniciativas | Iniciativas de inovação | `/iniciativas` |
| anexos | Upload, download e exclusão de arquivos dos outros módulos | `/anexos`, `/<dono>/:codigo/anexos` |
| capacitacoes | Capacitações, inscrição, presença, avaliações | `/capacitacoes` |
| painel, precificação | Dashboard e Visão Estratégica (calculados no front); precificação ainda local no navegador | — |

Swagger em `/api-docs` (desligado em produção).

## Frontend
- `src/services/<modulo>.js` fala com a API; telas em `src/pages`, com `useCarregar` e recarga depois de salvar.
- Cálculos puros em `src/lib` (com teste). Listas pelo componente `Table` (vira cartões no celular).
- Regras de celular só em `src/styles/responsive.css`. A tela obedece aos booleanos de permissão que a API devolve (`podeAlterar`, `podeGerir`…).

## Ambientes
| Ambiente | Como sobe |
|---|---|
| Produção | `deploy/docker-compose.prod.yml` na VPS; ver `docs/PUBLICACAO.md` |
| Desenvolvimento | `npm run dev:docker` (PostgreSQL + API) + `npm run dados:ficticios`; frontend com `npx vite` |
| CI | `.github/workflows/ci.yml` nos dois repositórios |
| Homologação | não existe (fase 5) |
