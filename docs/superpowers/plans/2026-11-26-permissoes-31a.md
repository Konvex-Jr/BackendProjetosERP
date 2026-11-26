# Sessão 31a: permissões por cargo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar o perfil fixo (diretor/gerente/membro) por permissões gravadas no cargo, editáveis numa grade com hierarquia, e abrir projetos pela equipe e pela área do cargo, sem projeto sigiloso.

**Architecture:** o catálogo de ações (`catalogoPermissoes.ts`) vira a fonte única de chaves, rótulos e grupos. O banco guarda as permissões de cada cargo e de dois conjuntos (`sem_cargo`, `trainee`). O `AuthExpress`, que já busca a pessoa a cada requisição, passa a buscar também as permissões efetivas, a posição e a área do cargo; `temPermissao` lê da pessoa. Hierarquia em funções puras (`hierarquia.ts`) usadas pela grade, pelos cargos e por Pessoas/períodos.

**Tech Stack:** Express + TypeScript + `pg` (backend, Jest), React 18 + Vite (frontend, `node:test`), Playwright (e2e, instalado à parte).

**Spec:** `docs/superpowers/specs/2026-11-26-permissoes-cargo-31a-design.md`

## Global Constraints

- Branch `feat/sessao-31` nos dois repositórios; um PR por repositório.
- Commits Conventional em português (`tipo(escopo): descrição`, até 72 caracteres, sem ponto); escopo `permissoes` (ou `projetos`, `pessoas`, `config`, `ui`, `db`). Rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; conferir que nenhum commit sai com rodapé "Sonnet".
- Antes de cada commit: `npm run lint && npm run format:check` **sem pipe** (os dois repos).
- Erros: entrada inválida = `ErroValidacao` 400 com o campo na mensagem; falta de direito = `ErroProibido` 403 com o porquê; conflito = `ErroConflito` 409. Mensagens em `mensagensDeErro.ts`.
- Posição: inteiro ≥ 1, menor = mais alto; posição 1 = presidente, exatamente um cargo, sempre com todas as permissões.
- Padrões da migração = comportamento de hoje (ninguém ganha nem perde nada além da seção 5.6 do spec).
- Regras de vínculo (autor, líder do projeto, responsável, equipe, instrutor, área no geral) não mudam.
- Repositório novo = interface + memória + banco + método nas duas factories.
- Telas novas responsivas (375 px), claro e escuro, visual Halo; responsivo só em `src/styles/responsive.css`.
- Mudou permissão: atualizar a seção 3 do `docs/sistema/06_documento_do_sistema.md` no mesmo PR.

## Review Focus

1. **Gerente mexendo no próprio nível:** gerente (posição 3) tenta alterar a coluna de outro gerente (posição 3) ou a própria → 403 "Você só altera cargos abaixo do seu." (teste na Task 4).
2. **Escalada por permissão:** gerente sem `clientes.ver` tenta ligar `clientes.ver` num cargo abaixo → 403 (Task 4).
3. **Escalada por cargo:** gerente dá a alguém um período com cargo de posição ≤ 3, ou edita pessoa cujo cargo é de posição ≤ 3 → 403 (Task 4).
4. **Trainee com cargo:** pessoa com status Trainee e período com cargo recebe o conjunto `trainee`, não o do cargo (Task 3).
5. **Troca de conta na mesma aba:** diretora entra, sai, gerente entra na mesma aba: menu, grade e `pode()` são os do gerente, sem resto da diretora (Task 11, e2e).

---

## Mapa de arquivos

Backend (`~/BackendProjetosERP`):
- `source/shared/seguranca/catalogoPermissoes.ts` — catálogo com metadados; sai `PERMISSOES_POR_PAPEL`.
- `source/shared/seguranca/hierarquia.ts` (novo) — regras puras de quem mexe em quê.
- `source/shared/seguranca/permissoes.ts` — `UsuarioAutenticado` sem `perfil`; `temPermissao` pela lista.
- `source/shared/seguranca/visibilidadeProjetos.ts` — `acessoAoProjeto` novo.
- `source/domain/entity/Cargo.ts`, `source/domain/interfaces/PermissoesRepositoryInterface.ts` (novo), `source/infra/repository/{memory,database}/PermissoesRepository*.ts` (novos), `CargoRepository*`.
- `source/useCases/config/GerirPermissoes.ts` (novo), `SalvarCargo.ts`, `source/useCases/pessoas/*`, `GerirPeriodosArea.ts`.
- `source/infra/http/middleware/AuthExpress.ts`, `Router.ts`, `routes/ConfiguracaoRoutes.ts`, `routes/UsuarioRoutes.ts`, `routes/ProjetoRoutes.ts`, `routes/TarefaRoutes.ts`, `modulos/registro.ts`.
- `migrations/030_permissoes_cargo.sql`; `test/integracao/migracao030.int.ts`.
- `source/scripts/seedAdmin.ts`, `scripts/dados-ficticios.mjs`, `docs/sistema/06_documento_do_sistema.md`, `docs/GUIA_DE_USO.md`, `docs/PUBLICACAO.md`.

