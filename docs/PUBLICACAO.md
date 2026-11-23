# Publicação manual na VPS

Processo usado hoje em `erp.konvexjr.com.br`. Siga na ordem. O deploy automatizado (CI/CD) fica para depois.

## Como a VPS está montada
- Debian, tudo em Docker. O **Traefik** (container `evolution-traefik`, rede `traefik-public`) cuida do HTTPS. Não há nginx no host.
- Pasta do ERP: `/docker/erp-konvex/`, com `docker-compose.yml`, `.env` e os clones `backend/` e `frontend/` (branch `main`).
- Containers:
  - `konvex-db`: PostgreSQL 17, banco `konvex_gestao`.
  - `konvex-backend`: porta 5001. O Traefik encaminha `erp.konvexjr.com.br/api` para ele, tirando o `/api` do caminho.
  - `konvex-frontend`: nginx com o build do Vite (`VITE_API_URL=/api`).
  - `konvex-generate-keys`: serviço `generate-keys` do compose. Roda `source/scripts/gerarChaves.js` (versionado) só se as chaves JWT ainda não existirem e termina.
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
# 4. construir antes de subir: o "up" sozinho reaproveita as imagens que já existem
#    (montadas com o código antigo). Assim um erro de build aparece aqui, com tudo ainda no ar
docker compose build backend frontend
# 5. subir (o banco pode reiniciar por alguns segundos; os dados ficam no volume)
docker compose up -d
docker logs konvex-backend 2>&1 | tail -5                 # "API disponível na porta 5001"
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes   # 401
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/                       # 200
```
- **Deu errado?** `cp docker-compose.yml.bak-antes-versionado docker-compose.yml && docker compose up -d`.
- **Deu certo?** Entre no sistema, abra um anexo e então apague o script antigo: `rm backend/generate-keys.js` (as chaves agora vêm do serviço `generate-keys`, que só gera se faltarem). Depois disso, `git -C backend status --short` e `git -C frontend status --short` têm que sair **vazios**.
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
git -C backend status --short && git -C frontend status --short   # têm que sair vazios
docker compose build backend frontend && docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
- [ ] Os dois `git status` saíram vazios. Se aparecer algum arquivo, pare e descubra de onde veio antes de seguir: alguém editou um arquivo na VPS (ou sobrou o `generate-keys.js`, que já devia ter sido apagado na adoção do compose). As chaves (`*.key`) estão no `.gitignore` e não aparecem.
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
> **Atenção (depois da migração 012, sessão 17):** voltar só o código **não basta e quebra o sistema**. O código antigo seleciona `tarefas.iniciativa_codigo` (coluna removida) e os módulos antigos usam tabelas que a migração apagou. O rollback exige **os dois**: o checkout do código **e** a restauração do `.dump` do banco e do `anexos_*.tar.gz` feitos no passo 1 da publicação, **do mesmo horário** (comandos logo abaixo).

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
for t in usuarios projetos tarefas capacitacoes biblioteca_itens anexos; do
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
Lista registros sem arquivo, arquivos sem registro e anexos cujo dono foi apagado. **Sem flag, só relata; com `--apagar-sem-registro` apaga os arquivos sem registro (exceto os modificados nos últimos 10 minutos).**
```bash
docker exec konvex-backend node dist/source/scripts/conferirAnexos.js
```
- "Registro sem arquivo": o anexo aparece na tela mas não baixa. Procure o arquivo no backup do mesmo dia (`anexos_*.tar.gz`) e copie para `/docker/erp-konvex/anexos/`.
- "Arquivo sem registro": sobra no disco (por exemplo, envio interrompido). Pode mover para fora da pasta depois de um backup.
- "Dono não existe mais": exclua o anexo pelo banco só depois de conferir com a gestão.

### Publicação da sessão 17 (Biblioteca): limpeza dos anexos antigos
A migração `012_biblioteca.sql` **apaga todos os dados** de Gestão (pastas e documentos), Base de Inteligência e Iniciativas, com as linhas de anexo deles (decisão do usuário em 14/11/2026). Os arquivos no disco não saem pela migração: o script tem a flag `--apagar-sem-registro` para removê-los. Anexos de capacitações não são tocados. Ordem, sem pular passo:
1. **Backup** do banco (`pg_dump`) e da pasta `anexos/`, como na seção 3. Sem o backup, não publique: o descarte é irreversível.
2. **Deploy** (seção 4). A migração 012 roda ao iniciar o backend.
3. **Apagar os arquivos sem registro** (só depois de confirmar que a publicação está funcionando: depois deste passo, o rollback não recupera os arquivos apagados sem o `anexos_*.tar.gz`):
```bash
docker exec konvex-backend node dist/source/scripts/conferirAnexos.js --apagar-sem-registro
```
   - O script mantém os arquivos alterados nos últimos 10 minutos (podem ser envios em andamento) e os lista como "recentes". Se aparecerem, rode de novo mais tarde.
4. **Conferir:** `docker exec konvex-backend node dist/source/scripts/conferirAnexos.js` (sem a flag) tem que terminar com código 0 (`echo $?`).

**Rollback:** depois da migração 012, voltar só o código quebra Tarefas e os módulos antigos. Restaure o checkout **e** o `.dump` + `anexos_*.tar.gz` do passo 1 (seção 6).

Sem a flag, o script continua só relatando, como antes. Em máquina de desenvolvimento, rode `npm run clean` antes de `npm run build`: o `dist/` guarda `.js` velhos dos módulos que saíram.

### Publicação da sessão 20 (projeto sigiloso e trainee com login): migração 014
A migração `014_sigilo_trainee.sql` passa todo trainee a **membro**, tira a liderança dos projetos que ele liderava e **libera o login** com a senha que já estava no cadastro (era sorteada pela tela antiga, ninguém a conhece). Ordem:
1. **Antes do deploy**, liste os trainees e os projetos que eles lideram, para avisar a gestão (cole a saída para o Claude):
```bash
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'
SELECT nome, email, perfil FROM usuarios WHERE status = 'trainee' ORDER BY nome;
SELECT p.nome AS projeto, p.status, u.nome AS lider_trainee
FROM projetos p JOIN usuarios u ON u.codigo = p.lider_codigo
WHERE u.status = 'trainee' ORDER BY p.nome;
SQL
```
2. **Backup** do banco e dos anexos (seção 3) e **deploy** (seção 4). A migração 014 roda ao iniciar o backend.
3. **Depois do deploy**, a gestão redefine a senha de cada trainee da lista (tela **Pessoas**, menu da pessoa, **Redefinir senha**) e escolhe um novo líder nos projetos da segunda consulta (ficha do projeto, aba **Equipe**).

**Rollback:** voltar o backend depois de existir o primeiro projeto sigiloso **vaza os detalhes dele**: o código antigo ignora o sigilo e mostra o projeto a todos os que o veriam como normal. O único caminho de volta é restaurar o `.dump` feito antes do deploy (seção 6), perdendo o que foi gravado depois, ou corrigir para frente. Voltar o backend exige voltar o frontend junto.

### Publicação da sessão 21 (quadro por etapa): migração 015
A migração `015_colunas_projeto.sql` cria as colunas por projeto, dá as quatro padrão a todo projeto existente (A fazer, Fazendo, Revisando, Concluído), coloca cada tarefa de projeto na coluna do seu status e acrescenta uma regra no banco (tarefa de projeto tem coluna; concluída tem data de conclusão). O status não muda. A migração também acerta linhas incoerentes: tarefa concluída sem data de conclusão recebe o prazo (`data_fim`) como data de conclusão; tarefa não concluída perde a data de conclusão e quem concluiu, se tinha. Publicar **backend e frontend juntos**; o quadro por semana sai do projeto.

**Parte 1, preparar (backup, antes de qualquer pull):**
```bash
cd /docker/erp-konvex
mkdir -p /root/backup-konvex
DATA=$(date +%F_%H%M)
ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
[ -d anexos ] && tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos && ls -lh /root/backup-konvex/anexos_$DATA.tar.gz
```
Confira que os dois arquivos não estão vazios e anote o horário (`$DATA`).

**Parte 2, atualizar e construir (ainda sem derrubar nada):**
```bash
cd /docker/erp-konvex
git -C backend pull --ff-only && git -C frontend pull --ff-only
git -C backend status --short && git -C frontend status --short   # têm que sair vazios
docker compose build backend frontend
```
Se o build falhar, o sistema segue no ar com a versão antiga.

**Parte 3, subir (a migração 015 roda ao iniciar o backend):**
```bash
docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 015_colunas_projeto.sql` e `API disponível na porta 5001`. Se aparecer `Banco já está atualizado.` sem a 015, o PR ainda não foi mergeado.

**Parte 4, conferir:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes   # 401
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'
SELECT count(*) AS projetos_sem_coluna FROM projetos p WHERE NOT EXISTS (SELECT 1 FROM colunas_projeto c WHERE c.projeto_codigo = p.codigo);
SELECT count(*) AS tarefas_de_projeto_sem_coluna FROM tarefas WHERE projeto_codigo IS NOT NULL AND coluna_codigo IS NULL;
SQL
```
As duas contagens têm que ser `0`. No navegador, abra um projeto: o quadro mostra as quatro colunas e as tarefas concluídas estão em Concluído.

