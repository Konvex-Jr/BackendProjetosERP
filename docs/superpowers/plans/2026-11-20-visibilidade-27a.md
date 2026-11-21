# Sessão 27a: visibilidade de projetos. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** todo logado vê o cartão de todos os projetos; detalhes e tarefas só para a equipe e a gestão (sigiloso: equipe atual e diretores); a lista de acesso acaba.

**Architecture:** `acessoAoProjeto` passa a `"completo" | "cartao"`; `GET /projetos` devolve todos, cada um completo ou `cartaoProjeto(p)`; migração 024 apaga `projeto_acesso`. Front troca `resumo` por `cartao` e tira a lista de acesso.

**Tech Stack:** backend Express + TypeScript + `pg` + Jest (`~/BackendProjetosERP`); frontend React 18 + Vite, testes `node:test` em `test/*.test.js` (`~/FrontendProjetosERP`). Branch `feat/visibilidade-27a` nos dois.

**Spec:** `docs/superpowers/specs/2026-11-20-visibilidade-27a-design.md` (ler inteira antes de cada tarefa).

## Global Constraints

- Cartão = lista fechada montada campo a campo: `codigo`, `nome`, `tipo`, `area` (`{ codigo, nome }` só se interno, senão `null`), `status`, `lider` (`{ codigo, nome }` ou `null`), `sigiloso`, `geralDaArea`, `cartao: true`. Nada mais (sem datas, tarefas, equipe, cliente, descrição, referência, colunas).
- Vê completo: normal = `projetos.verTodos` OU equipe atual ou antiga OU `lideresDaArea`; sigiloso = `projetos.verSigilosos` OU equipe **atual**. `criadoPor` não dá acesso.
- Erros: 400 nunca 500 por entrada inválida; mensagens em `mensagensDeErro.ts` dizendo o motivo.
- Commits em português, Conventional Commits, escopo `projetos` (docs: `docs`), até 72 caracteres, rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (nunca "Sonnet"). Antes de commitar: `npm run lint && npm run format:check` **sem pipe**.
- Backend: `npm test`; integração com `DATABASE_URL_TESTE=postgresql://postgres:postgres@localhost:5434/konvex_teste`, também com `TZ=America/Sao_Paulo`. Front: `npm test`, `npm run lint`.
- Telas no visual Halo, claro e escuro, responsivas (`src/styles/responsive.css`).

## Review Focus

1. Cartão vazando campo: qualquer `...projeto` ou `toJSON()` num cartão. Teste HTTP compara as chaves do cartão com a lista exata (Task 3).
2. Filtro de pessoa/responsável trazendo cartões (revelaria a equipe). Teste HTTP (Task 3).
3. Gerente fora de sigiloso: ocupação mostra a linha do projeto; membro fora: "Outras tarefas". Teste HTTP (Task 3).
4. Troca de conta na mesma aba: memória do front guardando o projeto completo de A e mostrando a B. e2e (Task 6).
5. Gerente desmarcando sigiloso de projeto em que não está, ou editando outro campo de sigiloso em que já não está na equipe: só **ligar** o sigilo é barrado. Teste (Task 2).

---

### Task 1: Regra central e cartão (backend)

**Files:**
- Modify: `source/shared/seguranca/visibilidadeProjetos.ts`, `source/shared/erros/mensagensDeErro.ts`
- Create: `source/useCases/projetos/cartaoProjeto.ts` (substitui `resumoProjeto.ts`, que sai)
- Test: `test/acessoProjeto.test.ts` (reescrito), `test/cartaoProjeto.test.ts` (substitui `test/resumoProjeto.test.ts`)

