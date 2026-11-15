# Sessão 20: acesso do trainee e projetos sigilosos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trainee entra no sistema com acesso de membro (sem Biblioteca e sem liderar); projeto pode ser sigiloso, com lista de acesso, e a gestão fora da lista recebe só um resumo para as estatísticas.

**Architecture:** Uma regra central (`acessoAoProjeto` → `completo | resumo | nada`) em `shared/seguranca/visibilidadeProjetos.ts` decide tudo; rotas de projetos, tarefas, anexos, Biblioteca e perfil passam a usá-la. O resumo é montado campo a campo (`resumoProjeto`). Migração 014 cria as colunas e a tabela de acesso e acerta trainees. O frontend trata o resumo como item sem link e o soma nos indicadores.

**Tech Stack:** Express + TypeScript + `pg` (back, Jest), React 18 + Vite (front, Vitest), PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-15-acesso-sigilo-design.md`

## Global Constraints

- Back: camadas `domain` → `useCases` → `infra`; repositório novo ou método novo = interface + memória + banco.
- Rotas checam ação do catálogo, nunca papel. Erros: `ErroValidacao` 400, `ErroProibido` 403, `ErroNaoEncontrado` 404; mensagem diz o campo/valor; nunca 500 por entrada inválida.
- Projeto normal: comportamento de hoje sem mudança (inclusive 403 onde é 403).
- Sigiloso: membro/trainee fora da lista → **404**; gerente fora → resumo no `GET /projetos` e `GET /projetos/:codigo`, **403** nas demais rotas.
- Resumo: só `codigo, nome, sigiloso: true, resumo: true, status, dataInicio, dataFim, tarefas{total,concluidas,atrasadas,semana}, participacoes[{usuario{codigo,nome}, alocacao, ativa, dataEntrada, dataSaida}]`. Cliente nunca.
- Quem vê o sigiloso completo: diretor (`projetos.verSigilosos`), criador, `projeto_acesso`, equipe **atual**.
- Trainee: sempre papel membro; não lidera; sem Biblioteca (403, menu sem o item).
- Commits em português, Conventional Commits, `npm run lint && npm run format:check` antes (sem pipe no lint). Testes com `TZ=America/Sao_Paulo`.
- Front: Halo claro e escuro, responsivo em `src/styles/responsive.css`, sem emoji (ícone de cadeado do `Icon.jsx`), `useCarregar` com `{ chave }`.

## Review Focus

1. Gerente fora da lista abre `#/projeto/<codigo>` digitado à mão: a tela mostra o resumo ou uma mensagem, nunca quebra nem tenta carregar tarefas em laço (Task 11, teste de tela).
2. Pessoa sai da equipe do sigiloso com a aba aberta: a próxima atualização remove o projeto e as tarefas da memória da aba (resposta 404 apaga a chave, sessão 18) (Task 11).
3. Busca `GET /projetos?busca=<cliente do sigiloso>` pelo gerente fora não devolve nada; `?busca=<nome>` devolve o resumo (Task 3).
4. Tarefa do sigiloso que depende de outra (`dependeDe`) ou responsável que saiu da equipe: não aparece no `GET /tarefas` de quem não tem acesso completo (Task 5).
5. Trainee com sessão aberta que vira Ativo (ou o contrário): o menu e o bloqueio da Biblioteca mudam na próxima chamada, sem novo login (status lido do banco a cada requisição) (Task 8).

---

## Backend (`~/BackendProjetosERP`)

### Task 1: Dados — migração 014, entidade e repositórios

**Files:**
- Create: `migrations/014_sigilo_trainee.sql`
- Modify: `source/domain/entity/Projeto.ts`, `source/domain/interfaces/ProjetoRepositoryInterface.ts`, `source/infra/repository/memory/ProjetoRepositoryMemory.ts`, `source/infra/repository/database/ProjetoRepositoryDatabase.ts`, `source/infra/repository/database/carregadores.ts`, `source/domain/enum/StatusPessoa.ts`
- Test: `test/integracao/migracao014.int.ts`, `test/criarProjeto.test.ts`