**Rollback:** depois da migração 015, o backend anterior **não consegue criar tarefa de projeto** (a regra nova do banco exige coluna). Voltar só o código não basta. O caminho de volta é restaurar o `.dump` feito na Parte 1 (seção 6), perdendo o que foi gravado depois, e voltar **backend e frontend juntos**; ou corrigir para frente.

### Publicação da sessão 22 (foto de perfil e fim das tecnologias): migração 016
A migração `016_foto_sem_habilidades.sql` troca a coluna `usuarios.avatar_url` por `usuarios.foto` e **apaga as tabelas `habilidades` e `usuario_habilidades`** (as tecnologias saem do sistema; os dados só voltam do backup). As fotos ficam em `anexos/fotos/`, dentro da pasta `anexos`, que o backup já cobre. Publicar **backend e frontend juntos**.

**Parte 1, preparar (backup, antes de qualquer pull):**
```bash
cd /docker/erp-konvex
mkdir -p /root/backup-konvex
DATA=$(date +%F_%H%M)
ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
[ -d anexos ] && tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos && ls -lh /root/backup-konvex/anexos_$DATA.tar.gz
```
Confira que os dois arquivos não estão vazios e anote o horário (`$DATA`).

**Parte 2, atualizar e construir (ainda sem derrubar nada):**
```bash
cd /docker/erp-konvex
git -C backend pull --ff-only && git -C frontend pull --ff-only
git -C backend status --short && git -C frontend status --short   # têm que sair vazios
docker compose build backend frontend
```
Se o build falhar, o sistema segue no ar com a versão antiga.