Frontend (`~/FrontendProjetosERP`):
- `src/lib/permissoes.js` (novo) + `test/permissoes.test.js`.
- `src/components/GradePermissoes.jsx` (novo), `src/pages/Configuracoes.jsx`, `src/services/config.js` (ou o service de configurações existente).
- `src/pages/Pessoas.jsx`, `src/components/Layout.jsx`, `src/lib/apiMappers.js`, `src/lib/cadastroPessoa.js`.
- `src/pages/Projetos.jsx`, `src/pages/Projeto.jsx`, `src/pages/Perfil.jsx`, `src/lib/projetosInternos.js`, `src/lib/gravarProjeto.js`, `src/services/projetos.js`, `src/components/SeloProjeto.jsx`, `src/pages/Biblioteca.jsx`.
- `e2e/permissoes-31a.mjs` (novo), `e2e/visibilidade-27a.mjs` e `e2e/levantamento.mjs` ajustados.

---

### Task 1: Catálogo de permissões com metadados

**Files:**
- Modify: `source/shared/seguranca/catalogoPermissoes.ts`
- Test: `test/catalogoPermissoes.test.ts` (novo)

**Interfaces:**
- Produces:
  - `Permissao` (objeto `as const`) com exatamente estas chaves/valores:
    `PESSOAS_VER "pessoas.ver"`, `PESSOAS_GERIR "pessoas.gerir"`,
    `PROJETOS_VER "projetos.ver"`, `PROJETOS_ABRIR_DA_AREA "projetos.abrirDaArea"`, `PROJETOS_ABRIR_TODOS "projetos.abrirTodos"`, `PROJETOS_EDITAR "projetos.editar"`, `PROJETOS_EXCLUIR "projetos.excluir"`, `PROJETOS_LIDERAR "projetos.liderar"`, `CLIENTES_VER "clientes.ver"`,
    `TAREFAS_VER "tarefas.ver"`, `TAREFAS_GERIR_TODAS "tarefas.gerirTodas"`,
    `AGENDA_VER "agenda.ver"`, `AGENDA_GERIR_TODAS "agenda.gerirTodas"`, `REUNIOES_CRIAR "reunioes.criar"`,
    `CAPACITACOES_VER "capacitacoes.ver"`, `CAPACITACOES_GERIR "capacitacoes.gerir"`, `CAPACITACOES_PRESENCA "capacitacoes.presenca"`,
    `BIBLIOTECA_USAR "biblioteca.usar"`, `BIBLIOTECA_VER_TODOS "biblioteca.verTodos"`, `BIBLIOTECA_GERIR "biblioteca.gerir"`,
    `ESTRATEGIA_VER "estrategia.ver"`, `PRECIFICACAO_SIMULAR "precificacao.simular"`, `GESTAO_VISOES "gestao.visoes"`, `AREAS_LIDERAR_TODAS "areas.liderarTodas"`,
    `CONFIGURACOES_VER "configuracoes.ver"`, `CONFIG_ESTRUTURA "config.estrutura"` (áreas, cargos, senioridades, projeto geral), `CONFIG_DIFICULDADE "config.dificuldade"`, `CONFIG_PRECIFICACAO "config.precificacao"`, `PERMISSOES_GERIR "permissoes.gerir"`.
  - Saem: `PROJETOS_VER_TODOS`, `PROJETOS_VER_SIGILOSOS`, `PESSOAS_GERIR_DIRETORES`, `CONFIGURACOES_EDITAR`.
  - `interface InfoPermissao { chave: Permissao; rotulo: string; descricao: string; grupo: GrupoPermissao }`, `type GrupoPermissao = "Pessoas" | "Projetos" | "Tarefas" | "Agenda" | "Capacitações" | "Biblioteca" | "Gestão" | "Configurações"`.
  - `CATALOGO: readonly InfoPermissao[]` (uma entrada por chave, na ordem acima), `TODAS_AS_PERMISSOES: Permissao[]`, `ehPermissao(valor: unknown): valor is Permissao`.
  - `PADRAO_DIRETOR`, `PADRAO_GERENTE`, `PADRAO_MEMBRO`, `PADRAO_TRAINEE: readonly Permissao[]` (usados pela migração, pelos dados fictícios e pelos testes):
    - DIRETOR = todas.
    - GERENTE = todas, menos `projetos.abrirTodos`, `projetos.excluir`, `clientes.ver`, `areas.liderarTodas`, `configuracoes.ver`, `config.*`, `permissoes.gerir`.
    - MEMBRO = `projetos.ver`, `projetos.liderar`, `tarefas.ver`, `agenda.ver`, `reunioes.criar`, `capacitacoes.ver`, `biblioteca.usar`.
    - TRAINEE = MEMBRO sem `projetos.liderar` e sem `biblioteca.usar`.