**Interfaces:**
- Produces: `DetalhesProjeto` ganha `sigiloso?: boolean`, `criadoPor?: string | null` (código), `acesso?: string[]` (códigos, sem repetição). `Projeto` ganha `readonly sigiloso: boolean`, `readonly criadoPor: string | null`, `readonly acesso: string[]`; `copiar` aceita os três; `toJSON` inclui `sigiloso` e `acesso` (não `criadoPor`).
- Produces: `ProjetoRepositoryInterface.listarComAcesso(codigoUsuario: string): Promise<Projeto[]>` (sigilosos em que a pessoa está em `projeto_acesso` ou é `criado_por`) e `listarSigilosos(): Promise<Projeto[]>`.
- Produces: `STATUS_COM_ACESSO = [ATIVO, TRAINEE]`.

- [ ] **Step 1: Teste de integração da migração** — `migracao014.int.ts` no padrão de `migracao013.int.ts`: aplica até 013, insere um trainee com `perfil='gerente'` líder de um projeto, aplica 014. Asserções: `projetos.sigiloso` é `false` no projeto antigo; `criado_por_codigo` nulo; o trainee virou `membro`; `lider_codigo` do projeto ficou nulo; tabela `projeto_acesso` existe com PK `(projeto_codigo, usuario_codigo)` e apagar o projeto apaga as linhas.
- [ ] **Step 2: Rodar e ver falhar** — `TZ=America/Sao_Paulo DATABASE_URL_TESTE=postgresql://postgres:konvex123@localhost:5433/konvex_teste npm run test:integracao -- test/integracao/migracao014.int.ts` → FAIL (arquivo 014 não existe).
- [ ] **Step 3: Escrever `014_sigilo_trainee.sql`** — `ALTER TABLE projetos ADD COLUMN sigiloso BOOLEAN NOT NULL DEFAULT false, ADD COLUMN criado_por_codigo UUID NULL REFERENCES usuarios(codigo) ON DELETE SET NULL`; `CREATE TABLE projeto_acesso (projeto_codigo UUID REFERENCES projetos(codigo) ON DELETE CASCADE, usuario_codigo UUID REFERENCES usuarios(codigo) ON DELETE CASCADE, PRIMARY KEY (...))`; `UPDATE projetos SET lider_codigo = NULL WHERE lider_codigo IN (SELECT codigo FROM usuarios WHERE status = 'trainee')`; `UPDATE usuarios SET perfil = 'membro' WHERE status = 'trainee'`; `UPDATE usuarios SET ativo = true WHERE status = 'trainee'` (a coluna `ativo` acompanha `STATUS_COM_ACESSO`).
- [ ] **Step 4: Teste unitário da entidade** em `criarProjeto.test.ts`: `new Projeto(..., { sigiloso: true, criadoPor: "u1", acesso: ["a", "a", "b"] })` → `sigiloso === true`, `acesso` igual a `["a","b"]`; sem detalhes → `sigiloso === false`, `acesso` `[]`, `criadoPor` `null`; `copiar({ sigiloso: false })` mantém `acesso`.
- [ ] **Step 5: Implementar** entidade, `StatusPessoa`, repositórios (memória guarda em mapa; banco grava `sigiloso`, `criado_por_codigo` nas `COLUNAS` e regrava `projeto_acesso` dentro de `gravar` — apagar e inserir; `carregarProjetos` lê as três coisas). `CriarProjeto` passa a receber `criadoPor` e `sigiloso`/`acesso` (input opcional; ver Task 4).
- [ ] **Step 6: Rodar** `npm test` e a integração inteira → PASS.
- [ ] **Step 7: Commit** `db(projetos): migração 014 com sigilo, lista de acesso e trainee com login`.

### Task 2: Regra central de acesso

**Files:**
- Modify: `source/shared/seguranca/visibilidadeProjetos.ts`, `source/shared/seguranca/catalogoPermissoes.ts`, `source/modulos/registro.ts` (módulo projetos lista a permissão nova), `source/shared/erros/mensagensDeErro.ts`
- Test: `test/acessoProjeto.test.ts` (novo)