**Parte 3, subir (a migração 016 roda ao iniciar o backend):**
```bash
docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 016_foto_sem_habilidades.sql` e `API disponível na porta 5001`. Se aparecer `Banco já está atualizado.` sem a 016, o PR ainda não foi mergeado.

**Parte 4, conferir:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes   # 401
curl -sI https://erp.konvexjr.com.br/api/fotos/00000000-0000-4000-8000-000000000000.webp | head -1   # 404
docker exec konvex-backend node dist/source/scripts/conferirAnexos.js; echo "código $?"   # 0 (ignora a pasta fotos/)
```
No navegador, entre, clique no seu avatar no topo (abre o perfil), envie uma foto e confira que ela aparece no topo. Se der, repita num iPhone (lá a foto sai em JPEG e o servidor converte para WebP). Depois copie o endereço da imagem (botão direito, copiar endereço da imagem) e teste de fora, sem login:
```bash
curl -sI "https://erp.konvexjr.com.br/api/fotos/<ARQUIVO>.webp" | head -1   # 200
```

**Rollback:** voltar só o backend depois da 016 quebra o perfil (a coluna `avatar_url` e as tabelas de tecnologias não existem mais). O caminho de volta é restaurar o `.dump` feito na Parte 1 (seção 6), perdendo o que foi gravado depois, e voltar **backend e frontend juntos**. As fotos enviadas ficam em `anexos/fotos/` e não atrapalham.

### Publicação da sessão 23a (áreas por período): migração 017
A migração `017_periodos_area.sql` cria a tabela `periodos_area`, carrega nela a área e o cargo atuais de cada pessoa e o histórico antigo, marca como "lidera a área" os cargos que começam com "Gerente" ou "Diretor" e **apaga `usuarios.area_codigo`, `usuarios.cargo_codigo`, `historico_areas` e `historico_cargos`**. Publicar **backend e frontend juntos**.

**Parte 0, consultar antes (anote a saída):**
```bash
cd /docker/erp-konvex
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'
SELECT u.nome, c.nome AS cargo FROM usuarios u JOIN cargos c ON c.codigo = u.cargo_codigo WHERE u.area_codigo IS NULL;
SELECT nome FROM cargos WHERE unaccent(lower(nome)) ~ '^(gerente|diretor)';
SQL
```
Atenção: a carga dá a cada pessoa a área atual desde a data de entrada na EJ; passagens anteriores por outras áreas registradas em `historico_areas` não viram períodos, e essas tabelas são apagadas. O `.dump` da Parte 1 é a única cópia desse histórico: guarde-o até a gestão lançar os períodos antigos.

A primeira lista mostra quem tem cargo e não tem área: o cargo dessas pessoas não vira período (período exige área); a gestão lança depois. A segunda mostra os cargos que vão ficar marcados como "Lidera a área".

**Parte 1, backup:** igual à Parte 1 da sessão 22 (`pg_dump` e `anexos`).

**Parte 2, atualizar e construir:** igual à Parte 2 da sessão 22.

**Parte 3, subir:**
```bash
docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 017_periodos_area.sql` e `API disponível na porta 5001`.

**Parte 4, conferir:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes            # 401
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/usuarios/x/periodos       # 401
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT count(*) FROM periodos_area WHERE fim IS NULL;"'
```
O total de períodos em aberto deve ser próximo do número de pessoas Ativas e Trainees com área antes da publicação. Depois, no navegador: **Configurações › Cargos** (conferir "Lidera a área") e o perfil de algumas pessoas (seção "Áreas e cargos"); a gestão lança os períodos antigos com as datas reais.