**Interfaces:**
- Produces:
  - `type AcessoProjeto = "completo" | "cartao"`
  - `interface ProjetoParaAcesso { sigiloso: boolean; participacoes: { usuario: { codigo: string }; ativa: boolean }[]; lideresDaArea?: readonly string[] }`
  - `acessoAoProjeto(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): AcessoProjeto`
  - `exigirAcessoCompleto(usuario, projeto): UsuarioAutenticado`: cartão = `ErroAplicacao(MENSAGENS_DE_ERRO.PROJETO.SEM_ACESSO(projeto.sigiloso), "PROJETO_SEM_ACESSO", 403)`
  - `exigirNaoSeTrancar(usuario: UsuarioAutenticado, codigosEquipeAtual: readonly string[]): void`: se não tem `projetos.verSigilosos` e `usuario.codigo` não está na lista → `ErroValidacao(MENSAGENS_DE_ERRO.PROJETO.SIGILOSO_SEM_VOCE, "SIGILOSO_SEM_VOCE")`
  - `cartaoProjeto(projeto: Projeto): CartaoProjeto` com o tipo exato das Global Constraints
  - Saem: `podeGerirAcesso`, `"resumo"`, `"nada"`, `resumoProjeto`, mensagens `SIGILOSO`, `ACESSO_*`.
  - `projetosVisiveisPara` fica como está (usado nas tarefas do membro); Task 3 deixa de usá-lo no `GET /projetos`.

- [ ] **Step 1: Testes da regra** em `test/acessoProjeto.test.ts`, `test.each` com os casos: normal → diretor/gerente/equipe atual/ex-equipe/líder da área = `completo`; membro fora, trainee fora, criador fora da equipe = `cartao`. Sigiloso → diretor/equipe atual = `completo`; gerente fora, ex-equipe, criador fora, membro fora = `cartao`. `exigirAcessoCompleto` com cartão lança status 403 e código `PROJETO_SEM_ACESSO` (normal e sigiloso). `exigirNaoSeTrancar`: gerente fora da lista → 400 `SIGILOSO_SEM_VOCE`; gerente na lista → passa; diretor fora → passa.
- [ ] **Step 2: Teste do cartão** em `test/cartaoProjeto.test.ts`: `Object.keys(cartaoProjeto(p)).sort()` igual a `["area","cartao","codigo","geralDaArea","lider","nome","sigiloso","status","tipo"]`; projeto cliente com área → `area: null`; interno → `{ codigo, nome }`; sem líder → `lider: null`; líder → `{ codigo, nome }` (só esses dois campos).
- [ ] **Step 3: Rodar** `npx jest test/acessoProjeto.test.ts test/cartaoProjeto.test.ts`: FAIL.
- [ ] **Step 4: Implementar** regra, `exigirNaoSeTrancar`, `cartaoProjeto` e as mensagens (`SEM_ACESSO(sigiloso: boolean)`: normal = só a equipe e a gestão veem os detalhes; sigiloso = só a equipe e os diretores).
- [ ] **Step 5: Rodar os dois testes**: PASS. O `tsc` vai acusar os usos antigos: é esperado, a Task 2 e a 3 resolvem; não commitar com build quebrado: seguir para a Task 2 no mesmo commit se preciso (um commit cobre Tasks 1 e 2 se o build só fecha com as duas).

### Task 2: Entidade, repositórios, casos de uso e migração 024 (backend)

**Files:**
- Modify: `source/domain/entity/Projeto.ts` (sai `acesso`), `source/domain/interfaces/ProjetoRepositoryInterface.ts` (sai `listarComAcesso`), `source/infra/repository/database/ProjetoRepositoryDatabase.ts`, `source/infra/repository/database/carregadores.ts`, `source/infra/repository/memory/ProjetoRepositoryMemory.ts`, `source/useCases/projetos/CriarProjeto.ts`, `CriarProjetoInput.ts` (sai `acesso`), `ListarProjetos.ts` (só `listarPorMembro`), `source/domain/service/*` ou `source/scripts/*` que citem `acesso` (conferir com `grep -rn "projeto_acesso\|\.acesso\b\|listarComAcesso\|validarCodigosAcesso" source`)
- Delete: `source/useCases/projetos/DefinirAcessoProjeto.ts` (com `validarCodigosAcesso`)
- Create: `migrations/024_visibilidade_projetos.sql`, `test/integracao/migracao024.int.ts`
- Test: ajustar `test/criarProjeto.test.ts`, `test/listarProjetos.test.ts`, `test/trainee.test.ts`, `test/sigiloPerfil.test.ts` e outros que usem `acesso` (`grep -rln "acesso" test`)