**Interfaces:**
- Produces: `Permissao.PROJETOS_VER_SIGILOSOS = "projetos.verSigilosos"` (só diretor: entra em `TODAS_AS_PERMISSOES`, fora de `DO_GESTOR`).
- Produces:
  - `type AcessoProjeto = "completo" | "resumo" | "nada"`
  - `interface ProjetoParaAcesso { sigiloso: boolean; criadoPor: string | null; acesso: readonly string[]; participacoes: { usuario: { codigo: string }; ativa: boolean }[] }`
  - `acessoAoProjeto(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): AcessoProjeto`
  - `podeGerirAcesso(usuario: UsuarioAutenticado, projeto: ProjetoParaAcesso): boolean` (diretor ou criador)
  - `exigirAcessoCompleto(usuario: UsuarioAutenticado | undefined | null, projeto: ProjetoParaAcesso): UsuarioAutenticado` — `nada` em sigiloso → `ErroNaoEncontrado("Projeto não encontrado.")`; `nada` em normal → `ErroProibido` com a mensagem de hoje; `resumo` → `ErroProibido(MENSAGENS_DE_ERRO.PROJETO.SIGILOSO)` ("Este projeto é sigiloso; você vê só o resumo.").
  - `exigirVerProjeto` passa a chamar `exigirAcessoCompleto` (assinatura igual).

- [ ] **Step 1: Testes** — tabela com `test.each`; projeto sigiloso com criador `c`, acesso `[l]`, equipe atual `e`, ex-equipe `x`:
  - diretor → `completo`; `c` membro → `completo`; `l` membro → `completo`; `e` → `completo`; `x` → `nada`; gerente fora → `resumo`; membro fora → `nada`.
  - projeto normal: gerente → `completo`; `x` → `completo` (participou); membro fora → `nada`.
  - `podeGerirAcesso`: diretor `true`, `c` `true`, gerente na lista `false`.
  - `exigirAcessoCompleto`: membro fora de sigiloso → `rejects/throws` com `status 404`; gerente fora → 403 com código `PROJETO_SIGILOSO`; membro fora de normal → 403.
- [ ] **Step 2: Rodar** `npx jest test/acessoProjeto.test.ts` → FAIL.
- [ ] **Step 3: Implementar** em `visibilidadeProjetos.ts`.
- [ ] **Step 4: Rodar** `npm test` → PASS (testes de permissões do registro podem precisar listar a ação nova).
- [ ] **Step 5: Commit** `feat(permissoes): regra central de acesso a projeto sigiloso`.

### Task 3: Resumo na leitura de projetos

**Files:**
- Create: `source/useCases/projetos/resumoProjeto.ts`
- Modify: `source/infra/http/routes/ProjetoRoutes.ts`, `source/useCases/projetos/ListarProjetos.ts`, `source/domain/interfaces/TarefaRepositoryInterface.ts` + memória + banco (`contarPorProjetos`), `source/shared/datas.ts`
- Test: `test/resumoProjeto.test.ts` (novo), `test/listarProjetos.test.ts`, `test/usuariosProjetosTarefas.test.ts` (HTTP)

**Interfaces:**
- Consumes: `acessoAoProjeto` (Task 2), campos da Task 1.
- Produces:
  - `fimDaSemana(hoje: Date): Date` em `shared/datas.ts` (domingo da semana segunda–domingo, igual ao `src/lib/indicadores.js` do front).
  - `ContagemTarefas = { total: number; concluidas: number; atrasadas: number; semana: number }`; `contarPorProjetos(codigos: string[], hoje: Date): Promise<Map<string, ContagemTarefas>>`. Atrasada: não concluída e `dataFim < hoje`; semana: não concluída e `hoje <= dataFim <= fimDaSemana(hoje)`.
  - `resumoProjeto(projeto: Projeto, tarefas: ContagemTarefas): ResumoProjeto` — exatamente os campos das Global Constraints.
  - `ListarProjetos` com `codigoUsuario` passa a unir `listarPorMembro` e `listarComAcesso` (sem repetir).

