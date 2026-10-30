# Publicação manual na VPS (fase 1)

Checklist para publicar backend e frontend à mão, como hoje. Siga na ordem e marque cada item.

## 1. Antes de tudo
- [ ] `main` do backend e do frontend atualizadas (backend PR #2 e frontend PR #2 mergeados).
- [ ] Testes locais passando: `npm test` no backend e no frontend; `npm run test:integracao` no backend apontando para um banco descartável.
- [ ] Combinar um horário com pouca gente usando. Todas as sessões antigas vão cair: o login agora usa token curto + refresh, e as pessoas precisam entrar de novo.

## 2. Backup do banco (obrigatório)
- [ ] `pg_dump -Fc -h <host> -U <usuario> <banco> > konvex_$(date +%F_%H%M).dump`
- [ ] Conferir que o arquivo não está vazio (`ls -lh`) e guardar uma cópia fora da VPS.
- [ ] Saber como voltar: `pg_restore --clean --if-exists -d <banco> <arquivo>.dump`.

## 3. Variáveis do backend
- [ ] `DATABASE_URL` (ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DATABASE`).
- [ ] `CORS_ORIGINS` com a URL **exata** do frontend em produção (com `https://`, sem barra no fim). Mais de uma, separe por vírgula. Sem isso o navegador bloqueia o login.
- [ ] Chaves JWT **persistentes**: `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` (PEM com `\n` escapado) ou os arquivos `private.key`/`public.key` num volume fora da imagem. Se o container gerar chaves novas a cada deploy, todo mundo é deslogado a cada publicação.
- [ ] Gerar as chaves uma vez com `npm run keys` (cria `private.key` e `public.key`) e não versionar.
- [ ] `NODE_ENV=production` (desliga o Swagger; use `SWAGGER_ENABLED=true` só se precisar).
- [ ] Opcionais: `JWT_ACCESS_TTL` (padrão 15m), `REFRESH_TOKEN_DIAS` (padrão 7), `PORT` (padrão 5001).

## 4. Publicar o backend
- [ ] Atualizar o código (`git pull` na `main`) e subir o container (`docker build` + `docker run`, ou o processo usado hoje).
- [ ] O container aplica as migrações ao iniciar (`migrar.js`). Fora de container: `npm ci && npm run migrate && npm start`.
- [ ] Conferir no log: `Migração aplicada: 001_base.sql` e `002_fase1_pessoas_projetos.sql` (ou `Banco já está atualizado.`). A 001 é idempotente e serve para o banco antigo.
- [ ] Se ainda não existir um diretor com senha, criar com `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e rodar `node dist/source/scripts/seedAdmin.js` (ou `npm run seed:admin`).

## 5. Publicar o frontend
- [ ] `VITE_API_URL` com a URL pública da API **antes** do build (o valor é embutido no build).
- [ ] `npm ci && npm run build` e publicar a pasta `dist/` no servidor web de hoje.
- [ ] As rotas usam `#` (ex.: `/#/usuarios`), então não precisa regra extra de rewrite no servidor.

## 6. Conferência depois de publicar
- [ ] Login como diretor funciona e o menu mostra Pessoas, Configurações e Meu perfil.
- [ ] Recarregar a página mantém a sessão; "Sair" desloga.
- [ ] Pessoas: listar, criar uma pessoa de teste (senioridade é obrigatória), editar.
- [ ] Projetos: abrir um projeto existente, abas Tarefas, Visão geral e Equipe carregam.
- [ ] Login como membro: não vê Configurações; vê só os projetos de que participa.
- [ ] Console do navegador sem erro de CORS ou 401 em loop.
- [ ] Se algo grave falhar: voltar a versão anterior do código e restaurar o backup do passo 2.
