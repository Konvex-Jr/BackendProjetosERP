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
- **Anexos (desde a sessão 12c):** os arquivos enviados ficam em `/docker/erp-konvex/anexos`, montada no container como `/app/anexos` (variável `ANEXOS_DIR`). O banco guarda só os dados de cada arquivo. **Banco e pasta andam juntos no backup.**

## Compose versionado (desde a sessão 14a)
O compose da VPS agora tem uma versão guardada no git: `deploy/docker-compose.prod.yml` (modelo do `.env` em `deploy/.env.prod.example`). Ele já traz o volume dos anexos, os `ADMIN_*` repassados ao backend e a geração das chaves JWT sem o `generate-keys.js` que vivia só na VPS.

**Adotar na VPS (uma vez, sessão 14b).** O arquivo versionado já usa os nomes reais da VPS: volume `erp-konvex_konvex_postgres_data`, rede `internal`, certresolver `letsencrypt`, router `erp`/serviço `erp-frontend` do frontend e o banco lido de `DATABASE` (o `.env` atual serve sem mudanças). O volume do banco é **externo**: se o nome estiver errado, o `up` para com erro em vez de criar um banco vazio.
```bash
cd /docker/erp-konvex
# 1. backup do banco e dos anexos (seção 3)
# 2. conferir o volume do banco; se for outro nome, ele vai para o .env
VOL=$(docker inspect konvex-db --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}'); echo "volume: $VOL"
[ "$VOL" = erp-konvex_konvex_postgres_data ] || echo "DB_VOLUME=$VOL" >> .env
# 3. trocar, guardando o antigo
git -C backend pull --ff-only
cp docker-compose.yml docker-compose.yml.bak-antes-versionado
cp backend/deploy/docker-compose.prod.yml docker-compose.yml
docker compose config >/dev/null && echo "compose ok"
docker compose config | grep -E "POSTGRES_DB|certresolver|erp-konvex_konvex_postgres_data|name: erp-konvex_internal"
# 4. subir (o banco pode reiniciar por alguns segundos; os dados ficam no volume)
docker compose up -d
docker logs konvex-backend 2>&1 | tail -5                 # "API disponível na porta 5001"
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes   # 401
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/                       # 200
```
- **Deu errado?** `cp docker-compose.yml.bak-antes-versionado docker-compose.yml && docker compose up -d`.
- **Deu certo?** Entre no sistema, abra um anexo e então apague o script antigo: `rm backend/generate-keys.js` (as chaves agora vêm do serviço `generate-keys`, que só gera se faltarem).
- **Daqui em diante:** o `docker-compose.yml` da VPS é uma **cópia**. Quando um PR mudar `deploy/docker-compose.prod.yml`, depois do `git pull` rode `diff docker-compose.yml backend/deploy/docker-compose.prod.yml` e copie de novo (com `.bak`).

## 0. Volume dos anexos (uma vez, na publicação da 12c)
Faça uma cópia do compose e acrescente no serviço `backend` do `docker-compose.yml`:

```yaml
    environment:
      ANEXOS_DIR: /app/anexos
    volumes:
      - ./anexos:/app/anexos
```
(Se o serviço já tiver `environment:` ou `volumes:`, só acrescente as linhas dentro deles; as chaves JWT continuam montadas como antes.)

```bash
cd /docker/erp-konvex
cp docker-compose.yml docker-compose.yml.bak-$(date +%F)
mkdir -p anexos
# editar o docker-compose.yml como acima
docker compose config >/dev/null && echo "compose ok"
```
Depois de subir, confira: `docker exec konvex-backend sh -c 'echo $ANEXOS_DIR; ls -ld /app/anexos'` mostra `/app/anexos`. Sem o volume, os arquivos ficariam dentro do container e **sumiriam no próximo build**.

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

## 3. Backup do banco e dos anexos (obrigatório)
```bash
cd /docker/erp-konvex
mkdir -p /root/backup-konvex
DATA=$(date +%F_%H%M)
ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
[ -d anexos ] && tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos && ls -lh /root/backup-konvex/anexos_$DATA.tar.gz
```
- [ ] Conferir que os arquivos não estão vazios. Guardar uma cópia fora da VPS de vez em quando (o `.dump` e o `anexos_*.tar.gz` do mesmo horário).
- O banco diz quais anexos existem; a pasta guarda os arquivos. Restaurar um sem o outro deixa anexos que não baixam ("arquivo não encontrado no servidor").

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
# E os anexos do mesmo horário:
mv anexos anexos.antes-restauracao && tar -xzf /root/backup-konvex/anexos_<mesmo horário>.tar.gz
docker compose restart backend
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