- [ ] **Step 1: Testes** —
  - `resumoProjeto`: `Object.keys(resumo).sort()` igual à lista fechada; `JSON.stringify(resumo)` não contém `clienteNome`, `descricao`, `referencia`, `funcao` nem o valor do cliente.
  - `contarPorProjetos` (memória): com hoje = quarta 2026-11-18, tarefas com fim 17/11 aberta (atrasada), 22/11 aberta (semana), 23/11 aberta (nenhum), 10/11 concluída → `{ total: 4, concluidas: 1, atrasadas: 1, semana: 1 }`.
  - HTTP `GET /projetos`: gerente fora vê o sigiloso com `resumo: true` e sem `clienteNome`; membro fora não vê; membro na lista (fora da equipe) vê completo; `?busca=<cliente>` pelo gerente fora → sem o sigiloso; `?busca=<parte do nome>` → com resumo; `?codigoArea=` → sem o resumo.
  - HTTP `GET /projetos/:codigo`: gerente fora → 200 com `resumo: true`; membro fora → 404; quem vê completo recebe `sigiloso`, `acesso` e `podeGerirAcesso`.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** — em `ProjetoRoutes`, trocar `comContagem` por `paraResposta(usuario, projetos, filtroUsado)`: por projeto, `completo` → `{...toJSON(), tarefas, podeGerirAcesso}`; `resumo` → `resumoProjeto` (descartado se houver `codigoArea`/`codigoResponsavel`, ou `busca` que não case no nome com a mesma normalização sem acento do repositório); `nada` → descartado. `GET /:codigo`: `nada` → `exigirAcessoCompleto` (404/403 conforme Task 2), `resumo` → resumo.
- [ ] **Step 4: Rodar** `npm test` e integração → PASS.
- [ ] **Step 5: Commit** `feat(projetos): resumo do projeto sigiloso para a gestão fora da lista`.

### Task 4: Escrita — criar, editar, lista de acesso e rotas protegidas

**Files:**
- Modify: `source/infra/http/routes/ProjetoRoutes.ts`, `source/useCases/projetos/CriarProjeto.ts`, `EditarProjeto.ts`, `Equipe.ts`, `AlternarStatusProjeto.ts`, `ExcluirProjeto.ts`; create `source/useCases/projetos/DefinirAcessoProjeto.ts`; `source/infra/http/swagger.ts`
- Test: `test/sigiloProjeto.test.ts` (novo, HTTP)

**Interfaces:**
- Consumes: `acessoAoProjeto`, `podeGerirAcesso`, `exigirAcessoCompleto`.
- Produces: `POST /projetos` aceita `sigiloso?: boolean` e `acesso?: string[]`, grava `criadoPor = user.codigo`. `PUT /projetos/:codigo` aceita `sigiloso?: boolean` (mudar exige `podeGerirAcesso`, senão 403 `SIGILO_SEM_PERMISSAO`). `PUT /projetos/:codigo/acesso { codigos: string[] }` → `DefinirAcessoProjeto.execute({ codigoProjeto, codigos })`; só pessoas com `ativo` (Ativo ou Trainee), senão 400 `ACESSO_PESSOA_SEM_LOGIN`; repetidos ignorados.

- [ ] **Step 1: Testes HTTP** —
  - gerente cria sigiloso com `acesso: [membroA]` → 200, `criadoPor` gravado; membroA vê completo.
  - `PUT /acesso`: diretor 200; criador gerente 200; outro gerente na lista 403; gerente fora 403; membro fora 404; pessoa Alumni na lista → 400 `ACESSO_PESSOA_SEM_LOGIN`.
  - `PUT /projetos/:codigo` trocando `sigiloso` por gerente na lista não criador → 403; o mesmo gerente editando o nome sem trocar `sigiloso` → 200.
  - gerente fora: `PUT`, `PATCH /status`, `POST /membros`, `PUT /lider` → 403; diretor `DELETE` → 200.
  - gerente na lista adiciona pessoa nova à equipe → 200 e essa pessoa passa a ver completo; ao encerrar a participação dela → passa a `nada` (404).
  - projeto normal: todas as rotas acima com o comportamento de hoje.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** — cada rota de escrita carrega o projeto e chama `exigirAcessoCompleto` depois de `exigirPermissao`. Swagger com os campos e a rota novos.
- [ ] **Step 4: Rodar** → PASS. **Step 5: Commit** `feat(projetos): criar projeto sigiloso e gerir a lista de acesso`.