**Rollback:** a 017 apaga colunas e tabelas antigas. Voltar = restaurar o `.dump` da Parte 1 (seção 6) e voltar **backend e frontend juntos**.

### Publicação da sessão 23b (projetos internos e geral por área): migração 018
A migração `018_projetos_internos.sql` acrescenta `projetos.tipo` e `projetos.geral_da_area`, cria um projeto geral ("<Área> · geral") para cada área, **move as tarefas avulsas para o geral da área da categoria** (cria as áreas Inovação, Execução e Capacitação só se houver avulsa da categoria e a área não existir) e **apaga `tarefas.categoria`**. Publicar **backend e frontend juntos**.

**Parte 0, consultar antes (anote a saída):**
```bash
cd /docker/erp-konvex
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'
SELECT categoria, count(*) FROM tarefas WHERE categoria IS NOT NULL GROUP BY categoria ORDER BY categoria;
SELECT nome, ativa FROM areas ORDER BY nome;
SELECT t.categoria, a.nome AS area, a.ativa, count(*) FROM tarefas t
  LEFT JOIN areas a ON lower(unaccent(a.nome)) = t.categoria
  WHERE t.categoria IS NOT NULL GROUP BY t.categoria, a.nome, a.ativa ORDER BY t.categoria;
SQL
```
A primeira lista mostra quantas avulsas existem por categoria. A segunda mostra as áreas atuais: cada uma ganha um projeto geral; as inativas ficam com o geral arquivado. A terceira cruza cada categoria com a área de mesmo nome e mostra se ela está ativa (`ativa` falso = o geral dessa área nasce arquivado). **Efeitos a avisar à equipe:** as avulsas migradas passam a ser lidas por quem está ou esteve na área (antes só a gestão e o responsável), e a avulsa de uma categoria cuja área está inativa cai num geral arquivado: dá para ler, não para criar tarefa nova ali; para reabrir, reative a área. Uma categoria com avulsa e sem área de mesmo nome (sem acento, sem maiúsculas) faz a migração criar a área, sob "Projetos" (ou sob a primeira área raiz, se "Projetos" não existir).

**Parte 1, backup:** igual à Parte 1 da sessão 22 (`pg_dump` e `anexos`).

**Parte 2, atualizar e construir:** igual à Parte 2 da sessão 22.

**Parte 3, subir:**
```bash
docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 018_projetos_internos.sql` e `API disponível na porta 5001`.

**Parte 4, conferir:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes   # 401
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT nome, status FROM projetos WHERE geral_da_area ORDER BY nome;"'
```
Tem que haver um geral por área, com o status `arquivado` só nas áreas inativas.

**Rollback:** a 018 apaga `tarefas.categoria` e a regra que permitia tarefa sem projeto. Voltar = restaurar o `.dump` da Parte 1 (seção 6) e voltar **backend e frontend juntos**.

### Publicação da sessão 24a (dificuldade da tarefa e ocupação semanal): migração 019
A migração `019_dificuldade_ocupacao.sql` acrescenta `tarefas.dificuldade`, cria a tabela `horas_dificuldade` (Rápida 1, Fácil 2, Média 4, Difícil 8), acrescenta `cargos.teto_semanal_horas` (padrão 10; 20 para cargos que começam com diretor, presidente ou vice) e **apaga `projeto_membros.alocacao`**: o percentual de alocação digitado à mão deixa de existir e a ocupação passa a ser calculada das tarefas. Publicar **backend e frontend juntos**.

**Parte 0, consultar antes (anote a saída):** a ocupação usa o cargo do período vigente; se alguém tem dois cargos ao mesmo tempo (áreas diferentes), vale o maior teto. A consulta lista esses casos para a gestão conferir.
```bash
cd /docker/erp-konvex
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'
SELECT u.nome, a1.nome AS area1, c1.nome AS cargo1, a2.nome AS area2, c2.nome AS cargo2
FROM periodos_area p1
JOIN periodos_area p2 ON p1.usuario_codigo = p2.usuario_codigo AND p1.codigo < p2.codigo
JOIN usuarios u ON u.codigo = p1.usuario_codigo
JOIN areas a1 ON a1.codigo = p1.area_codigo
JOIN areas a2 ON a2.codigo = p2.area_codigo
JOIN cargos c1 ON c1.codigo = p1.cargo_codigo
JOIN cargos c2 ON c2.codigo = p2.cargo_codigo
WHERE p1.inicio < COALESCE(p2.fim, 'infinity') AND p2.inicio < COALESCE(p1.fim, 'infinity');
SQL
```
Sem linhas = nada a ajustar. Com linhas, a gestão decide se encerra um dos períodos (a regra nova não deixa criar dois cargos ao mesmo tempo, mas não mexe nos que já existem).

**Parte 1, backup:** igual à Parte 1 da sessão 22 (`pg_dump` e `anexos`). A 019 apaga a coluna `alocacao`; só o `.dump` traz os valores de volta.

**Parte 2, atualizar e construir:** igual à Parte 2 da sessão 22.

**Parte 3, subir:**
```bash
docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 019_dificuldade_ocupacao.sql` e `API disponível na porta 5001`.

**Parte 4, conferir:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes   # 401
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/ocupacao           # 401
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT nome, teto_semanal_horas FROM cargos ORDER BY nome;"'
```
Depois, no navegador: **Configurações** (conferir as horas por dificuldade e o **teto semanal** de cada cargo, e ajustar o que não bater com a realidade da Konvex) e o perfil de uma pessoa (cartão "Ocupação da semana"). Tarefas que já existem **não têm dificuldade** e não entram na conta: a gestão e os líderes vão preenchendo conforme editam as tarefas.

