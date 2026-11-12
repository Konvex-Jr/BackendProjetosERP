# BackendProjetosERP

API do sistema interno da Konvex Jr (Express + TypeScript + PostgreSQL), em produção em https://erp.konvexjr.com.br. O frontend fica em [FrontendProjetosERP](https://github.com/Konvex-Jr/FrontendProjetosERP).

**Comece por aqui:** este README sobe o sistema na sua máquina e mostra como uma mudança chega à produção. Como o sistema funciona: `docs/sistema/` (requisitos, arquitetura, modelo de dados e a ADR-009, "o código é a referência").

## 1. Subir na sua máquina (com Docker)
Precisa de Git, Node.js 20+ e Docker.
```bash
git clone https://github.com/Konvex-Jr/BackendProjetosERP.git
git clone https://github.com/Konvex-Jr/FrontendProjetosERP.git
cd BackendProjetosERP
npm ci
npm run dev:docker          # PostgreSQL + API em http://localhost:5001
npm run dados:ficticios     # pessoas, projeto, tarefas e capacitações de mentira
cd ../FrontendProjetosERP
npm ci
VITE_API_URL=http://localhost:5001 npx vite      # http://localhost:5173
```
Entre com a diretora `dev@konvexjr.com.br` / `konvex-dev`, ou com `ines@`, `bia@` ou `caio@dev.konvex` / `Konvex123` (gerente, membro líder, membro). Swagger: http://localhost:5001/api-docs.

- Ver os logs da API: `docker compose -f docker-compose.dev.yml logs -f api`.
- Depois de mudar o código do backend: `npm run dev:docker` de novo (reconstrói).
- Zerar tudo (apaga o banco de dev): `docker compose -f docker-compose.dev.yml down -v`.

### Sem Docker
Com um PostgreSQL local: `cp .env.example .env`, ajuste `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`, e rode `npm run keys`, `npm run migrate`, `npm run seed:admin` e `npm start`.

## 2. Testes
| Comando | O que faz |
|---|---|
| `npm test` | Testes unitários e HTTP (sem banco) |
| `npm run build` | Compilação TypeScript |
| `DATABASE_URL_TESTE=postgresql://postgres:postgres@localhost:5432/konvex_teste npm run test:integracao` | Fluxos contra PostgreSQL real. Use um banco **descartável** (o teste apaga o schema). Com o compose de dev, esse banco já existe |
| `npm run e2e` (no frontend) | Abre todas as telas com diretora, gerente e membro, no computador e no celular |

## 3. Fazer uma mudança
1. Crie uma branch a partir da `main`: `git checkout -b feat/<assunto>`.
2. Código e teste juntos. Regras de acesso ficam em `source/shared/seguranca`; mensagens de erro dizem qual campo está errado.
3. Mudou o banco? Crie a próxima migração numerada em `migrations/` (nunca edite uma já publicada) e atualize `docs/sistema/04_modelo_de_dados.md`.
4. Commits no padrão `tipo(escopo): descrição` em português (`feat(tarefas): permitir anexos`). Tipos: feat, fix, refactor, test, docs, db, build, ci, chore.
5. Abra um PR. O CI (`.github/workflows/ci.yml`) roda testes, integração e validação dos compose; **só entra na `main` com o CI verde**.

## 4. Publicar (produção)
A publicação é manual, na VPS, **depois do merge**. Passo a passo completo em `docs/PUBLICACAO.md`. Resumo:
```bash
cd /docker/erp-konvex
# 1. backup do banco e dos anexos (seção 3 do PUBLICACAO.md)
git -C backend pull --ff-only && git -C frontend pull --ff-only
docker compose build backend frontend && docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20   # migrações + "API disponível na porta 5001"
```
- Compose de produção versionado: `deploy/docker-compose.prod.yml` (modelo do `.env` em `deploy/.env.prod.example`).
- Voltar atrás, testar restauração de backup e conferir anexos órfãos: seções 6, 8 e 9 do `PUBLICACAO.md`.

## 5. Referência
- **Papéis:** diretor = ADMIN, gerente = MANAGER, membro = MEMBER. Catálogo em `source/shared/seguranca/catalogoPermissoes.ts`.
- **Tela nova:** item no `source/modulos/registro.ts` (menu) + rota e serviço no frontend + seção no `docs/GUIA_DE_USO.md`.
- **Sessão:** `POST /auth/login` devolve `token` (15 min, header `access-token`) e `refreshToken` (7 dias); `POST /auth/refresh` e `POST /auth/logout`.
- **Variáveis:** `DATABASE_URL` (ou `DB_*`), `CORS_ORIGINS`, `ANEXOS_DIR`, `JWT_ACCESS_TTL`, `REFRESH_TOKEN_DIAS`, chaves JWT (`private.key`/`public.key` ou `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`), `ADMIN_*`. Lista completa no `PUBLICACAO.md`.
- **Scripts úteis:** `npm run keys` (gera chaves), `npm run migrate`, `npm run seed:admin`, `node dist/source/scripts/conferirAnexos.js` (anexos órfãos, só relata).