**Interfaces:**
- Consumes: Task 1.
- Produces: `Projeto` sem `acesso`; `ListarProjetos.execute({ codigoUsuario })` = projetos de que a pessoa participa ou participou (sem a lista).

- [ ] **Step 1: Migração** `024_visibilidade_projetos.sql`: comentário de cabeçalho no padrão das outras ("Sessão 27a ... Pode rodar de novo sem quebrar.") e `DROP TABLE IF EXISTS projeto_acesso;`.
- [ ] **Step 2: Teste de integração** `migracao024.int.ts` no padrão do `migracao023.int.ts`: depois de migrar, `to_regclass('projeto_acesso')` é `null`; rodar o executor de novo não falha.
- [ ] **Step 3: Remover** `acesso` da entidade, dos repositórios, `listarComAcesso`, `DefinirAcessoProjeto`; ajustar testes que montavam `acesso`. Casos de sigiloso que dependiam de lista passam a usar equipe.
- [ ] **Step 4: Rodar** `npm run build && npm test`: PASS (exceto o que a Task 3 ainda resolve nas rotas; se o build só fecha com a Task 3, juntar no commit dela).
- [ ] **Step 5: Integração** `DATABASE_URL_TESTE=... npx jest --runInBand --testMatch '**/test/integracao/migracao024.int.ts'` e depois a suíte inteira com `TZ=America/Sao_Paulo`: PASS.
- [ ] **Step 6: Commit** `refactor(projetos): tira a lista de acesso do projeto sigiloso` (ou junto da Task 3, se o build exigir).

### Task 3: Rotas, tarefas, ocupação e testes HTTP (backend)

**Files:**
- Modify: `source/infra/http/routes/ProjetoRoutes.ts`, `source/infra/http/routes/TarefaRoutes.ts`, `source/useCases/tarefas/ConsultarOcupacao.ts`, `source/useCases/pessoas/ObterPerfilPessoa.ts` (só tipos: `"resumo"`/`"nada"` → `"cartao"`, mesmo comportamento), `source/useCases/avisos/ConsultarAvisos.ts` e `source/shared/seguranca/regrasTarefa.ts`/`regrasBiblioteca.ts` (só tipos), `source/infra/http/swagger.ts`
- Test: novo `test/visibilidade.http.test.ts` no padrão de `test/ocupacao.http.test.ts`; ajustar `test/ocupacao.http.test.ts`, `test/swaggerRoutes.test.ts`, `test/regrasTarefa.test.ts` e os que esperavam 404 de projeto sigiloso.

**Interfaces:**
- Consumes: Tasks 1 e 2.
- Produces (contrato para o front):
  - `GET /projetos` → lista com objetos completos (`toJSON` + `tarefas`) ou cartões (`cartao: true`); sem `podeGerirAcesso`.
  - `GET /projetos/:codigo` → completo ou cartão (200); inexistente 404.
  - Demais rotas do projeto com cartão → 403 `PROJETO_SEM_ACESSO`.
  - `POST /projetos` e `PUT /projetos/:codigo` → 400 `SIGILOSO_SEM_VOCE` quando ligam o sigilo e quem grava ficaria fora.
  - `PUT /projetos/:codigo/acesso` não existe (404).

- [ ] **Step 1: Testes HTTP** em `test/visibilidade.http.test.ts` (membro M, trainee T, gerente G, diretor D; projeto normal N sem M; sigiloso S com M2 na equipe):
  - M e T em `GET /projetos` recebem N e S como cartão; as chaves do cartão = lista exata da Task 1.
  - M em `GET /projetos/:N` = 200 com `cartao: true`; M em `PUT /projetos/:N` e `PUT /projetos/:N/colunas` = 403 `PROJETO_SEM_ACESSO`.
  - G em `GET /projetos` recebe N completo e S cartão; D recebe os dois completos.
  - `GET /projetos?codigoUsuario=<M2>` por G: sem cartões; `?codigoArea=<área de um interno>` por M: o cartão do interno vem; `?busca=` com texto da descrição de N por M: N não vem; com parte do nome: vem.
  - Tarefa de N por M: 404 `TAREFA_NAO_ENCONTRADA` (como hoje); tarefa de S por G: 404.
  - `PUT /projetos/:S/acesso` = 404.
  - `POST /projetos` com `sigiloso: true` por G sem G em `codigosMembros` = 400 `SIGILOSO_SEM_VOCE`; com G na lista = 201; por D sem D = 201. `PUT /projetos/:N` com `sigiloso: true` por G fora da equipe = 400 (G tem completo em N por ser gerente); `PUT` de outro campo em sigiloso já existente por quem tem completo = 200 (não barra); desligar o sigilo = 200.
  - `GET /ocupacao/:M2` por G: as horas de S aparecem como linha `{ tipo: "projeto", projeto: { codigo, nome } }`; por M: em `outras`.