**Rollback:** a 019 apaga `projeto_membros.alocacao`. Voltar = restaurar o `.dump` da Parte 1 (seção 6) e voltar **backend e frontend juntos**.

### Publicação da sessão 24b (ajustes de tarefas e projeto geral opcional): migração 020
A migração `020_tarefas_e_geral.sql` acrescenta `tarefa_checklist_itens.responsavel_codigo` e `areas.tem_geral` (padrão verdadeiro) e renomeia os projetos gerais de "<Área> · geral" para "<Área> geral". Publicar **backend e frontend juntos**.

**Parte 1, backup:** igual à Parte 1 da sessão 22 (`pg_dump` e `anexos`):
```bash
cd /docker/erp-konvex
DATA=$(date +%F_%H%M); ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos
```

**Parte 2, atualizar e construir:**
```bash
git -C backend pull --ff-only && git -C frontend pull --ff-only
docker compose build backend frontend
```

**Parte 3, subir:**
```bash
docker compose up -d backend frontend
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 020_tarefas_e_geral.sql` e `API disponível na porta 5001`.

**Parte 4, conferir de fora:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes          # 401
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH https://erp.konvexjr.com.br/api/tarefas/x/conclusao   # 401
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT nome FROM projetos WHERE geral_da_area ORDER BY nome;"'
```
Os nomes dos gerais têm que estar sem a bolinha ("Inovação geral").

**Parte 5, na tela (gestão):** em **Configurações → Áreas**, desligar **Projeto geral** na Presidência Executiva. Se o geral dela tiver tarefas, o sistema responde com o número delas: mova ou exclua as tarefas e tente de novo.

**Rollback:** a 020 só acrescenta colunas e renomeia projetos, mas desligar o geral exclui um projeto. Voltar = restaurar o `.dump` da Parte 1 (seção 6) e voltar **backend e frontend juntos**.

### Publicação da sessão 25a (conta: convite por e-mail, esqueci a senha e manter conectado): migração 021
A migração `021_conta_senha.sql` cria a tabela de links de senha e acrescenta `refresh_tokens.lembrar`. A partir daqui **ninguém vê nem define a senha de outra pessoa**: a gestão cadastra só o e-mail e a pessoa cria a senha por um link enviado por e-mail (convite, validade de 72 h). "Esqueci a senha" gera um link de 1 h. "Manter conectado" guarda um cookie `HttpOnly` por 15 dias. Publicar **backend e frontend juntos**.

**Parte 0, antes de tudo (administrador do Google Workspace, no navegador):**
1. Criar o alias `nao-responda@` no domínio da Konvex (Admin → Diretório → Usuários → um usuário → Adicionar alias).
2. Liberar o relay SMTP: Admin → Apps → Google Workspace → Gmail → Roteamento → **Serviço de redirecionamento SMTP** → Adicionar. Escolher "Apenas endereços do meu domínio" e autenticar por **endereço IP**, com o IP da VPS (veja em `curl -4 ifconfig.me` na própria VPS). Exigir TLS. Salvar (pode levar alguns minutos para valer).
3. No `.env` da VPS (cópia `.bak` antes), acrescentar as variáveis. O relay por IP não usa usuário nem senha:
```bash
cd /docker/erp-konvex
cp .env .env.bak
cat >> .env <<'EOF'
SMTP_HOST=smtp-relay.gmail.com
SMTP_PORTA=587
EMAIL_REMETENTE=Konvex Jr <nao-responda@konvexjr.com.br>
EOF
```
`SMTP_USUARIO` e `SMTP_SENHA` ficam vazios. `EMAIL_DOMINIO` e `APP_URL` já têm valor padrão no compose (`konvexjr.com.br` e o domínio do ERP). Sem `SMTP_HOST`, em produção o envio conta como falho e o log escreve só destinatário e assunto.

**Parte 1, compose novo:** este PR mudou `deploy/docker-compose.prod.yml` (cookie, domínio, SMTP). Depois do pull, copiar de novo:
```bash
git -C backend pull --ff-only && git -C frontend pull --ff-only
diff docker-compose.yml backend/deploy/docker-compose.prod.yml
cp docker-compose.yml docker-compose.yml.bak && cp backend/deploy/docker-compose.prod.yml docker-compose.yml
docker compose config > /dev/null && echo compose ok
```

**Parte 2, backup:** igual à Parte 1 da sessão 22 (`pg_dump` e `anexos`):
```bash
DATA=$(date +%F_%H%M); ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos
```

**Parte 3, construir e subir:**
```bash
docker compose build backend frontend
docker compose up -d
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 021_conta_senha.sql` e `API disponível na porta 5001`.

**Parte 4, conferir de fora:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/auth/permissoes                    # 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://erp.konvexjr.com.br/api/auth/retomar              # 401
curl -s -X POST -H 'Content-Type: application/json' -d '{"email":"ninguem@konvexjr.com.br"}' https://erp.konvexjr.com.br/api/auth/esqueci-senha
```
A última tem que responder "Se o e-mail estiver cadastrado, você vai receber um link em instantes." (200, exista ou não o e-mail).