### Task 5: Tarefas, comentários e anexos de tarefa

**Files:**
- Modify: `source/shared/seguranca/regrasTarefa.ts`, `source/infra/http/routes/TarefaRoutes.ts`, `source/useCases/anexos/GerirAnexos.ts` (`tarefaVisivel`)
- Test: `test/sigiloTarefas.test.ts` (novo, HTTP), `test/integracao/tarefas.int.ts` (caso sigiloso)

**Interfaces:**
- Consumes: `acessoAoProjeto`, `exigirAcessoCompleto`.
- Produces: `regrasTarefa(usuario, tarefa, projeto)`: se `projeto?.sigiloso` e acesso ≠ `completo` → tudo `false`; `papelNoProjeto` só devolve `"gestao"` em sigiloso quando o acesso é `completo`.

- [ ] **Step 1: Testes** —
  - `GET /tarefas` do gerente fora: nenhuma tarefa do sigiloso; do membro na equipe: todas do projeto; do ex-membro ainda responsável por tarefa do sigiloso: nenhuma; tarefa de outro projeto com `dependeDe` do sigiloso não existe (mesmo projeto obrigatório) — conferir só que a lista não traz o sigiloso.
  - `PUT/PATCH/DELETE /tarefas/:codigo`, `GET/POST /tarefas/:codigo/comentarios` de tarefa do sigiloso: membro fora 404, gerente fora 403.
  - `GET /tarefas/:codigo/anexos`: fora (qualquer papel) 404 (regra de hoje dos anexos).
  - integração: listar pelo banco com sigiloso e gerente fora.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** — no filtro do `GET /tarefas`, o atalho "gestão recebe tudo" deixa de valer para tarefas de projeto sigiloso: toda tarefa com `t.projeto?.sigiloso` passa por `acessoAoProjeto(usuario, t.projeto) === "completo"`. `carregar` da rota: sem `regras.ver` em sigiloso → `exigirAcessoCompleto(usuario, projeto)` (dá 404/403).
- [ ] **Step 4: Rodar** → PASS. **Step 5: Commit** `feat(tarefas): tarefas do projeto sigiloso só para quem vê o projeto`.

### Task 6: Biblioteca

**Files:**
- Modify: `source/shared/seguranca/regrasBiblioteca.ts`, `source/useCases/biblioteca/ListarItensBiblioteca.ts`, `source/infra/http/routes/BibliotecaRoutes.ts`, `source/infra/http/routes/AnexoRoutes.ts` (se usar `projetosDoUsuario`)
- Test: `test/regrasBiblioteca.test.ts`, `test/sigiloBiblioteca.test.ts` (HTTP, novo)

**Interfaces:**
- Produces: `projetosDoUsuario` vira `contextoProjetos(usuario, factory): Promise<{ meus: Set<string>; ocultos: Set<string> }>` — `meus` = projetos com acesso `completo` vindos de `listarPorMembro` ∪ `listarComAcesso` (sigilosos só se `completo`); `ocultos` = códigos de `listarSigilosos()` com acesso ≠ `completo`. `podeVerItem(usuario, item, ctx)` começa por `if (item.projeto && ctx.ocultos.has(item.projeto.codigo)) return false`. `podeVerProjetoDoItem(usuario, codigo, ctx)` devolve `false` para ocultos. `exigirPodeUsarSigiloEProjeto` confere `ocultos` **antes** do atalho de `biblioteca.gerir` (403 `PROJETO_SEM_PERMISSAO`).