- [ ] **Step 2: Rodar**: FAIL.
- [ ] **Step 3: Implementar**:
  - `paraResposta` monta completo ou `cartaoProjeto`; filtro de pessoa/responsável descarta cartões; área mantém; busca do cartão só pelo nome (`normalizarBusca`).
  - `GET /projetos` não usa mais `projetosVisiveisPara` (passa `filtro.codigoUsuario` como veio, sem forçar o membro).
  - `GET /projetos/:codigo` sem o `exigirAcessoCompleto` do "nada".
  - Remover a rota `/acesso` e `acesso` do `POST`.
  - Antes de `CriarProjeto`, se `sigiloso` → `exigirNaoSeTrancar(usuario, codigosMembros ?? [])`. Antes de `EditarProjeto`, se `body.sigiloso === true && !projeto.sigiloso` → `exigirNaoSeTrancar(usuario, equipe atual do projeto)`.
  - `TarefaRoutes`: troca `=== "nada"` por `!== "completo"` mantendo o 404.
  - `ConsultarOcupacao`: `cartao` + `podeVerTodosProjetos(usuario)` = linha de projeto; senão `outras`.
  - Swagger sem `/acesso`.
- [ ] **Step 4: Rodar** `npm run build && npm test` e a integração inteira: PASS.
- [ ] **Step 5: Commit(s)** `feat(projetos): cartão de todos os projetos para quem está logado` (e `feat(projetos): barra sigiloso que deixaria quem grava sem acesso`, se separado).

### Task 4: Documentação (backend)

**Files:** `docs/sistema/06_documento_do_sistema.md` (seções 1 a 3: tudo de lista de acesso sai; tabela "Projeto sigiloso" e linhas de projetos/tarefas pela seção 2 da spec; 403 `PROJETO_SEM_ACESSO`; ocupação por papel), `docs/GUIA_DE_USO.md` (Projetos: cartões de fora; sem lista de acesso; aviso ao marcar sigiloso), `docs/PUBLICACAO.md` (seção "Publicação da sessão 27a").

- [ ] **Step 1:** Seção da publicação com, nesta ordem: consulta prévia (rodar **antes** do deploy e guardar a saída):

```sql
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
```

(conferir nomes de tabela/colunas e valores do enum de perfil nas migrações antes; ajustar se diferirem), backup do banco e dos anexos, deploy back e front juntos, `Migração aplicada: 024_visibilidade_projetos.sql` no log, `curl` de `PUT /api/projetos/1/acesso` com `-H 'Content-Type: application/json' -d '{}'` = 404, gestão coloca na equipe quem ainda precisar. Voltar = restaurar o `pg_dump` e voltar os dois.
- [ ] **Step 2:** Rodar a consulta no `konvex_dev` (porta 5434) antes da 024 para provar que roda.
- [ ] **Step 3: Commit** `docs(projetos): regra de visibilidade da sessão 27a`.

### Task 5: Dados e cálculos do front

**Files (front):** `src/lib/apiMappers.js`, `src/lib/carregarProjeto.js`, `src/lib/indicadores.js`, `src/pages/Estrategia.jsx`, `src/pages/Biblioteca.jsx`, `src/services/projetos.js`, `src/lib/gravarProjeto.js`; testes `test/apiMappers.test.js`, `test/carregarProjeto.test.js`, `test/indicadores.test.js`, `test/gravarProjeto.test.js`, `test/projetos.test.js`, `test/apiRouteCoverage.test.js`.