- [ ] **Step 1: Teste que falha** — `test/catalogoPermissoes.test.ts`: cada chave de `Permissao` aparece uma vez em `CATALOGO` com rótulo e grupo não vazios; `ehPermissao("projetos.verTodos") === false`; `PADRAO_GERENTE` contém `projetos.abrirDaArea` e não contém `projetos.abrirTodos`; `PADRAO_TRAINEE` não contém `biblioteca.usar` nem `projetos.liderar`; todo padrão ⊂ `TODAS_AS_PERMISSOES`.
- [ ] **Step 2:** `npx jest test/catalogoPermissoes.test.ts` → FAIL (exports inexistentes).
- [ ] **Step 3:** Implementar no `catalogoPermissoes.ts`. Não remover ainda `PERMISSOES_POR_PAPEL`/`permissoesDoPapel` nem as chaves antigas usadas pelo resto do código: deixar as quatro antigas como aliases `@deprecated` para o build seguir verde até a Task 3 (que as apaga).
- [ ] **Step 4:** `npx jest test/catalogoPermissoes.test.ts` → PASS; `npm test` verde.
- [ ] **Step 5:** Commit `feat(permissoes): catálogo com rótulos, grupos e padrões`.

### Task 2: Migração 030

**Files:**
- Create: `migrations/030_permissoes_cargo.sql`, `test/integracao/migracao030.int.ts`

**Interfaces:**
- Consumes: os quatro `PADRAO_*` da Task 1 (copiados como listas literais no SQL; o teste de integração confere que o SQL e o TS batem).
- Produces (esquema):
  - `cargos.posicao SMALLINT NOT NULL CHECK (posicao >= 1)`; índice único parcial garantindo um só cargo com `posicao = 1`.
  - `cargo_permissoes (cargo_codigo UUID REFERENCES cargos ON DELETE CASCADE, permissao TEXT NOT NULL, PRIMARY KEY (cargo_codigo, permissao))`.
  - `conjunto_permissoes (conjunto TEXT NOT NULL CHECK (conjunto IN ('sem_cargo','trainee')), permissao TEXT NOT NULL, PRIMARY KEY (conjunto, permissao))`.
  - Sem `usuarios.perfil` (e sem o tipo dele), sem `projetos.sigiloso`.

Regras de carga (spec 5.6, com os ajustes do Claude):
1. Ocupante = período aberto (`periodos_area` com `data_fim IS NULL`) com cargo, de pessoa com status na EJ.
2. Perfil do cargo = o **mais baixo** entre os ocupantes (membro < gerente < diretor); sem ocupante = membro (ajuste do Claude ao spec 5.6, que dizia vazio: cargo novo sem nada ficaria abaixo do "Sem cargo").
3. `cargo_permissoes` = `PADRAO_<perfil do cargo>`. Posição = 2 (diretor), 3 (gerente), 4 (membro).
4. Cargo ativo com nome `ILIKE 'Presid%'` → posição 1 e todas as permissões. Se existir alguma pessoa com perfil `diretor` e (não houver exatamente um cargo assim **ou** ele não tiver ocupante), `RAISE EXCEPTION` com texto que diga o que acertar. Banco sem pessoas (teste, instalação nova) não falha.
5. `conjunto_permissoes`: `sem_cargo` = `PADRAO_MEMBRO`; `trainee` = `PADRAO_TRAINEE`.
6. Apaga `usuarios.perfil`, o tipo `perfil_usuario` (nome real a conferir nas migrações antigas) e `projetos.sigiloso`.

- [ ] **Step 1: Teste de integração que falha** (`migracao030.int.ts`, no molde de `migracao029.int.ts`): aplica até a 029, insere áreas, cargos "Presidente", "Diretor de projetos", "Gerente de projetos", "Gerente de inovação", "Assessor", pessoas com perfis (inclusive um cargo com ocupantes diretor+gerente), aplica a 030 e confere:
  - "Presidente" posição 1 com todas; "Diretor de projetos" posição 2 = `PADRAO_DIRETOR`; cargo misto posição 3 = `PADRAO_GERENTE`; "Assessor" sem ocupante posição 4 = `PADRAO_MEMBRO`.
  - `conjunto_permissoes` com os dois conjuntos.
  - colunas `usuarios.perfil` e `projetos.sigiloso` não existem.
  - segundo cenário: diretor existe e não há cargo "Presid%" → a migração falha com a mensagem; terceiro: "Presidente" sem ocupante → falha.
  - quarto: banco vazio → aplica sem erro.
- [ ] **Step 2:** `DATABASE_URL_TESTE=postgresql://postgres:postgres@localhost:5434/konvex_teste TZ=America/Sao_Paulo npx jest --runInBand --testMatch '**/test/integracao/migracao030.int.ts'` → FAIL.
- [ ] **Step 3:** Escrever a migração.
- [ ] **Step 4:** Mesmo comando → PASS. (O build ainda referencia `perfil`/`sigiloso`; só a integração desta migração roda aqui.)
- [ ] **Step 5:** Commit `db(permissoes): migração 030, permissões por cargo`.

### Task 3: Núcleo — permissões efetivas na requisição e fim do perfil

Uma task só (lição da 27a: mudar o tipo de uma regra central não fecha o build em partes).