- [ ] **Step 1: Testes** — item `todos` ligado a sigiloso: gerente fora não lista e `GET /biblioteca/:codigo` 404, download do anexo 404; membro da equipe vê; item sigilo `projeto` no sigiloso: pessoa só na lista (fora da equipe) vê; gerente com `biblioteca.gerir` fora da lista ligando item ao sigiloso → 403; `?projeto=<sigiloso>` pelo gerente fora → `[]`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat(biblioteca): itens de projeto sigiloso só para quem vê o projeto`.

### Task 7: Perfil da pessoa

**Files:**
- Modify: `source/useCases/pessoas/ObterPerfilPessoa.ts`
- Test: `test/sigiloPerfil.test.ts` (novo)

**Interfaces:**
- Produces: `ProjetoNoPerfil` ganha `sigiloso: boolean` e `restrito: boolean`. `restrito = acesso !== "completo"`; quando `restrito`, `referencia` e `funcao` saem `null`.
- Regras: gestão (`projetos.verTodos`) vê todos (sigiloso sem acesso como `restrito`); a própria pessoa vê todos os seus (sigiloso que perdeu como `restrito`); membro olhando outro vê só os projetos com `completo` para ele e de que participa ou participou (normal) — sigiloso sem `completo` some. `alocacao.total` continua com todos; `alocacao.projetos` inclui os `restrito` para gestão e para a própria pessoa.

- [ ] **Step 1: Testes** com as três visões acima; o JSON do item `restrito` não contém a referência nem a função reais.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat(pessoas): perfil mostra projeto sigiloso sem detalhes`.

### Task 8: Trainee

**Files:**
- Modify: `source/shared/seguranca/permissoes.ts`, `source/modulos/registro.ts`, `source/infra/http/routes/BibliotecaRoutes.ts`, `source/infra/http/routes/AnexoRoutes.ts` (anexos de item da Biblioteca), `source/useCases/pessoas/CriarUsuario.ts`, `EditarUsuario.ts`, `AlterarStatusPessoa.ts`, `source/useCases/pessoas/dadosPessoa.ts`, `source/useCases/projetos/Equipe.ts` (`DefinirLider`), `source/shared/erros/mensagensDeErro.ts`
- Test: `test/trainee.test.ts` (novo, HTTP), `test/statusPessoa.test.ts`, `test/loginUsuario.test.ts`

**Interfaces:**
- Produces: `UsuarioAutenticado.status?: StatusPessoa | string` (o middleware já põe a entidade `Usuario`, que tem `status`); `ehTrainee(usuario): boolean`; `exigirNaoTrainee(usuario, mensagem)` → 403. `ItemMenu.semTrainee?: boolean` (Biblioteca `true`); `itensVisiveis` filtra.
- Produces: `exigirTraineeMembro(status, perfil)` em `dadosPessoa.ts` → 400 `TRAINEE_SO_MEMBRO` se status `trainee` e perfil ≠ `membro`. `DefinirLider` com trainee → 400 `TRAINEE_NAO_LIDERA`.

- [ ] **Step 1: Testes** — trainee faz login (200) e renova sessão; `GET /auth/permissoes` (ou a rota do menu) sem `biblioteca`; `GET /biblioteca` 403; `GET /projetos` só os da equipe; `GET /tarefas` as dele e as dos projetos dele; `GET /capacitacoes` 200; `GET /usuarios` 200. Criar pessoa `status: trainee, perfil: gerente` → 400 `TRAINEE_SO_MEMBRO`; mudar status de gerente para trainee → 400; editar trainee para gerente → 400. `PUT /projetos/:codigo/lider` com trainee → 400 `TRAINEE_NAO_LIDERA`. Trainee vira Ativo: a próxima chamada a `GET /biblioteca` dá 200 sem novo login.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(pessoas): trainee entra no sistema com acesso de membro`.

### Task 9: Documentação e dados fictícios (back)

**Files:**
- Modify: `docs/sistema/06_documento_do_sistema.md` (seção 3: coluna/linhas do trainee e do sigiloso; seção 2: regras), `docs/GUIA_DE_USO.md`, `scripts/` dos dados fictícios (um projeto sigiloso com lista, um trainee com login e tarefa).
- [ ] **Step 1:** Escrever as seções. **Step 2:** `npm run lint && npm run format:check`. **Step 3: Commit** `docs(projetos): trainee e projeto sigiloso no documento do sistema e no guia`.

## Frontend (`~/FrontendProjetosERP`)

### Task 10: Dados e cálculos com o resumo

**Files:**
- Modify: `src/lib/apiMappers.js`, `src/lib/indicadores.js`, `src/services/projetos.js`
- Test: os testes existentes de `indicadores` e `projetos` (Vitest) + casos novos

**Interfaces:**
- Produces: projeto mapeado ganha `sigiloso: boolean`, `resumo: boolean`, `acesso: string[]`, `podeGerirAcesso: boolean`, `tarefasResumo: { atrasadas, semana }` (só no resumo). `corpoProjeto` envia `sigiloso`; `definirAcesso(codigo, codigos)` → `PUT /projetos/:codigo/acesso`.
- `indicadores(D, hoje)`: grupos de projeto contam resumos; "Tarefas da semana" e "atrasadas" somam `tarefasResumo` dos resumos.
- `alocacaoPorPessoa` já soma participações: teste confirma com resumo.

- [ ] **Step 1: Testes** — `indicadores` com 1 normal + 1 resumo (`status: 'andamento'`, `tarefasResumo: { atrasadas: 2, semana: 1 }`) → ativos 2, atrasadas = das tarefas normais + 2, semana + 1; `alocacaoPorPessoa` com resumo conta a alocação.
- [ ] **Step 2: Rodar** `npm test` → FAIL. **Step 3: Implementar.** **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(projetos): indicadores e alocação contam o projeto sigiloso`.