## 8. Testar a restauração de um backup (a cada 3 meses, ou depois de mudar o backup)
Restaura o último `.dump` e o último `anexos_*.tar.gz` num banco descartável, **sem tocar na produção**, compara as contagens e roda a conferência de anexos sobre a cópia. Leva uns 2 minutos.
```bash
cd /docker/erp-konvex
DUMP=$(ls -t /root/backup-konvex/konvex_*.dump | head -1); echo "$DUMP"
TAR=$(ls -t /root/backup-konvex/anexos_*.tar.gz | head -1); echo "$TAR"
docker network create konvex-restauracao
docker run -d --name konvex-restauracao-db --network konvex-restauracao \
  -e POSTGRES_PASSWORD=restauracao -e POSTGRES_DB=konvex_restaurado postgres:17-alpine
until docker exec konvex-restauracao-db pg_isready -q -U postgres; do sleep 1; done; sleep 3
docker exec -i konvex-restauracao-db pg_restore --no-owner --no-privileges -U postgres -d konvex_restaurado < "$DUMP"; echo "pg_restore terminou com $?"
for t in usuarios projetos tarefas capacitacoes conhecimentos iniciativas documentos anexos; do
  a=$(docker exec konvex-db sh -c "psql -tAU \"\$POSTGRES_USER\" \"\$POSTGRES_DB\" -c 'SELECT count(*) FROM $t'")
  b=$(docker exec konvex-restauracao-db psql -tAU postgres konvex_restaurado -c "SELECT count(*) FROM $t")
  echo "$t: produção=$a restaurado=$b"
done
RESTO=$(mktemp -d); tar -xzf "$TAR" -C "$RESTO"
echo "arquivos: produção=$(ls anexos | wc -l) restaurado=$(ls "$RESTO/anexos" | wc -l)"
docker run --rm --network konvex-restauracao -v "$RESTO/anexos:/anexos:ro" -e ANEXOS_DIR=/anexos \
  -e DATABASE_URL=postgresql://postgres:restauracao@konvex-restauracao-db:5432/konvex_restaurado \
  erp-konvex-backend node dist/source/scripts/conferirAnexos.js
# limpar
docker rm -f konvex-restauracao-db; docker network rm konvex-restauracao; rm -rf "$RESTO"
```
- **Deu certo quando:** `pg_restore terminou com 0`, as contagens batem (ou diferem só pelo que foi criado depois do backup) e a conferência termina com "Tudo certo".
- Anote a data do teste no acompanhamento. Se algo falhar, o backup **não serve**: corrija o procedimento da seção 3 antes da próxima publicação.

## 9. Conferir anexos órfãos (de vez em quando)
Lista registros sem arquivo, arquivos sem registro e anexos cujo dono foi apagado. **Só relata, não apaga nada.**
```bash
docker exec konvex-backend node dist/source/scripts/conferirAnexos.js
```
- "Registro sem arquivo": o anexo aparece na tela mas não baixa. Procure o arquivo no backup do mesmo dia (`anexos_*.tar.gz`) e copie para `/docker/erp-konvex/anexos/`.
- "Arquivo sem registro": sobra no disco (por exemplo, envio interrompido). Pode mover para fora da pasta depois de um backup.
- "Dono não existe mais": exclua o anexo pelo banco só depois de conferir com a gestão.

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
- `ANEXOS_DIR=/app/anexos`: pasta dos arquivos anexados (montada como volume; ver seção 0). Sem ela, o backend usa `./anexos` dentro do container.
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
- Upload antigo (`/pastas/:codigo/documentos/upload` e `/uploads/:arquivo`, que gravava dentro do container e sem sigilo): saiu na sessão 9. Desde a 12c, os anexos usam `/anexos` e a pasta `anexos/` (volume).
- Check-ins (`/checkins`): retirados na sessão 9. A tabela `checkins` foi apagada pela migração `010_remover_checkins.sql` (sessão 14a); os registros antigos ficam só nos backups anteriores.
