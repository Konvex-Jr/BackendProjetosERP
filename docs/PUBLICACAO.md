# Publicação manual na VPS

Processo usado hoje em `erp.konvexjr.com.br`. Siga na ordem. O deploy automatizado (CI/CD) fica para depois.

## Como a VPS está montada
- Debian, tudo em Docker. O **Traefik** (container `evolution-traefik`, rede `traefik-public`) cuida do HTTPS. Não há nginx no host.
- Pasta do ERP: `/docker/erp-konvex/`, com `docker-compose.yml`, `.env` e os clones `backend/` e `frontend/` (branch `main`).
- Containers:
  - `konvex-db`: PostgreSQL 17, banco `konvex_gestao`.
  - `konvex-backend`: porta 5001. O Traefik encaminha `erp.konvexjr.com.br/api` para ele, tirando o `/api` do caminho.
  - `konvex-frontend`: nginx com o build do Vite (`VITE_API_URL=/api`).
  - `konvex-generate-keys`: roda `backend/generate-keys.js` (arquivo só da VPS, fora do git) e mantém as chaves JWT.
- As chaves `backend/private.key` e `backend/public.key` ficam montadas no container. Não apague: sem elas, todo mundo é deslogado.
- O backend aplica as migrações (`migrations/`) sozinho ao iniciar.

## 1. Antes de publicar
- [ ] PRs do backend e do frontend mergeados na `main`.
- [ ] `npm test` passando no backend e no frontend. Se houver migração nova, rodar também `npm run test:integracao` contra um banco descartável.
- [ ] Escolher um horário com pouca gente usando. A troca dos containers derruba a API por alguns segundos.

## 2. Conferir os remotes (uma vez)
O `git pull` precisa baixar da organização Konvex-Jr, não de um fork. Os repositórios são públicos, então não precisa de token.

```bash
cd /docker/erp-konvex
git -C backend remote -v
git -C frontend remote -v
# Se não aparecer Konvex-Jr:
git -C backend remote set-url origin https://github.com/Konvex-Jr/BackendProjetosERP.git
git -C frontend remote set-url origin https://github.com/Konvex-Jr/FrontendProjetosERP.git
git -C backend fetch origin && git -C backend status -sb    # esperado: main...origin/main [behind N]
git -C frontend fetch origin && git -C frontend status -sb
```

Se aparecer `diverged`, pare: a VPS tem commits que a `main` não tem. Veja com `git log origin/main..main` antes de seguir.

## 3. Backup do banco (obrigatório)
```bash
cd /docker/erp-konvex
mkdir -p /root/backup-konvex
ARQ=/root/backup-konvex/konvex_$(date +%F_%H%M).dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
```
- [ ] Conferir que o arquivo não está vazio. Guardar uma cópia fora da VPS de vez em quando.

