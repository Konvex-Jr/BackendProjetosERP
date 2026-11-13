# Sistema interno da Konvex Jr. · Backend

API do ERP interno da Konvex Jr.: projetos, tarefas, pessoas, capacitações, documentos com anexos, base de inteligência e iniciativas, com permissões por papel. Em produção em https://erp.konvexjr.com.br.

Node.js 20 · Express · TypeScript · PostgreSQL (SQL com `pg`, sem ORM) · JWT. A interface fica no repositório [FrontendProjetosERP](https://github.com/Konvex-Jr/FrontendProjetosERP).

![Painel do sistema com dados fictícios](docs/capturas/painel.png)

## Sumário
1. [Subir na sua máquina](#1-subir-na-sua-máquina)
2. [Testes](#2-testes)
3. [Como o código está organizado](#3-como-o-código-está-organizado)
4. [Publicar (produção)](#4-publicar-produção)
5. [Referência rápida](#5-referência-rápida)
6. [Documentação e licença](#6-documentação-e-licença)

Quer mudar algo? Leia o [CONTRIBUTING.md](CONTRIBUTING.md).

## 1. Subir na sua máquina
Precisa de Git, Node.js 20+ e Docker (com o Compose).

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

- Logs da API: `docker compose -f docker-compose.dev.yml logs -f api`.
- Mudou o código do backend? Rode `npm run dev:docker` de novo (reconstrói a imagem).
- Zerar tudo (apaga o banco de dev): `docker compose -f docker-compose.dev.yml down -v`.

### Porta ocupada?
Se já houver um PostgreSQL na porta 5432 (ou outra coisa na 5001), o `dev:docker` falha com `port is already allocated` ou `address already in use`. Escolha outras portas:

```bash
KONVEX_DB_PORTA=5434 KONVEX_API_PORTA=5002 npm run dev:docker
API_URL=http://localhost:5002 npm run dados:ficticios
VITE_API_URL=http://localhost:5002 npx vite        # no frontend
```

Para não repetir, ponha `KONVEX_DB_PORTA` e `KONVEX_API_PORTA` no `.env` do backend: o Compose lê esse arquivo. Com outra porta do banco, o teste de integração usa `localhost:<KONVEX_DB_PORTA>`.

### Sem Docker
Com um PostgreSQL local: `cp .env.example .env`, ajuste `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`, e rode `npm run keys`, `npm run migrate`, `npm run seed:admin` e `npm start`.

## 2. Testes
| Comando | O que faz |
| --- | --- |
| `npm test` | Testes unitários e HTTP (sem banco) |
| `npm run build` | Compilação TypeScript |
| `npm run lint` / `npm run format:check` | ESLint e Prettier (o CI cobra os dois) |
| `DATABASE_URL_TESTE=postgresql://postgres:postgres@localhost:5432/konvex_teste npm run test:integracao` | Fluxos contra PostgreSQL real. Use um banco **descartável** (o teste apaga o schema). Com o compose de dev, esse banco já existe |
| `npm run e2e` (no frontend) | Abre todas as telas com diretora, gerente e membro, no computador e no celular |

O CI (`.github/workflows/ci.yml`) roda lint, build, testes, integração com PostgreSQL (também no fuso `America/Sao_Paulo`) e valida os dois arquivos do Compose. A `main` só recebe mudanças por PR com o CI verde.

## 3. Como o código está organizado
Camadas `domain` → `useCases` → `infra`, com casos de uso agrupados por módulo (ADR-010):

```
source/
  domain/          entidades, enums, interfaces de repositório e serviços de regra
  useCases/<módulo>/  um caso de uso por arquivo (SalvarTarefa, GerirCapacitacao...)
  infra/
    http/routes/   rotas Express, uma por módulo
    repository/    cada repositório em duas versões, em memória (testes) e PostgreSQL, e as duas factories
    database/      conexão e migrações
    arquivos/      anexos no disco (até 20 MB)
  modulos/registro.ts            telas do menu e quem vê cada uma
  shared/seguranca/              catálogo de permissões por papel
  shared/erros/                  ErroValidacao 400, ErroProibido 403, ErroConflito 409
migrations/        SQL numerado (001, 002...), aplicado na subida da API
test/              testes unitários, HTTP e de integração
```

Regras que valem para todo o código:
- **Permissões** ficam no catálogo (`source/shared/seguranca/catalogoPermissoes.ts`). A API devolve o que a pessoa pode fazer (`podeAlterar`, `podeGerir`...) e o frontend obedece.
- **Erros de entrada** dão 400 com uma mensagem que diz qual campo está errado (`mensagensDeErro.ts`), nunca 500.
- **Repositório novo** = interface + versão em memória + versão em banco + método nas duas factories.
- **Banco:** migração nova numerada em `migrations/`; nunca edite uma que já foi publicada.

## 4. Publicar (produção)
A produção roda numa VPS com Docker e Traefik. A publicação é manual, **depois do merge**, com backup do banco e dos anexos antes. Passo a passo completo em [`docs/PUBLICACAO.md`](docs/PUBLICACAO.md). Resumo:

```bash
cd /docker/erp-konvex
# 1. backup do banco e dos anexos (seção 3 do PUBLICACAO.md)
git -C backend pull --ff-only && git -C frontend pull --ff-only
docker compose build backend frontend && docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20   # migrações + "API disponível na porta 5001"
```

- Compose de produção versionado: `deploy/docker-compose.prod.yml` (modelo do `.env` em `deploy/.env.prod.example`).
- Voltar atrás, testar a restauração do backup e conferir anexos órfãos: seções 6, 8 e 9 do `PUBLICACAO.md`.

## 5. Referência rápida
- **Papéis:** diretor = `ADMIN`, gerente = `MANAGER`, membro = `MEMBER`. Gerente e diretor veem todos os projetos; membro vê só os seus.
- **Sessão:** `POST /auth/login` com `{ email, senha }` devolve `token` (15 min, cabeçalho `access-token`) e `refreshToken` (7 dias); `POST /auth/refresh` e `POST /auth/logout`. `GET /auth/permissoes` devolve o menu da pessoa.
- **Variáveis:** `DATABASE_URL` (ou `DB_*`), `CORS_ORIGINS`, `ANEXOS_DIR`, `JWT_ACCESS_TTL`, `REFRESH_TOKEN_DIAS`, chaves JWT (`private.key`/`public.key` ou `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`), `ADMIN_*`. Lista completa no `PUBLICACAO.md`.
- **Scripts:** `npm run keys` (gera as chaves), `npm run migrate`, `npm run seed:admin`, `npm run dados:ficticios`, `node dist/source/scripts/conferirAnexos.js` (anexos órfãos; só relata).

## 6. Documentação e licença
- [`docs/GUIA_DE_USO.md`](docs/GUIA_DE_USO.md): o sistema tela a tela, para quem usa.
- [`docs/sistema/`](docs/sistema/): requisitos, arquitetura, modelo de dados, revisão de arquitetura e ADRs. A ADR-009 explica que o código é a referência.
- [`docs/PUBLICACAO.md`](docs/PUBLICACAO.md): produção, backup e restauração.

Uso proprietário da Konvex Jr. Veja [LICENSE](LICENSE).
