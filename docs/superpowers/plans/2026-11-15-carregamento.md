# Sessão 18: desempenho do carregamento (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recarregar em cerca de 0,3 s a menos de 0,5 s e navegar sem "Carregando…" em tela já vista, sem abrir brecha de segurança.

**Architecture:** Uma memória de dados por aba e por pessoa (`src/lib/memoria.js`, JS puro) alimenta o `useCarregar` (mostra o guardado e atualiza por trás). O cliente HTTP renova o token antes de chamar quando ele já venceu e junta GETs iguais em andamento. O início do app faz uma rodada só de chamadas; o layout aparece com esqueletos; arquivos e dados das telas do menu são buscados com antecedência. No backend, só a compressão das respostas fora de `/auth/*`.

**Tech Stack:** Frontend React 18 (JS) + Vite, testes `node --test` (sem DOM). Backend Express 4 + TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-11-15-carregamento-design.md` (backend). Repositórios: `~/FrontendProjetosERP` (branch `perf/carregamento`) e `~/BackendProjetosERP` (branch `perf/carregamento`).

## Global Constraints

- Dados guardados só em memória JS (nada em `localStorage`, `sessionStorage`, IndexedDB).
- Memória separada por pessoa (código da pessoa logada); apagada no logout, na sessão expirada e na troca de conta.
- Resposta 401, 403 ou 404 numa atualização remove o dado guardado daquela chave.
- Sem renovação de token por relógio em segundo plano; tempo de vida da sessão inalterado.
- Compressão fora de `/auth/*`.
- Sem dependência nova no frontend. No backend, só `compression@1.8.1` (exata).
- Antes de cada commit: `npm run lint && npm run format:check` sem pipe, nos dois repos. Commits em português, Conventional Commits, até 72 caracteres, escopos do CLAUDE.md (`ui`, `auth`, `infra`, `capacitacoes`...).
- Telas e esqueletos no visual Halo, claro e escuro, responsivos (regras responsivas só em `src/styles/responsive.css`).

## Review Focus

1. **Troca de conta na mesma aba sem F5** (sair e entrar como outra pessoa): a tela não pode mostrar nem por um instante dado da pessoa anterior. Teste na Tarefa 1 (`definirPessoa` com outro código apaga tudo) e na Tarefa 4 (`entrar` chama `definirPessoa` antes de qualquer tela montar).
2. **Resposta lenta que chega depois do logout:** uma busca iniciada antes do `sair()` não pode gravar na memória da sessão seguinte. Teste na Tarefa 1 (`buscar` descarta o resultado se a pessoa mudou durante a chamada).
3. **Salvar e voltar:** depois de salvar numa tela, outra tela que mostra o mesmo dado não pode ficar com a versão velha guardada sem atualizar. Coberto pela atualização sempre por trás (Tarefa 2); teste que `recarregar()` grava na memória.
4. **Token com `exp` ilegível ou ausente:** a renovação antecipada não pode travar; trata como não vencido e segue o fluxo 401 de hoje. Teste na Tarefa 3.
5. **Erro de rede (status 0) na atualização:** não apaga o dado guardado (só 401/403/404 apagam); mostra o alerta de hoje. Teste na Tarefa 1.

---

### Task 1: Memória de dados por pessoa (frontend)

**Files:**
- Create: `src/lib/memoria.js`
- Test: `test/memoria.test.js`

**Interfaces:**
- Produces (`src/lib/memoria.js`, export nomeado `memoria`):
  - `memoria.definirPessoa(codigo: string|null): void`: se o código mudar, apaga tudo.
  - `memoria.obter(chave: string): any|undefined`
  - `memoria.buscar(chave: string, carregar: () => Promise<any>): Promise<any>`: chamadas simultâneas da mesma chave compartilham a mesma promessa; grava o resultado se a pessoa não mudou durante a chamada; em erro com `status` 401, 403 ou 404 apaga a chave; repassa o erro.
  - `memoria.limpar(): void`: apaga tudo e as buscas em andamento.
  - `memoria.ouvir(chave, fn): () => void`: avisa quando a chave é gravada ou apagada (o hook usa para sumir com o dado apagado).

- [ ] **Step 1: Testes que falham** em `test/memoria.test.js`:
  - `guarda e devolve por chave` (`buscar` grava; `obter` devolve o mesmo valor).
  - `definirPessoa com outro código apaga tudo`; `definirPessoa com o mesmo código mantém`.
  - `limpar apaga tudo`.
  - `401, 403 e 404 apagam a chave` (um caso por status, erro `{ status }`; o erro é repassado).
  - `erro de rede (status 0) e 500 mantêm o dado guardado`.
  - `resposta que chega depois da troca de pessoa não é gravada` (`buscar` com promessa pendente; `definirPessoa('outra')`; resolve; `obter` é `undefined`).
  - `buscas simultâneas da mesma chave chamam carregar uma vez`.
  - `ouvir avisa ao gravar e ao apagar`.
  - `não usa localStorage nem sessionStorage` (substituir `globalThis.localStorage`/`sessionStorage` por objetos que falham em qualquer acesso, rodar `buscar`, `obter`, `limpar`, `definirPessoa`; nada lança).
- [ ] **Step 2:** `npm test` → falham (módulo não existe).
- [ ] **Step 3:** Implementar com um `Map` de dados, um `Map` de promessas em andamento, um `Map` de ouvintes e a pessoa atual; um contador de "geração" que muda em `definirPessoa`/`limpar` decide se o resultado ainda vale.
- [ ] **Step 4:** `npm test` → passam.
- [ ] **Step 5:** Commit `feat(ui): memória de dados por pessoa, só na aba`.

### Task 2: `useCarregar` com chave

**Files:**
- Modify: `src/lib/useCarregar.js`
- Test: `test/memoria.test.js` (o hook não roda sem DOM; a lógica fica na memória)

**Interfaces:**
- Consumes: `memoria` (Tarefa 1).
- Produces: `useCarregar(carregar, deps = [], { chave } = {})` → `{ dados, carregando, recarregar }`. Com `chave`: `dados` começa com `memoria.obter(chave)` (ou `null`), `carregando` é `true` só quando não há dado guardado; a busca passa por `memoria.buscar(chave, carregar)`; inscrito em `memoria.ouvir(chave)`, então, quando a chave é apagada, `dados` volta a `null`. Sem `chave`: comportamento atual inalterado. `recarregar()` sempre busca de novo e grava.

- [ ] **Step 1:** Teste `recarregar grava na memória: outra leitura da mesma chave vê o valor novo` (em `test/memoria.test.js`, chamando `memoria.buscar` duas vezes com resultados diferentes).
- [ ] **Step 2:** `npm test` → passa ou falha conforme a Tarefa 1; se passar, o teste documenta o contrato.
- [ ] **Step 3:** Implementar o terceiro parâmetro no hook. Quando a `chave` mudar (ex.: `biblioteca:item:<id>`), o estado inicial vem da chave nova. Manter o descarte de resposta antiga (`ultima`).
- [ ] **Step 4:** `npm test && npm run lint` → passam.
- [ ] **Step 5:** Commit `feat(ui): telas abrem na hora com o dado já visto`.

### Task 3: Cliente HTTP: renovação antecipada e GETs iguais juntos

**Files:**
- Modify: `src/services/api.js` (`fetchAutenticado`, `request`)
- Test: `test/api.test.js`

**Interfaces:**
- Produces: `export function tokenVencido(token: string, agora = Date.now()): boolean`: lê `exp` do payload JWT (base64url); vencido se `exp * 1000 <= agora + 5000`; token ilegível, sem `exp` ou vazio → `false`.
- `fetchAutenticado`: se `sessao.refreshToken` e `tokenVencido(sessao.token)`, chama `renovarSessao()` antes de enviar; se a renovação falhar, `expirar()` e devolve sem chamar. O fluxo 401 de hoje continua como reserva.
- `request` com `method === 'GET'` e `auth: true`: chamadas iguais em andamento (chave `path + '|' + sessao.token`) compartilham a mesma promessa; a entrada sai do mapa quando a promessa termina (sucesso ou erro).

- [ ] **Step 1: Testes que falham** em `test/api.test.js`:
  - `tokenVencido lê o exp do token` (token montado no teste com `exp` passado → `true`; futuro → `false`; `exp` a 3 s → `true`; `'abc'` → `false`; `''` → `false`).
  - `token vencido é renovado antes da chamada` (sessão com token vencido e refresh; `fetch` registra a ordem: `/auth/refresh` antes de `/projetos`; só duas chamadas).
  - `renovação antecipada que falha limpa a sessão e não chama a rota`.
  - `GETs iguais em andamento fazem uma só chamada` (duas `request('/projetos', { auth: true })` juntas → `fetch` 1 vez, mesmo resultado).
  - `depois da resposta, um GET igual chama de novo` (nada fica guardado).
  - `POST nunca é juntado`.
- [ ] **Step 2:** `npm test` → falham.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run lint` → passam. Conferir que nenhum consumidor de `request` altera o objeto devolvido (`grep -n "\.push(\|\.sort(\|\.splice(" src/context src/services src/pages` em resultados de GET; se algum ordenar no lugar, trocar por cópia).
- [ ] **Step 5:** Commit `perf(auth): renova o token vencido antes de chamar a API`; commit separado `perf(ui): junta chamadas GET iguais em andamento`.

### Task 4: Início do app numa rodada só, memória ligada à sessão

**Files:**
- Create: `src/services/inicio.js`
- Modify: `src/context/AppContext.jsx`
- Test: `test/inicio.test.js`

**Interfaces:**
- Produces: `export async function carregarInicio(): Promise<{ eu, dados, acesso }>`: dispara `/auth/me`, os dados globais (as 5 chamadas de hoje: `/usuarios`, `/projetos`, `/tarefas`, `capacitacoes.listar()`, `/senioridades`) e `/auth/permissoes` num único `Promise.all`; `dados` já adaptados (`u`, `p`, `t`, `k`, `senioridades`), `acesso = { permissoes, menu }`. `loadApiData` e `loadAcesso` saem do contexto para este módulo (`carregarDadosGlobais()`, `carregarAcesso()`), reaproveitados por `entrar` e `refresh`.
- `AppContext`:
  - `initialize` usa `carregarInicio()`; depois chama `memoria.definirPessoa(eu.codigo)` antes de `setMe`.
  - `entrar`: `memoria.definirPessoa(result.usuario.codigo)` logo depois do login, antes de buscar dados.
  - `limparEstado` (usado por `sair`, `onExpirada` e falha no login): `memoria.limpar()` e `memoria.definirPessoa(null)`.

- [ ] **Step 1: Testes que falham** em `test/inicio.test.js` (com `fetch` falso e sessão salva):
  - `as 7 chamadas saem antes de qualquer resposta` (o `fetch` falso só resolve depois de receber 7 chamadas; o teste termina, sem travar).
  - `devolve eu, dados adaptados e acesso`.
  - `401 em /auth/me rejeita com status 401` (o contexto usa para cair no login sem alerta).
- [ ] **Step 2:** `npm test` → falham.
- [ ] **Step 3:** Implementar o módulo e trocar o contexto.
- [ ] **Step 4:** `npm test && npm run lint` → passam. Manual: login, F5, sair, entrar com outro papel (`npm run dados:ficticios` cria os 3 papéis).
- [ ] **Step 5:** Commit `perf(auth): carrega sessão, dados e menu numa rodada só`.

### Task 5: Layout com esqueletos e telas com chave

**Files:**
- Create: `src/components/Esqueleto.jsx`
- Modify: `src/context/AppContext.jsx` (trocar o `Carregando…` da página inteira pelo esqueleto do layout), `src/components/Layout.jsx`, `src/styles/layout.css`, `src/styles/responsive.css`
- Modify (chave + esqueleto no lugar de "Carregando…"): `src/pages/Projetos.jsx`, `Tarefas.jsx`, `Projeto.jsx`, `Pessoas.jsx`, `Configuracoes.jsx`, `Perfil.jsx`, `Biblioteca.jsx`, `Capacitacoes.jsx`

**Interfaces:**
- Produces: `<Esqueleto linhas={n} />` (blocos com animação suave, `aria-busy="true"`, rótulo `Carregando` só para leitor de tela; sem animação com `prefers-reduced-motion`). `<EsqueletoApp />`: cabeçalho e menu lateral (barra inferior no celular) em esqueleto, mostrado pelo `AppProvider` enquanto `sessionReady` ou `DF` faltam e há sessão salva; sem sessão, nada muda (vai direto ao login).
- Chaves (uma por tela; incluir os valores do `deps` atual): `projetos:<mb>:<gestor>`, `tarefas:<pessoa>:<origem>:<status>`, `projeto:<id>`, `pessoas`, `configuracoes`, `perfil:<codigo|eu>`, `biblioteca:todos`, `biblioteca:item:<id>`, `biblioteca:projeto:<codigo>`, `capacitacoes:opcoes`, `capacitacao:<id>`, `capacitacao:<id>:avaliacoes`. Os filtros da Biblioteca (`filtrados`) ficam sem chave.
- **Capacitações:** a `Lista` usa `D.k` em vez de `useCarregar(capacitacoes.listar)`; `recarregar` vira `recarregarCapacitacoes` do contexto.

- [ ] **Step 1:** Criar `Esqueleto`/`EsqueletoApp` e o CSS (claro e escuro com os tokens do Halo; conferir 375 px).
- [ ] **Step 2:** Passar a chave e trocar `Carregando…` por `<Esqueleto />` em cada tela listada; as mensagens "não encontrado" continuam.
- [ ] **Step 3:** Capacitações com `D.k`.
- [ ] **Step 4:** `npm test && npm run lint && npm run build` → passam. Manual: visitar Tarefas, Projetos, voltar a Tarefas → aparece na hora e atualiza; claro/escuro; 375 px.
- [ ] **Step 5:** Commits `feat(ui): layout com esqueletos durante o carregamento` e `perf(ui): telas usam a memória e Capacitações reaproveita a lista`.

### Task 6: Buscar com antecedência (arquivos e dados)

**Files:**
- Modify: `src/lib/carregarPagina.js`, `src/App.jsx`, `src/components/Layout.jsx`
- Create: `src/lib/antecipar.js`
- Test: `test/antecipar.test.js`

**Interfaces:**
- `carregarPagina(importar)` devolve o componente com `.precarregar = importar` (mesma importação; o navegador não baixa duas vezes).
- `src/App.jsx` exporta `PAGINAS: Record<caminho, componente>` (`'/tarefas'`, `'/projetos'`, `'/capacitacoes'`, `'/biblioteca'`, `'/estrategia'`, `'/precificacao'`, `'/usuarios'`, `'/perfil'`, `'/configuracoes'`, `'/'`).
- `src/lib/antecipar.js`:
  - `precarregarPaginas(caminhos: string[], paginas, agendar = requestIdleCallback ?? setTimeout): void`: agenda o `.precarregar()` de cada caminho do menu; erros ignorados.
  - `anteciparDados(caminho: string, contexto): void`: para telas de lista sem parâmetro, chama `memoria.buscar(chave, carregar)` com a mesma chave e função da tela. As telas exportam `dadosDaTela(contexto) → { chave, carregar }` e passam ao hook; o contexto é `{ me, mb, pode }` do `useApp()`. Telas: Projetos, Tarefas (filtro padrão), Pessoas, Configurações, Biblioteca (`todos`), Capacitações (`opcoes`), Perfil (o próprio). Para não importar as páginas no pacote de entrada, `anteciparDados` usa o módulo já baixado pelo `.precarregar()` (aguarda a promessa da importação).
- `SideNav`: `precarregarPaginas` uma vez depois de montar; `onMouseEnter`, `onFocus` e `onTouchStart` de cada item chamam `anteciparDados` (uma vez por item a cada 10 s, para não repetir à toa).

- [ ] **Step 1: Testes que falham** em `test/antecipar.test.js`:
  - `precarregarPaginas agenda só os caminhos do menu`.
  - `erro ao baixar uma página não quebra as outras`.
  - `anteciparDados grava na memória com a chave da tela` (página falsa com `dadosDaTela`).
  - `anteciparDados ignora caminho sem dadosDaTela`.
- [ ] **Step 2:** `npm test` → falham.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run lint && npm run build` → passam. Conferir que o pacote de entrada não cresceu além do limite do CI (`npm run build` mostra os tamanhos; o CI tem o limite).
- [ ] **Step 5:** Commit `perf(ui): baixa telas e dados do menu com antecedência`.

### Task 7: Compressão das respostas da API (backend)

**Files:**
- Modify: `~/BackendProjetosERP/package.json` (+ lock), `source/infra/http/ExpressHttp.ts` (depois dos cabeçalhos de segurança, antes do `express.json`)
- Test: `test/http/compressao.test.ts`

**Interfaces:** `compression({ filter })` com `filter = (req, res) => !req.path.startsWith("/auth") && compression.filter(req, res)`; limiar padrão (1 KB).

- [ ] **Step 1: Testes que falham** em `test/http/compressao.test.ts` (com `subirServidor` e `cabecalhos: { "Accept-Encoding": "gzip" }`):
  - `lista grande sai comprimida` (criar tarefas suficientes para passar de 1 KB em `/tarefas`; `content-encoding` = `gzip`).
  - `/auth/login nunca sai comprimido` (`content-encoding` ausente).
  - `sem Accept-Encoding, sai sem compressão`.
- [ ] **Step 2:** `npm test -- compressao` → falham.
- [ ] **Step 3:** `npm i compression@1.8.1 && npm i -D @types/compression` (versão exata do `@types` registrada no lock); implementar.
- [ ] **Step 4:** `npm test` (147 + novos) e `npm run lint && npm run format:check` → passam. Download de anexo continua igual (`test/http/anexos.test.ts` passa).
- [ ] **Step 5:** Commit `perf(infra): comprime as respostas da API fora de /auth`.

### Task 8: Medição antes e depois e documentação

**Files:**
- Create: `~/FrontendProjetosERP/e2e/carregamento.mjs`; script `"carregamento"` no `package.json`
- Modify: `~/BackendProjetosERP/docs/superpowers/specs/2026-11-15-carregamento-design.md` (seção "Resultado")

**Interfaces:** `e2e/carregamento.mjs` (Playwright do scratchpad, como o `e2e`): login com o diretor fictício; latência simulada de 150 ms por ida e volta via CDP (`Network.emulateNetworkConditions`); mede (a) F5 até o primeiro item de conteúdo do Dashboard visível, (b) F5 com token vencido (sessão com token expirado e refresh válido), (c) Dashboard → Tarefas → Projetos → Tarefas: tempo até a lista visível na segunda visita e se "Carregando" apareceu. Imprime uma tabela; sai com código 1 se (c) mostrar "Carregando" na tela já vista.

- [ ] **Step 1:** Escrever o script e rodar na `main` (pasta à parte com `git worktree add` no scratchpad) para o "antes".
- [ ] **Step 2:** Rodar na branch para o "depois". Meta: (a) ≤ 0,5 s acima do tempo do HTML; (c) sem "Carregando".
- [ ] **Step 3:** `npm run e2e` (3 papéis, desktop e 375 px) sem problema; `npm run desempenho` com nota ≥ 90.
- [ ] **Step 4:** Registrar a tabela antes/depois na seção "Resultado" do spec.
- [ ] **Step 5:** Commits `test(ui): mede o carregamento com latência simulada` (front) e `docs(ui): resultado da sessão 18` (back).