## 4. Atualizar e subir
```bash
cd /docker/erp-konvex
git -C backend pull --ff-only && git -C frontend pull --ff-only
git -C backend status --short          # só deve aparecer "?? generate-keys.js"
docker compose build backend frontend && docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
- [ ] No log aparecem as migrações (`Migração aplicada: ...` ou `Banco já está atualizado.`) e `API disponível na porta 5001`.
- [ ] `curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes` devolve `401` (API no ar, pedindo login).
- [ ] Se `generate-keys` falhar com `network ... not found`, rode `docker rm -f konvex-generate-keys` e suba de novo.

### Quando só o frontend mudou
Sem migração, o backup é opcional e basta:
```bash
cd /docker/erp-konvex
git -C frontend pull --ff-only
docker compose build frontend && docker compose up -d frontend
```
Logo depois do `up`, o `curl` acima pode dar 404 por alguns segundos enquanto o backend inicia. Espere aparecer `API disponível na porta 5001` no log e repita.

## 5. Conferir no navegador
Recarregue sem cache (Ctrl+Shift+R) ou use uma janela anônima.
- [ ] Login como diretor: o menu aparece e recarregar a página mantém a sessão.
- [ ] Projetos: abrir um projeto; as abas Tarefas, Visão geral e Equipe carregam.
- [ ] Tarefas: criar uma, editar no modal, arrastar para Concluído e recarregar. A mudança continua lá.
- [ ] Login como membro (`teste.membro@`): vê só os próprios projetos, cria tarefa e fica como responsável.
- [ ] Console do navegador sem erro de CORS e sem 401 em loop.
- [ ] No celular (ou no modo celular do navegador, 375 px): barra de baixo com 4 ícones + "Mais", listas em cartões, modal de tarefa em tela cheia.

O que mudou em cada sessão está em `claude/acompanhamento.md` (projeto da gestão) e na descrição de cada PR.

## 6. Voltar atrás, se algo grave falhar
```bash
cd /docker/erp-konvex
git -C backend log --oneline -5          # achar o commit anterior
git -C backend checkout <commit>          # idem no frontend, se preciso
docker compose build backend frontend && docker compose up -d backend frontend
# Só se o banco ficou ruim (migração com problema):
docker exec -i konvex-db sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /root/backup-konvex/<arquivo>.dump
```
Depois, volte para a `main` com `git checkout main` quando a correção estiver pronta.

## 7. Limpeza de imagens antigas (de vez em quando)
Cada `docker compose build` deixa a imagem anterior no disco. Depois de conferir que a publicação está boa:
```bash
docker image ls | grep -E "erp-konvex|<none>"   # ver o que existe
docker image prune -f                            # apaga só imagens sem nome/tag (as antigas)
df -h /                                          # conferir o espaço
```
Não use `docker system prune -a` sem pensar: ele apaga também imagens guardadas de propósito, como `erp-konvex-backend:antes-fase1`.

## Scripts que existem só na VPS
- `/docker/erp-konvex/redefinir-senha.sh <email>`: define uma senha nova para a pessoa (por exemplo, trainee que virou membro).
- `/docker/erp-konvex/criar-usuarios-teste.sh`: cria ou atualiza `teste.diretor@` e `teste.membro@konvexjr.com.br`.
- `backend/generate-keys.js`: usado pelo container `konvex-generate-keys`; fora do git.

## Segurança: porta do banco
O banco não deve ficar aberto para a internet. No `docker-compose.yml`, o serviço do banco deve publicar só para a própria VPS:

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

Para acessar do seu computador (DBeaver, pgAdmin), use um túnel SSH: `ssh -L 5432:localhost:5432 root@<vps>` e conecte em `localhost:5432`.

## Variáveis do backend (referência)
- `DATABASE_URL` (ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DATABASE`).
- `CORS_ORIGINS=https://erp.konvexjr.com.br`: a URL exata do frontend, sem barra no fim.
- Chaves JWT persistentes: os arquivos montados (ver acima) ou `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`.
- `NODE_ENV=production` desliga o Swagger (`SWAGGER_ENABLED=true` liga).
- Opcionais: `JWT_ACCESS_TTL` (padrão 15m), `REFRESH_TOKEN_DIAS` (padrão 7), `PORT` (padrão 5001).
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` só servem para `npm run seed:admin` (criar o primeiro diretor num banco vazio). Estão no `.env` da VPS, mas o compose não os repassa ao container. Duas formas de rodar:
  - Na hora, sem mexer no compose:
    ```bash
    cd /docker/erp-konvex && set -a && . ./.env && set +a
    docker exec -e ADMIN_NAME="$ADMIN_NAME" -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" konvex-backend npm run seed:admin
    ```
  - Ou, se for usar sempre, acrescentar no serviço `backend` do `docker-compose.yml` (faça uma cópia antes):
    ```yaml
    environment:
      ADMIN_NAME: ${ADMIN_NAME}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    ```
  Com o banco atual (que já tem diretores), não é preciso rodar.

## O que não existe mais
- Upload de arquivos (`/pastas/:codigo/documentos/upload` e `/uploads/:arquivo`): desde a sessão 9 documentos são links. O backend não cria mais a pasta `uploads/`.
- Check-ins (`/checkins`): retirados na sessão 9. A tabela `checkins` continua no banco até a limpeza da fase 4.