**Files:**
- Modify: `Cargo.ts`, `CargoRepository{Interface,Memory,Database}.ts`, `permissoes.ts`, `catalogoPermissoes.ts` (apaga aliases e `PERMISSOES_POR_PAPEL`), `AuthExpress.ts`, `Router.ts`, `Usuario.ts`, `UsuarioRepository{Memory,Database}.ts`, `carregadores.ts`, `CriarUsuario*.ts`, `EditarUsuario*.ts`, `dadosPessoa.ts`, `UsuarioRoutes.ts`, `liderancaArea.ts`, `swagger.ts`, as duas factories.
- Create: `PermissoesRepositoryInterface.ts`, `PermissoesRepositoryMemory.ts`, `PermissoesRepositoryDatabase.ts`
- Test: `test/permissoesEfetivas.test.ts` (novo); ajustar `test/fixtures.ts` e os testes que montam pessoas com `perfil`.

**Interfaces:**
- Consumes: Task 1, esquema da Task 2.
- Produces:
  - `Cargo` ganha `readonly posicao: number` e `readonly permissoes: readonly Permissao[]`; construtor recebe-os (posição padrão 4, permissões padrão `PADRAO_MEMBRO`); valida posição inteira ≥ 1 e cada permissão com `ehPermissao` (400 `POSICAO_INVALIDA`, `PERMISSAO_INVALIDA`). `ehPresidente(): boolean` (`posicao === 1`); quando presidente, `permissoes` devolve `TODAS_AS_PERMISSOES`.
  - `PermissoesRepositoryInterface`: `conjunto(nome: "sem_cargo" | "trainee"): Promise<Permissao[]>`, `gravarConjunto(nome, permissoes: Permissao[]): Promise<void>`. O cargo grava as próprias permissões pelo `CargoRepository` (`criar`/`editar` gravam `cargo_permissoes` na mesma transação).
  - `UsuarioAutenticado` = `{ codigo: string; status?: StatusPessoa | string; permissoes: readonly Permissao[]; cargo: { codigo: string; nome: string; posicao: number; codigoArea: string } | null }`. Sai `perfil`.
  - `async function permissoesEfetivas(usuario: Usuario, f: RepositoryFactoryInterface): Promise<Pick<UsuarioAutenticado, "permissoes" | "cargo">>` em `source/shared/seguranca/permissoesEfetivas.ts`:
    - fora da EJ → `{ permissoes: [], cargo: null }`;
    - período aberto com cargo → `cargo` preenchido com a área desse período;
    - status Trainee → permissões do conjunto `trainee` (mesmo com cargo);
    - senão, com cargo → `cargo.permissoes`; sem cargo → conjunto `sem_cargo`.
  - `temPermissao(usuario, p)` = `usuario?.permissoes.includes(p)`.
  - `AuthExpress` monta `body.user = { ...usuario, ...(await permissoesEfetivas(usuario, f)) }`.
  - `GET /auth/permissoes` devolve `{ permissoes, cargo, modulos, menu }` (sem `perfil`).
  - `liderancaArea.ts`: troca `perfil === DIRETOR` por `temPermissao(usuario, AREAS_LIDERAR_TODAS)`.
  - Pessoa nova (`POST /usuarios`) não recebe mais `perfil`; `perfil` no corpo é ignorado. A regra "membro precisa de senioridade" (`Usuario.ts:211`) sai; senioridade fica opcional (a precificação já lida com ausência — conferir).

- [ ] **Step 1: Testes que falham** — `test/permissoesEfetivas.test.ts` (repositórios em memória):
  - pessoa sem período → permissões = conjunto `sem_cargo`, `cargo === null`;
  - período aberto com cargo "Gerente de inovação" (posição 3, área Inovação) → permissões do cargo e `cargo.codigoArea === <Inovação>`;
  - **Review Focus 4:** status Trainee com período com cargo → permissões = conjunto `trainee`;
  - status Inativo → `[]`;
  - cargo presidente com lista vazia gravada → `TODAS_AS_PERMISSOES`;
  - período encerrado não conta.
- [ ] **Step 2:** `npx jest test/permissoesEfetivas.test.ts` → FAIL.
- [ ] **Step 3:** Implementar tudo o que está em Produces; trocar todo `perfil` restante (`grep -rn "perfil\b\|PerfilUsuario" source` só pode sobrar o enum apagado e nenhum uso). Atualizar fixtures: helper `comPermissoes(usuario, permissoes, cargo?)` em `test/fixtures.ts` para os testes de unidade montarem o autenticado.
- [ ] **Step 4:** `npm run build && npm test` verdes; `npm run test:integracao` verde (`DATABASE_URL_TESTE` da 5434).
- [ ] **Step 5:** Commit `refactor(permissoes): permissões pelo cargo, sem perfil fixo`.

### Task 4: Hierarquia e API da grade

**Files:**
- Create: `source/shared/seguranca/hierarquia.ts`, `source/useCases/config/GerirPermissoes.ts`, `test/hierarquia.test.ts`, `test/gerirPermissoes.test.ts`
- Modify: `SalvarCargo.ts`, `ConfiguracaoRoutes.ts`, `GerirPeriodosArea.ts`, `UsuarioRoutes.ts` (troca `exigirPodeGerirPerfil`/`exigirPodeGerirPeriodosDe`), `permissoes.ts` (apaga `exigirPodeGerirPerfil`), `mensagensDeErro.ts`