### Task 11: Telas de projeto

**Files:**
- Modify: `src/pages/Projetos.jsx`, `src/pages/Projeto.jsx`, `src/components/Icon.jsx` (cadeado, se não houver), `src/styles/responsive.css`, `src/lib/antecipar.js` / `src/paginas.js` (não antecipar resumo)
- Test: teste de tela ou e2e

- [ ] **Step 1:** Projetos: resumo em linha/cartão esmaecido com nome, selo "Sigiloso" com cadeado e status; sem `onClick`, sem `ActionMenu`. Projeto completo sigiloso: selo no cartão e no topo da página.
- [ ] **Step 2:** Formulário (`FormModal`) do projeto: "Visibilidade" Normal/Sigiloso (só aparece na edição se `podeGerirAcesso`); no sigiloso, `Multi` com pessoas de login para a lista, texto "Diretores e a equipe já veem o projeto.". Na página do projeto, quem tem `podeGerirAcesso` edita a lista (chama `definirAcesso`).
- [ ] **Step 3:** `Projeto.jsx` aberto por um resumo (resposta com `resumo: true`): mostra nome, selo, status, datas, contagens e equipe com alocação, e o texto "Projeto sigiloso: você vê só o resumo."; não busca tarefas. 404 → tela de não encontrado (comportamento de hoje); teste confirma que o 404 na atualização apaga o projeto e as tarefas da memória da aba (`src/lib/memoria.js`, sessão 18).
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run format:check`; conferir no navegador claro/escuro e 375 px.
- [ ] **Step 5: Commit** `feat(projetos): visibilidade sigilosa no formulário e resumo nas telas`.

### Task 12: Demais telas e e2e

**Files:**
- Modify: `src/pages/Estrategia.jsx` (resumos fora de burndown, "Tarefas por projeto", "Projetos críticos" e progresso), `src/pages/Perfil.jsx` (item `restrito` sem link, com selo), `src/pages/Dashboard.jsx` (nada que abra resumo), `e2e/` (papel trainee)
- [ ] **Step 1:** Implementar os filtros (`!p.resumo`) e o item restrito.
- [ ] **Step 2:** e2e: `API_URL=http://localhost:5002 npm run dados:ficticios` no back; `NODE_PATH=<scratchpad>/node_modules npm run e2e` com os três papéis + trainee, desktop e 375 px. Fluxo à mão no Playwright: gerente cria sigiloso com lista; outro gerente vê o resumo; membro fora não vê; trainee entra e não tem Biblioteca.
- [ ] **Step 3: Commit** `feat(ui): projeto sigiloso no perfil, na Visão Estratégica e no trainee`.

## Fechamento

- [ ] Revisão final da branch nos dois repos, pedindo os cenários "troca de conta na mesma aba" e "pessoa sai da lista ou da equipe com a tela aberta".
- [ ] PRs (`gh pr create --base main`), CI verde, atualizar `CLAUDE.md`, `.konvex/acompanhamento.md`, `.konvex/roteiro.md`.
- [ ] Publicação (depois do merge, back e front juntos): backup do banco e dos anexos (migração 014), deploy, conferir login de um trainee.