**Parte 5, teste de convite real:** em **Pessoas → Nova pessoa**, cadastrar um e-mail da Konvex que você controla. Conferir que o e-mail chega (olhar também a caixa de spam), abrir o link, criar a senha e entrar. Depois usar o mesmo link de novo: tem que dar erro. Testar **Esqueci a senha** na tela de login e **Manter conectado** (fechar e abrir o navegador). Se o e-mail não chegar: `docker logs konvex-backend 2>&1 | grep -i "e-mail\|smtp"` e conferir a liberação do relay (Parte 0).

**Quem já tem conta:** nada muda; as senhas atuais continuam entrando no login. A regra nova (8 caracteres, uma maiúscula, um número e um caractere especial) vale ao criar ou trocar a senha. O script `redefinir-senha.sh` continua servindo para emergência.

**Rollback:** a 021 só acrescenta tabela e coluna. Voltar = restaurar o `.dump` da Parte 2 (seção 6) e voltar **backend e frontend juntos**.

### Publicação da sessão 25b (pessoas: curso, e-mail pessoal, motivo da saída e fim do trainee): migração 022
A migração `022_pessoas.sql` acrescenta `usuarios.email_pessoal`, `motivo_saida` e `fim_trainee`, normaliza os cursos troca o semestre pelo ingresso e converte **Alumni em Inativo** (com `motivo_saida = 'Alumni'`). Daqui em diante só existem os status Ativo, Trainee e Inativo, e só três cursos: Ciência da Computação, Engenharia Mecânica e Engenharia Elétrica. Publicar **backend e frontend juntos**.

**Parte 1, consulta antes (na VPS):**
```bash
cd /docker/erp-konvex
docker exec konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT curso, count(*) FROM usuarios GROUP BY 1 ORDER BY 2 DESC"'
docker exec konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "SELECT status, count(*) FROM usuarios GROUP BY 1"'
```
Mapeamento da migração 022 (sem acento e sem diferença de maiúsculas):
- Começa com "ciencia" e contém "comput", ou é "BCC" ou "CC": vira Ciência da Computação.
- Começa com "eng" e contém "mec": vira Engenharia Mecânica.
- Começa com "eng" e contém "eletr": vira Engenharia Elétrica.
- Todo o resto vira vazio.

Atenção: "Mecatrônica" e "Eletrônica" cairiam em Mecânica e Elétrica pelo padrão. Se aparecerem na consulta, **parar e avisar o Claude antes do deploy**. O mesmo vale para qualquer curso real que não case com o mapeamento. Anotar os números para comparar depois.

Guardar a lista de cursos atuais, para a gestão recompletar os vazios depois:
```bash
DATA=$(date +%F_%H%M)
docker exec konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c "COPY (SELECT codigo, nome, curso FROM usuarios ORDER BY nome) TO STDOUT WITH CSV HEADER"' > /root/backup-konvex/cursos_$DATA.csv && ls -lh /root/backup-konvex/cursos_$DATA.csv
```

**Parte 2, backup:**
```bash
DATA=$(date +%F_%H%M); ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos
```

**Parte 3, construir e subir:**
```bash
git -C backend pull --ff-only && git -C frontend pull --ff-only
docker compose build backend frontend
docker compose up -d
docker logs konvex-backend 2>&1 | tail -20
```