**Interfaces:**
- Consumes: contrato da Task 3.
- Produces: projeto adaptado com `cartao: boolean`; cartão adaptado tem `nome`, `tipo`, `areaId`, `areaNome`, `status`, `sigiloso`, `geralDaArea`, `liderId`, `liderNome`, `membros: []`, sem `tarefas`; `gravarProjeto(dados, antes)` só cria ou edita (sem `ErroAcessoParcial`, sem `acessoComLogin`); `projetos.definirAcesso` sai.

- [ ] **Step 1: Testes**: `adaptProject` de cartão → `cartao: true`, `membros` vazio, sem `tarefasResumo`; `carregarProjeto` com cartão devolve `tarefas: []` sem pedir tarefas; indicadores ignoram cartões (nada de `tarefasResumo`); `gravarProjeto` não chama `/acesso`; `apiRouteCoverage` sem `/acesso`.
- [ ] **Step 2: Rodar** `npm test`: FAIL.
- [ ] **Step 3: Implementar** (`resumo` → `cartao` em todos os usos de `grep -rn "resumo\b\|\.resumo\|tarefasResumo\|podeGerirAcesso\|ErroAcessoParcial\|definirAcesso" src`; Biblioteca filtra `!p.cartao`; Estratégia: lista de projetos sem números para cartões).
- [ ] **Step 4: Rodar** `npm test && npm run lint`: PASS.
- [ ] **Step 5: Commit** `refactor(projetos): cartão no lugar do resumo e sem lista de acesso`.

### Task 6: Telas e e2e (front)

**Files:** `src/pages/Projetos.jsx` (cartão: nome, tipo, área do interno, status, líder, `SeloProjeto` se sigiloso; sem clique, sem progresso, sem datas; tabela idem; campo "Visibilidade" fica e o texto de ajuda vira "Só a equipe e os diretores verão os detalhes e as tarefas."; sai o campo `acesso`), `src/pages/Projeto.jsx` (`ResumoSigiloso` vira o cartão com o aviso de que os detalhes são da equipe e da gestão; sai "Quem mais vê"), `src/styles/*.css` se preciso, `e2e/visibilidade-27a.mjs` (novo), `e2e/levantamento.mjs`, `e2e/projetos-internos.mjs`, `docs` do back se o guia precisar de print.

- [ ] **Step 1:** Formulário: o 400 `SIGILOSO_SEM_VOCE` aparece com `error.message` e a janela não fecha (mesmo caminho dos outros 400 do formulário).
- [ ] **Step 2:** `e2e/visibilidade-27a.mjs` (rodar com `API_URL=http://localhost:5002`, padrão dos e2e da 26a), tudo pela tela:
  1. Membro vê em Projetos um projeto alheio como cartão (sem progresso) e o clique não abre.
  2. Trainee idem.
  3. Gerente vê um sigiloso alheio como cartão com selo; abrir `#/projeto/<codigo>` mostra o aviso, não as abas.
  4. Gerente cria sigiloso sem se pôr na equipe → mensagem do 400, janela aberta; põe-se na equipe → cria.
  5. Diretor vê tudo completo.
  6. Troca de conta na mesma aba (diretor → membro) sem recarregar: o projeto completo do diretor não aparece ao membro.
  7. 375 px, tema escuro: lista de cartões sem rolagem lateral.
- [ ] **Step 3:** Ajustar `projetos-internos.mjs` e o levantamento de 52 telas (4 papéis); rodar os dois: sem problema.
- [ ] **Step 4:** `npm test && npm run lint && npm run format:check`: PASS.
- [ ] **Step 5: Commit** `feat(projetos): cartões de projetos alheios e fim da lista de acesso`.

### Fechamento
- Revisão final da branch (back e front) pedindo ao revisor: troca de conta na mesma aba; "dá para fazer pela tela?"; link de fora com filtro salvo; cartão vazando campo.
- PR por repositório; atualizar `CLAUDE.md`, `.konvex/acompanhamento.md`, `.konvex/roteiro.md`.