**Interfaces:**
- Consumes: `UsuarioAutenticado.cargo`, `Cargo.posicao`, `PermissoesRepositoryInterface` (Task 3).
- Produces (`hierarquia.ts`, funções puras; `posicaoDe(u) = u.cargo?.posicao ?? Infinity`; conjuntos têm posição `Infinity`):
  - `estaAcima(quem: UsuarioAutenticado, posicaoAlvo: number): boolean` — `quem.cargo?.posicao === 1 || posicaoDe(quem) < posicaoAlvo`.
  - `exigirAlterarCargo(quem, cargo: Cargo): void` — 403 `MENSAGENS.HIERARQUIA.SO_ABAIXO` ("Você só altera cargos abaixo do seu.") se `!estaAcima(quem, cargo.posicao)`; o cargo presidente: 403 para todos (permissões fixas).
  - `exigirConceder(quem, antes: readonly Permissao[], depois: readonly Permissao[]): void` — cada permissão em `depois` que não estava em `antes` precisa estar em `quem.permissoes`, senão 403 `NAO_PODE_CONCEDER` com o nome da permissão (rótulo do catálogo).
  - `exigirPosicaoAbaixo(quem, posicao: number): void` — criar/mudar cargo para posição ≤ a de quem (exceto presidente) = 403; mudar para 1 = 403 para todos (400 `PRESIDENTE_UNICO` se já existe).
  - `exigirGerirPessoa(quem, alvo: { codigo: string; cargo: { posicao: number } | null }): void` — `pessoas.gerir` + alvo abaixo; o próprio cadastro pela gestão só se presidente.
  - `exigirDarCargo(quem, cargo: Cargo | null): void` — cargo nulo sempre ok; senão `estaAcima(quem, cargo.posicao)`.
- `GerirPermissoes`:
  - `grade(quem): Promise<{ catalogo: InfoPermissao[]; colunas: Array<{ chave: string /* código do cargo | "sem_cargo" | "trainee" */; nome: string; posicao: number | null; permissoes: Permissao[]; podeAlterar: boolean }> }>` — exige `permissoes.gerir`; cargos ativos por posição, depois "Sem cargo" e "Trainee".
  - `salvarColuna(quem, chave: string, permissoes: unknown): Promise<void>` — valida lista (400 `PERMISSAO_INVALIDA`), `exigirAlterarCargo` (conjuntos: `permissoes.gerir` basta), `exigirConceder`.
- Rotas: `GET /permissoes` e `PUT /permissoes/:chave` (`{ permissoes: string[] }`). Módulo `config` no `registro.ts`.
- `SalvarCargo`: aceita `posicao`; `exigirPosicaoAbaixo`; desativar cargo com ocupante = 409 `CARGO_COM_OCUPANTES`; cargo presidente não muda posição nem desativa (400 `PRESIDENTE_FIXO`).
- `GerirPeriodosArea`: `exigirGerirPessoa` + `exigirDarCargo` no cargo novo e no antigo; encerrar/alterar o último período aberto no cargo de posição 1 = 400 `PRESIDENTE_VAGO`; próprio período só o presidente (substitui `PERIODO.PROPRIO`).
- Respostas: `/usuarios` e `/usuarios/:codigo/perfil` devolvem `podeGerir` (boolean) por pessoa no lugar de `podeGerirPeriodos`, calculado com `exigirGerirPessoa` sem lançar.

- [ ] **Step 1: Testes que falham** — `test/hierarquia.test.ts`:
  - **Review Focus 1:** gerente (3) altera cargo de posição 3 → 403 `SO_ABAIXO`; altera posição 4 → ok; presidente altera posição 2 → ok; diretor (2) altera outro de posição 2 → 403.
  - **Review Focus 2:** gerente sem `clientes.ver` concede `clientes.ver` → 403 com "Vê dados do cliente e contratos" na mensagem; desligar uma que não tem → ok.
  - **Review Focus 3:** gerente dá cargo de posição 3 → 403; posição 4 → ok; gerente edita pessoa de posição 2 → 403; pessoa sem cargo → ok.
  - criar cargo com posição 3 por gerente → 403; posição 1 por qualquer um → 403.
  `test/gerirPermissoes.test.ts` (memória): grade do gerente marca `podeAlterar` só nas colunas abaixo; `salvarColuna` grava e a próxima `permissoesEfetivas` já reflete; chave inexistente → 404; encerrar o último período do presidente → 400 `PRESIDENTE_VAGO`.
- [ ] **Step 2:** `npx jest test/hierarquia.test.ts test/gerirPermissoes.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` verde; integração: um caso em `periodos.int.ts` com gerente tentando dar cargo de diretor pela rota (403) e um caso novo `test/integracao/permissoes.int.ts`: `PUT /permissoes/:cargo` pela rota e a chamada seguinte da pessoa afetada já muda (ex.: perde `estrategia.ver` → `GET /estrategia...` 403).
- [ ] **Step 5:** Commit `feat(permissoes): grade por cargo com hierarquia`.

### Task 5: Abrir projetos pela equipe e pela área; fim do sigilo