**Parte 4, conferir a migração:**
```bash
docker logs konvex-backend 2>&1 | grep 022_pessoas
```
Tem que aparecer `Migração aplicada: 022_pessoas.sql`. Depois repetir as duas consultas da Parte 1: o total de pessoas não muda, não sobra status `alumni` e todo curso preenchido é um dos três.

**Parte 5, gestão preenche os dados:** em **Pessoas**, preencher os cursos que ficaram vazios e o **fim do trainee** de quem já foi trainee (a data só é gravada sozinha daqui em diante). Conferir que quem era Alumni aparece como Inativo com o motivo "Alumni".

**Perfil obrigatório (avisar o time):** a 022 também **apaga o semestre** (`usuarios.semestre`; o ingresso na faculdade `AAAA/1` ou `AAAA/2` o substitui e começa vazio). Depois da publicação, **todos completam o perfil ao entrar** (curso, telefone, e-mail pessoal, ingresso e link do calendário), **inclusive a diretoria**: a tela bloqueia até preencher. Avisar o time antes, para ninguém estranhar.

**Rollback:** a 022 acrescenta colunas, converte dados e apaga o semestre. Voltar = restaurar o `.dump` da Parte 2 (seção 6) e voltar **backend e frontend juntos**.

### Publicação da sessão 26a (central de avisos e ocupação no Dashboard): migração 023
A migração `023_avisos.sql` cria a tabela `avisos` (tarefa recebida e capacitação nova). Não mexe em dados que já existem. O sininho aparece para todos; o cartão "Ocupação da semana" só para a gestão. Sem e-mail. Publicar **backend e frontend juntos**.

**Parte 1, backup:**
```bash
cd /docker/erp-konvex
DATA=$(date +%F_%H%M); ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos
```

**Parte 2, construir e subir:**
```bash
git -C backend pull --ff-only && git -C frontend pull --ff-only
docker compose build backend frontend
docker compose up -d
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 023_avisos.sql` e `API disponível na porta 5001`.

**Parte 3, conferir de fora:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://erp.konvexjr.com.br/api/avisos                    # 401
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H 'Content-Type: application/json' -d '{}' https://erp.konvexjr.com.br/api/avisos/lidos   # 401
```

**Parte 4, teste pela tela:** um gerente dá uma tarefa a um membro; o membro entra e vê o número no sininho; clicar no aviso abre a tarefa e zera o número. Diretor vê "Ocupação da semana" no Dashboard; membro não.

**Voltar:** a 023 só acrescenta uma tabela. Voltar backend e frontend para o commit anterior basta (a tabela fica sem uso). Restaurar o `pg_dump` só se algo der errado no banco.

### Publicação da sessão 27a (visibilidade de projetos): migração 024
A migração `024_visibilidade_projetos.sql` apaga a tabela `projeto_acesso` (lista de acesso). Daqui em diante todos veem o cartão de todos os projetos; a ficha completa é da equipe e da gestão (sigiloso: diretor e equipe atual). Publicar **backend e frontend juntos**.

**Parte 1, consulta prévia (antes do deploy; guarde a saída):** lista quem hoje vê projeto sigiloso só pela lista de acesso ou por ter criado, e depois do deploy deixa de ver.
```bash
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'
SELECT p.nome AS projeto, u.nome AS pessoa, 'lista de acesso' AS origem
FROM projeto_acesso a JOIN projetos p ON p.codigo = a.projeto_codigo JOIN usuarios u ON u.codigo = a.usuario_codigo
WHERE p.sigiloso AND u.perfil <> 'diretor'
  AND NOT EXISTS (SELECT 1 FROM projeto_membros m WHERE m.projeto_codigo = p.codigo AND m.usuario_codigo = u.codigo AND m.data_saida IS NULL)
UNION
SELECT p.nome, u.nome, 'criou'
FROM projetos p JOIN usuarios u ON u.codigo = p.criado_por_codigo
WHERE p.sigiloso AND u.perfil <> 'diretor'
  AND NOT EXISTS (SELECT 1 FROM projeto_membros m WHERE m.projeto_codigo = p.codigo AND m.usuario_codigo = u.codigo AND m.data_saida IS NULL)
ORDER BY 1, 2;
SQL
```

**Parte 2, backup:**
```bash
cd /docker/erp-konvex
DATA=$(date +%F_%H%M); ARQ=/root/backup-konvex/konvex_$DATA.dump
docker exec konvex-db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$ARQ" && ls -lh "$ARQ"
tar -czf /root/backup-konvex/anexos_$DATA.tar.gz anexos
```

**Parte 3, construir e subir:**
```bash
git -C backend pull --ff-only && git -C frontend pull --ff-only
docker compose build backend frontend
docker compose up -d
docker logs konvex-backend 2>&1 | tail -20
```
No log tem que aparecer `Migração aplicada: 024_visibilidade_projetos.sql` e `API disponível na porta 5001`.

**Parte 4, conferir de fora:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -H 'Content-Type: application/json' -d '{}' https://erp.konvexjr.com.br/api/projetos/1/acesso   # 404 (a rota saiu)
```