**Files:**
- Modify: `visibilidadeProjetos.ts`, `regrasTarefa.ts`, `regrasBiblioteca.ts`, `Projeto.ts`, `ProjetoRepository*`, `carregadores.ts`, `CriarProjeto*.ts`, `EditarProjeto*.ts`, `ListarProjetos.ts`, `cartaoProjeto.ts`, `carregarTarefa.ts`, `ObterPerfilPessoa.ts`, `ProjetoRoutes.ts`, `TarefaRoutes.ts`, `GerirAgenda.ts`, `ConsultarAvisos.ts`, `mensagensDeErro.ts`, `swagger.ts`
- Test: `test/acessoProjeto.test.ts` (reescrito), ajustes nos testes que usam `sigiloso`

**Interfaces:**
- Consumes: `UsuarioAutenticado.cargo.codigoArea`, `temPermissao`.
- Produces:
  - `ProjetoParaAcesso = { codigoArea: string | null; participacoes: {usuario:{codigo:string}; ativa:boolean}[]; lideresDaArea?: readonly string[]; geralDaArea?: boolean }`.
  - `acessoAoProjeto(u, p): "completo" | "cartao"` — completo se `geralDaArea` || participa ou participou || `lideresDaArea` inclui || `projetos.abrirTodos` || (`projetos.abrirDaArea` && `u.cargo?.codigoArea === p.codigoArea` && `p.codigoArea !== null`).
  - Saem: `podeVerTodosProjetos`, `exigirNaoSeTrancar`, `SIGILOSO_SEM_VOCE`, campo `sigiloso` (entidade, entrada, saída, swagger). `MENSAGENS.PROJETO.SEM_ACESSO` vira string.
  - Usos antigos de `projetos.verTodos`: `regrasTarefa` e `regrasBiblioteca` passam a usar só `acessoAoProjeto` (Biblioteca: `ctx.completos: Set<string>` no lugar de `ctx.meus`/`ocultos`); `TarefaRoutes` (lista) filtra por `acessoAoProjeto`; `GerirAgenda` (agenda de outros, editar reunião alheia) → `agenda.gerirTodas`; `ConsultarAvisos` (sobrecarga) e `ObterPerfilPessoa` (passagens anteriores) e ocupação de todos → `gestao.visoes`.
- [ ] **Step 1: Testes que falham** — `test/acessoProjeto.test.ts`: equipe atual → completo; ex-equipe → completo; `abrirDaArea` com área do cargo = Projetos: projeto de Projetos → completo, projeto de Inovação (subárea) → cartao, projeto sem área → cartao; `abrirTodos` → completo; geral → completo para quem não tem nada; trainee sem nada → cartao. Integração em `projetoGeral.int.ts`/`tarefas.int.ts`: gerente de inovação recebe 403 `PROJETO_SEM_ACESSO` em `GET /projetos/:projetosX/...` e 200 no de Inovação; tarefa de projeto só com cartão = 404.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm run build && npm test && npm run test:integracao` verdes; `grep -rn "sigiloso\|verTodos\|VER_TODOS" source` sem resultado (exceto `biblioteca.verTodos`).
- [ ] **Step 5:** Commit `feat(projetos): abrir pela equipe e pela área do cargo, sem sigilo`.

### Task 6: Regras fixas viram permissões

**Files:**
- Modify: `registro.ts` (menu por `<modulo>.ver`; sai `semTrainee`), `BibliotecaRoutes.ts`, `GerirAnexos.ts`, `CriarProjeto.ts`, `Equipe.ts`, `GerirAgenda.ts`, `GerirCapacitacoes.ts`, `regrasCapacitacao.ts`, `ConfiguracaoRoutes.ts`, `SalvarHorasDificuldade.ts`, `SalvarRegrasPrecificacao.ts`, `permissoes.ts` (apaga `ehTrainee`/`exigirNaoTrainee` se ficarem sem uso)
- Test: ajustes nos testes existentes de Biblioteca, projetos, agenda, capacitações, configurações; `test/registroModulos.test.ts` (ou o teste de menu existente)

**Interfaces:**
- Consumes: catálogo da Task 1.
- Produces (tabela 5.8 do spec):
  - Biblioteca e anexos da Biblioteca: `exigirPermissao(u, BIBLIOTECA_USAR, MENSAGENS.USUARIO.SEM_BIBLIOTECA)`.
  - Líder de projeto (`CriarProjeto`, troca de líder em `Equipe.ts`): o escolhido precisa de `projetos.liderar` nas permissões efetivas dele (400 `LIDER_SEM_PERMISSAO`, "Esta pessoa não pode liderar projetos."). Precisa calcular `permissoesEfetivas` do alvo.
  - Criar reunião: `reunioes.criar`.
  - Chamada de capacitação: gestão = `capacitacoes.presenca` (instrutor segue fixo); criar/editar/excluir = `capacitacoes.gerir`.
  - Configurações: áreas, cargos, senioridades e projeto geral = `config.estrutura`; `PUT /config/horas-dificuldade` = `config.dificuldade`; `PUT /config/precificacao` = `config.precificacao`.
  - Menu: cada item com `permissao: Permissao.<MODULO>_VER`; Dashboard e "Meu perfil" sem permissão. Pessoas = `pessoas.ver`; as ações de Pessoas seguem `pessoas.gerir`. As rotas de leitura de cada módulo exigem o `.ver` dele (ex.: `GET /tarefas` exige `tarefas.ver`), exceto as que o Dashboard e o perfil usam (`/auth/*`, `/avisos`, `/ocupacao` da própria pessoa, `/agenda` da própria pessoa).
- [ ] **Step 1: Testes que falham** — conjunto `trainee` sem `biblioteca.usar` → `GET /biblioteca` 403; trainee escolhido líder → 400 `LIDER_SEM_PERMISSAO`; pessoa sem `reunioes.criar` → 403; gerente com `capacitacoes.presenca` e sem `capacitacoes.gerir` faz chamada e não cria; menu de quem não tem `capacitacoes.ver` não traz Capacitações e `GET /capacitacoes` = 403; `config.dificuldade` sozinho grava dificuldade e não cria cargo.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run test:integracao` verdes.
- [ ] **Step 5:** Commit `feat(permissoes): regras fixas viram permissões da grade`.

### Task 7: Dados de dev, documentação e publicação

**Files:**
- Modify: `source/scripts/seedAdmin.ts`, `scripts/dados-ficticios.mjs`, `docs/sistema/06_documento_do_sistema.md` (seção 3), `docs/GUIA_DE_USO.md`, `docs/PUBLICACAO.md`, `.konvex/roteiro.md`

**Interfaces:**
- `seedAdmin`: garante área "Presidência" (ou a existente), cargo "Presidente" (posição 1) e período aberto do administrador nele.
- Dados fictícios: cargos "Presidente" (1), "Diretor de projetos" (2), "Gerente de projetos" (3, área Projetos), "Gerente de inovação" (3, área Inovação, `lideraArea`), "Assessor" (4); Inovação com área pai Projetos; pessoas: a diretora atual → Diretor de projetos; Bia → Gerente de projetos; nova "Ina Inovação" `ina@dev.konvex` → Gerente de inovação; projetos em Projetos e em Inovação; trainee `davi@` segue.
- `PUBLICACAO.md`, "Publicação da sessão 31a": consulta prévia só leitura (SQL) listando (a) pessoas cujo acesso cai — perfil maior que o mínimo do cargo, e diretores/gerentes sem período aberto com cargo; (b) cargos com ocupantes de perfis diferentes; (c) cargo que vira presidente e seu ocupante; (d) projetos de cliente sem área; depois backup, back e front juntos, `Migração aplicada: 030_permissoes_cargo.sql`, conferir a grade. Voltar = restaurar o `pg_dump`.
- [ ] **Step 1:** Escrever a consulta prévia e rodá-la no `konvex_dev` antes de migrar (deve listar os casos dos dados fictícios antigos).
- [ ] **Step 2:** Recriar o banco de dev, `npm run dev:docker` com `--force-recreate api`, `API_URL=http://localhost:5002 npm run dados:ficticios` → sem erro.
- [ ] **Step 3:** Atualizar doc 06 (catálogo completo com padrões, hierarquia, regra de abrir projeto), guia (aba Permissões, Posição) e roteiro.
- [ ] **Step 4:** `npm run lint && npm run format:check`.
- [ ] **Step 5:** Commit `docs(permissoes): guia, documento do sistema e publicação da 31a`.

### Task 8: Front — lib e grade de permissões

**Files:**
- Create: `src/lib/permissoes.js`, `test/permissoes.test.js`, `src/components/GradePermissoes.jsx`
- Modify: `src/pages/Configuracoes.jsx` (aba "Permissões" com `pode('permissoes.gerir')`; campo "Posição" em Cargos), service de configurações (`listarPermissoes()` → `GET /permissoes`, `salvarPermissoes(chave, permissoes)` → `PUT /permissoes/:chave`), `src/styles/components.css`, `src/styles/responsive.css`

**Interfaces:**
- Consumes: `GET /permissoes` (Task 4).
- Produces (`src/lib/permissoes.js`):
  - `linhasPorGrupo(catalogo) → Array<{ grupo: string; itens: InfoPermissao[] }>` na ordem do catálogo.
  - `alternar(permissoes: string[], chave: string) → string[]` (sem mutar).
  - `mudou(antes: string[], depois: string[]) → boolean` (ordem não importa).
- Tela: grade desktop (linhas = permissões por grupo com descrição; colunas = cargos + "Sem cargo" + "Trainee"; coluna sem `podeAlterar` só leitura; presidente tudo marcado e travado); botão "Salvar" por coluna habilitado só quando `mudou`; salvar com alguma permissão desligada pede `alerts.confirm`. 375 px: seletor de coluna + lista. Erro 403 mostra `error.message`.
- [ ] **Step 1:** Testes `node:test` de `linhasPorGrupo`, `alternar`, `mudou` → FAIL.
- [ ] **Step 2:** Implementar lib → PASS (`npm test`).
- [ ] **Step 3:** Implementar a tela.
- [ ] **Step 4:** `npm run lint && npm run format:check && npm test`.
- [ ] **Step 5:** Commit `feat(config): grade de permissões por cargo`.

### Task 9: Front — Pessoas sem perfil

**Files:**
- Modify: `src/pages/Pessoas.jsx`, `src/components/Layout.jsx`, `src/lib/apiMappers.js`, `src/lib/cadastroPessoa.js`, `src/context/AppContext.jsx`, `src/components/AreasPessoa.jsx`, testes de `cadastroPessoa`
- **Interfaces:** `GET /auth/permissoes` traz `cargo` (Task 3); `/usuarios` traz `podeGerir` (Task 4). Sai `PERFIS`, coluna "Perfil", campo perfil no convite e na edição, `gereDiretores`; editar/períodos só se `p.podeGerir`; topo mostra o nome do cargo (`acesso.cargo?.nome`) ou nada; o contexto guarda `cargo` junto do `me` (limpa na troca de pessoa).
- [ ] **Step 1:** Ajustar testes de `corpoEdicaoPessoa`/cadastro para não mandar `perfil` → FAIL.
- [ ] **Step 2:** Implementar → `npm test` verde.
- [ ] **Step 3:** Commit `feat(pessoas): tirar o perfil fixo das telas`.

### Task 10: Front — projetos sem sigilo e telas pela permissão

**Files:**
- Modify: `Projetos.jsx`, `Projeto.jsx`, `Perfil.jsx`, `SeloProjeto.jsx` (sai `SeloSigiloso`), `projetosInternos.js`, `gravarProjeto.js`, `services/projetos.js`, `apiMappers.js`, `Biblioteca.jsx` (`pode('biblioteca.usar')`), `Layout.jsx`/`rotas.js` (guarda por `<modulo>.ver`), `VisoesGestao.jsx` e botões Campinho/Alocação (`pode('gestao.visoes')`), `Agenda`/Dashboard (escolher pessoa: `pode('agenda.gerirTodas')`), `Capacitacoes.jsx` (`capacitacoes.gerir` / `capacitacoes.presenca`), testes afetados
- **Interfaces:** sem campo `sigiloso` na API (Task 5). Sai "Visibilidade", "Equipe inicial" condicionada ao sigilo (vira sempre opcional), `ErroAcessoParcial` se ficar sem uso, textos sobre sigilo; textos do cartão: "Os detalhes e as tarefas são da equipe e de quem tem acesso pelo cargo."
- [ ] **Step 1:** Ajustar testes de `projetosInternos`/`gravarProjeto` → FAIL.
- [ ] **Step 2:** Implementar → `npm test` verde; `grep -rn "sigilos\?o\|verTodos\|projetos.verSigilosos" src` vazio (exceto sigilo da Biblioteca).
- [ ] **Step 3:** Commit `feat(projetos): sem projeto sigiloso e telas pela permissão`.

### Task 11: e2e e levantamento

**Files:**
- Create: `e2e/permissoes-31a.mjs`
- Modify: `e2e/visibilidade-27a.mjs`, `e2e/levantamento.mjs`, outros e2e que usam perfil/sigilo

Passos do `permissoes-31a.mjs` (tudo pela tela, Vite em `--port 4173 --strictPort`, `API_URL=http://localhost:5002`, `APP_URL=http://localhost:4173`):
1. Diretora abre Configurações → Permissões; coluna "Diretor de projetos" só leitura; desliga `Relatórios` de "Gerente de projetos" e salva.
2. Sai (confirma), entra Bia (gerente de projetos) **na mesma aba**: menu sem Relatórios; Configurações → Permissões ausente (sem `permissoes.gerir`).
3. Bia abre projeto de Projetos (completo) e vê o de Inovação só como cartão.
4. Sai, entra Ina (gerente de inovação): abre o de Inovação, o de Projetos é cartão.
5. Diretora religa Relatórios; Bia volta a ver (Review Focus 5: nada da diretora sobra na aba).
6. Trainee `davi@`: sem Biblioteca no menu; não aparece como opção de líder no "Novo projeto".
7. 375 px escuro: aba Permissões no seletor de coluna.
- [ ] **Step 1:** Escrever e rodar `npm run e2e` do novo arquivo → passa.
- [ ] **Step 2:** Ajustar `visibilidade-27a.mjs` (sem sigilo) e rodar; rodar o levantamento com os papéis novos (diretora, Bia, Ina, membro, trainee) → sem problema.
- [ ] **Step 3:** Commit `test(permissoes): e2e da grade e do acesso pela área`.

---

## Depois das tasks

- Revisão final da branch nos dois repos, pedindo ao revisor: troca de conta na mesma aba; "dá para fazer pela tela?"; escalada de privilégio por cargo, por permissão e pelo próprio período; dado antigo (pessoa sem cargo, projeto sem área) não travando edição.
- PRs: `gh pr create --base main --title "feat(permissoes): sessão 31a, permissões por cargo (migração 030)" --body-file <arquivo>` nos dois.
- Fim de sessão: `CLAUDE.md` ("Onde estamos"), `.konvex/acompanhamento.md`, `.konvex/roteiro.md`.