**Parte 5, depois:** a gestão coloca na equipe quem ainda precisar ver algum sigiloso (a saída da Parte 1 diz quem). Teste pela tela: um membro fora de um sigiloso vê o cartão com o selo, sem clique.

**Voltar:** a 024 apaga a tabela, então voltar só o código não restaura a lista de acesso. Restaurar o `pg_dump` e voltar backend e frontend juntos.

### Publicação da sessão 27b (só o líder e equipe no cartão): migração 025
A migração `025_so_lider.sql` apaga a coluna `projetos.responsavel_codigo`. Projeto sem líder recebe o antigo responsável como líder se ele estiver na equipe atual e ativo (não trainee). Publicar **backend e frontend juntos**.

**Parte 1, consulta prévia (antes do deploy; guarde a saída):** projetos que vão ficar sem líder (a gestão escolhe pela aba Equipe depois).
```bash
docker exec -i konvex-db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' <<'SQL'
SELECT p.nome AS projeto, u.nome AS responsavel_antigo
FROM projetos p LEFT JOIN usuarios u ON u.codigo = p.responsavel_codigo
WHERE p.lider_codigo IS NULL AND NOT p.geral_da_area
  AND NOT (p.responsavel_codigo IS NOT NULL AND u.status = 'ativo' AND EXISTS (
      SELECT 1 FROM projeto_membros m WHERE m.projeto_codigo = p.codigo AND m.usuario_codigo = p.responsavel_codigo AND m.data_saida IS NULL))
ORDER BY 1;
SQL
```

**Parte 2, backup** e **Parte 3, construir e subir:** iguais às da 27a. No log tem que aparecer `Migração aplicada: 025_so_lider.sql`.

**Parte 4, conferir pela tela:** "Novo projeto" tem o campo Líder (sem Responsável); um membro vê a equipe nos cartões dos projetos de que não participa.

**Voltar:** a 025 apaga a coluna. Restaurar o `pg_dump` e voltar backend e frontend juntos.

### Publicação da sessão 28b (agenda, reuniões e chamada): migração 026
A migração `026_reunioes.sql` só **cria** as tabelas `reunioes` e `reuniao_participantes` (não apaga nada). Publicar **backend e frontend juntos**.

**Parte 1, backup:** igual ao bloco "Publicação" do início (banco e anexos).

**Parte 2, construir e subir:** `git -C backend pull --ff-only && git -C frontend pull --ff-only`, `docker compose build backend frontend && docker compose up -d`. No log tem que aparecer `Migração aplicada: 026_reunioes.sql`.

**Parte 3, conferir de fora:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://erp.konvexjr.com.br/api/agenda?de=2026-11-01&ate=2026-11-30"   # 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{}' https://erp.konvexjr.com.br/api/reunioes   # 401
```

**Parte 4, pela tela:** "Agenda" no menu; criar uma reunião de teste com uma pessoa, abrir "Criar no Google Agenda" (não precisa salvar no Google) e excluir a reunião.

**Voltar:** as tabelas novas não atrapalham o backend antigo; voltar backend e frontend juntos basta (as reuniões criadas ficam no banco sem uso).

## Scripts que existem só na VPS
- `/docker/erp-konvex/redefinir-senha.sh <email>`: define uma senha nova para a pessoa (por exemplo, trainee que virou membro).
- `/docker/erp-konvex/criar-usuarios-teste.sh`: cria ou atualiza `teste.diretor@` e `teste.membro@konvexjr.com.br`.

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
- Conta (sessão 25a): `COOKIE_CAMINHO` (cookie "Manter conectado"; padrão `/auth`, produção `/api/auth`), `EMAIL_DOMINIO` (e-mails de pessoas têm de terminar nele; vazio = não confere), `APP_URL` (base dos links dos e-mails) e `SMTP_HOST`, `SMTP_PORTA`, `SMTP_USUARIO`, `SMTP_SENHA`, `EMAIL_REMETENTE` (sem `SMTP_HOST` o envio falha em produção).
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
- `backend/generate-keys.js`: o script que vivia só na VPS, fora do git. Desde a adoção do compose versionado (sessão 14b), as chaves JWT vêm do serviço `generate-keys`, que roda o `source/scripts/gerarChaves.js` do repositório. Se o arquivo ainda estiver na VPS, apague (`rm backend/generate-keys.js`).
- Check-ins (`/checkins`): retirados na sessão 9. A tabela `checkins` foi apagada pela migração `010_remover_checkins.sql` (sessão 14a); os registros antigos ficam só nos backups anteriores.
