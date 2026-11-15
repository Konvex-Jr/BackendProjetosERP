# Biblioteca (sessão 17) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar Gestão (pastas/documentos), Base de Inteligência e Iniciativas por um módulo único, a Biblioteca, começando do zero.

**Architecture:** Backend em camadas como hoje (entidade → interface de repositório → repositório memória/banco → caso de uso → rota → `registro.ts`), com a regra de acesso em `source/shared/seguranca/regrasBiblioteca.ts`. Primeiro a Biblioteca entra ao lado dos módulos antigos (tarefas B1–B4); depois os antigos saem de uma vez (B5). No frontend, mesma ordem: página nova (F1–F2), depois remoção (F3).

**Tech Stack:** Node 20 + TypeScript + Express-like `Http` + PostgreSQL 18 + Jest (backend); React + Vite + `node --test` (frontend).

**Spec:** `docs/superpowers/specs/2026-11-14-biblioteca-design.md` (backend). Ler antes de cada tarefa.

## Global Constraints

- Branch `feat/biblioteca` nos dois repositórios (backend já criada; frontend: `git switch main && git pull --ff-only && git switch -c feat/biblioteca`).
- Commits em Conventional Commits, em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Não fazer push sem o usuário pedir.
- Sigilos: exatamente `todos` (padrão), `gestao`, `projeto`. `projeto` exige projeto.
- Título obrigatório, até 160 caracteres. Links só `http:`/`https:`. Tags normalizadas (minúsculas, sem `#`, sem repetição).
- Anexo: dono `biblioteca`, limite `LIMITE_ANEXO_BYTES` (20 MB) e `TIPOS_ANEXO` atuais.
- Permissões novas `biblioteca.verTodos` e `biblioteca.gerir`, só em diretor (todas) e gerente (`DO_GESTOR`). Membro: nenhuma.
- Item que a pessoa não pode ver responde **404**; sem permissão para alterar responde **403** (`ErroProibido`).
- Testes do backend: `npm test` (memória) e, para a migração, PostgreSQL na porta 5433, banco `konvex_teste` (ver "Testar nesta máquina" no `CLAUDE.md`).
- Anexos de capacitação não mudam.

## Review Focus

1. **Anexo de item invisível**: membro pede `GET /anexos/:codigo` de um anexo de item `gestao` → 404, não 403 nem o arquivo. Teste em B3.
2. **Membro troca o sigilo para escalar**: autor-membro faz `PUT` mudando `sigilo` para `gestao`, ou `projeto` de projeto alheio → 403, item inalterado. Teste em B3.
3. **Ex-participante**: membro que saiu da equipe lê o item `projeto`, edita o próprio item sem mudar sigilo/projeto (200), anexa arquivo e ainda pode criar item ligado ao projeto (participou basta). Teste em B1 (regra) e B3 (HTTP).
4. **Aba do projeto**: `GET /biblioteca?projeto=<código>` para membro devolve só os itens que ele vê (o `gestao` ligado ao projeto não aparece). Teste em B3.
5. **Excluir projeto**: itens `projeto` somem com anexos (arquivo apagado do armazenamento); itens `todos` ligados ficam com `projeto: null`. Teste em B4.

---

## Backend (`~/BackendProjetosERP`)

### Task B1: Entidade, sigilo, regra de acesso e permissões

**Files:**
- Create: `source/domain/enum/SigiloBiblioteca.ts`, `source/domain/entity/ItemBiblioteca.ts`, `source/shared/seguranca/regrasBiblioteca.ts`
- Modify: `source/shared/seguranca/catalogoPermissoes.ts` (só acrescentar; as antigas saem em B5), `source/shared/erros/mensagensDeErro.ts` (bloco `BIBLIOTECA`)
- Test: `test/regrasBiblioteca.test.ts`, `test/itemBiblioteca.test.ts`

**Interfaces:**
- Produces:
  - `enum SigiloBiblioteca { TODOS = "todos", GESTAO = "gestao", PROJETO = "projeto" }` e `ehSigiloBiblioteca(v: unknown): v is SigiloBiblioteca`.
  - `class ItemBiblioteca` com `readonly codigo, titulo, conteudo: string, links: string[], tags: string[], projeto: Referencia | null, sigilo: SigiloBiblioteca, autor: Referencia | null, criadoEm: Date, atualizadoEm: Date`; construtor `new ItemBiblioteca(dados: DadosItemBiblioteca)` que valida e normaliza (lança `ErroValidacao`). `Referencia` reaproveitada: mover `Referencia` e `normalizarTags`/validação de link de `Conhecimento.ts` para `source/domain/entity/Referencia.ts` e `source/shared/textos.ts` (ou equivalente), já que `Conhecimento.ts` sai em B5.
  - `Permissao.BIBLIOTECA_VER_TODOS = "biblioteca.verTodos"`, `Permissao.BIBLIOTECA_GERIR = "biblioteca.gerir"`.
  - Em `regrasBiblioteca.ts`:
    - `podeVerItem(usuario: UsuarioAutenticado, item: ItemBiblioteca, meusProjetos: ReadonlySet<string>): boolean`
    - `podeAlterarItem(usuario: UsuarioAutenticado | null | undefined, item: ItemBiblioteca): boolean` (autor ou `biblioteca.gerir`)
    - `projetosDoUsuario(usuario, factory): Promise<Set<string>>` (participa ou participou; conjunto vazio para quem tem `biblioteca.verTodos`, que nem consulta)
    - `exigirVerItem(usuario, item | null, factory): Promise<ItemBiblioteca>` (404 `"Item não encontrado."`)
    - `exigirAlterarItem(usuario, item): UsuarioAutenticado` (403)
    - `exigirPodeUsarSigiloEProjeto(usuario, sigilo: SigiloBiblioteca, codigoProjeto: string | null, factory): Promise<void>`: `gestao` exige `biblioteca.gerir`; projeto (qualquer sigilo) exige `biblioteca.gerir` ou participa/participou (403 caso contrário).

- [ ] **Step 1: Testes da entidade** (`test/itemBiblioteca.test.ts`): `"sem sigilo vira todos"`; `"sigilo projeto sem projeto lança ErroValidacao"`; `"título vazio ou com 161 caracteres lança"`; `"link ftp:// lança; https:// passa"`; `"tags ['Mercado','#delivery','mercado'] viram ['mercado','delivery']"`; `"sigilo desconhecido lança"`.
- [ ] **Step 2: Testes da regra** (`test/regrasBiblioteca.test.ts`, usando `criarContexto()` e um projeto com `ctx.membro`, outro com um terceiro, e um terceiro projeto em que `ctx.membro` tem `dataSaida` preenchida):
  - `podeVerItem`: gerente vê os três sigilos; membro vê `todos`, `projeto` do seu, `projeto` do que saiu; não vê `gestao` nem `projeto` alheio.
  - `podeAlterarItem`: autor-membro true; outro membro false; gerente true.
  - `exigirPodeUsarSigiloEProjeto`: membro + `gestao` → `ErroProibido`; membro + projeto alheio (qualquer sigilo) → `ErroProibido`; membro + projeto de que saiu → ok; gerente + qualquer → ok.
  - Catálogo: `permissoesDoPapel("MANAGER")` contém as duas novas; `permissoesDoPapel("MEMBER")` vazio.
- [ ] **Step 3:** `npx jest test/itemBiblioteca.test.ts test/regrasBiblioteca.test.ts` → FAIL (módulos não existem).
- [ ] **Step 4:** Implementar os arquivos acima. `projetosDoUsuario` usa `factory.criarProjetoRepository().listarPorMembro(codigo)` como `sigiloPastas.ts` hoje.
- [ ] **Step 5:** Rodar os dois testes → PASS; `npm test` inteiro → PASS (nada antigo quebrou).
- [ ] **Step 6:** Commit `feat(biblioteca): item, sigilo e regra de acesso`.

### Task B2: Repositório (memória e banco) e criação da tabela

**Files:**
- Create: `source/domain/interfaces/BibliotecaRepositoryInterface.ts`, `source/infra/repository/memory/BibliotecaRepositoryMemory.ts`, `source/infra/repository/database/BibliotecaRepositoryDatabase.ts`, `migrations/012_biblioteca.sql` (só a parte 1 da seção 5.6 da spec; as partes 2–4 entram em B5)
- Modify: `RepositoryFactoryInterface.ts`, `MemoryRepositoryFactory.ts`, `DatabaseRepositoryFactory.ts` (acrescentar `criarBibliotecaRepository()`)
- Test: `test/bibliotecaRepository.test.ts` (memória); `test/integracao/biblioteca.int.ts` (banco)

**Interfaces:**
- Consumes: `ItemBiblioteca`, `SigiloBiblioteca` (B1).
- Produces:
  ```ts
  export interface FiltrosBiblioteca { busca?: string; tag?: string; codigoProjeto?: string; sigilo?: SigiloBiblioteca; codigoAutor?: string }
  export default interface BibliotecaRepositoryInterface {
      criar(item: ItemBiblioteca): Promise<ItemBiblioteca>;
      /** Mais recentes primeiro (atualizado_em desc). Não filtra por visibilidade. */
      listar(filtros?: FiltrosBiblioteca): Promise<ItemBiblioteca[]>;
      buscarPorCodigo(codigo: string): Promise<ItemBiblioteca | null>;
      editar(item: ItemBiblioteca): Promise<ItemBiblioteca>;
      excluir(codigo: string): Promise<void>;
      /** Tira o projeto dos itens que não são de sigilo projeto (exclusão de projeto). */
      desligarProjeto(codigoProjeto: string): Promise<void>;
  }
  ```
  `busca` procura em título, conteúdo e tags, sem diferenciar maiúsculas (banco: `ILIKE` + `EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ILIKE ...)`).
- Tabela `biblioteca_itens`: `codigo UUID PK DEFAULT gen_random_uuid()`, `titulo VARCHAR(160) NOT NULL`, `conteudo TEXT NOT NULL DEFAULT ''`, `links TEXT[] NOT NULL DEFAULT '{}'`, `tags TEXT[] NOT NULL DEFAULT '{}'`, `projeto_codigo UUID REFERENCES projetos(codigo) ON DELETE SET NULL`, `sigilo TEXT NOT NULL DEFAULT 'todos'`, `autor_codigo UUID REFERENCES usuarios(codigo) ON DELETE SET NULL`, `criado_em`/`atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()`; constraints e índices da spec 5.6.1.

- [ ] **Step 1:** Testes de memória: `"lista do mais recente para o mais antigo"`, `"busca 'IFOOD' acha item com 'iFood' no conteúdo e item com tag 'ifood'"`, filtros `tag`, `codigoProjeto`, `sigilo`, `codigoAutor` combináveis, `"desligarProjeto zera projeto de todos/gestao e mantém o de sigilo projeto"`.
- [ ] **Step 2:** `npx jest test/bibliotecaRepository.test.ts` → FAIL.
- [ ] **Step 3:** Implementar interface, memória, banco, migração 012 (parte 1), factories.
- [ ] **Step 4:** `npx jest test/bibliotecaRepository.test.ts` → PASS. Integração: mesmos casos contra o banco em `test/integracao/biblioteca.int.ts`, seguindo `fase1.int.ts`; `npm run test:integracao` → PASS (e o `CHECK` recusa `sigilo='projeto'` sem projeto).
- [ ] **Step 5:** Commit `feat(biblioteca): repositório e tabela biblioteca_itens`.

### Task B3: Casos de uso, rota `/biblioteca` e anexos

**Files:**
- Create: `source/useCases/biblioteca/SalvarItemBiblioteca.ts`, `ListarItensBiblioteca.ts`, `ExcluirItemBiblioteca.ts`; `source/infra/http/routes/BibliotecaRoutes.ts`
- Modify: `source/modulos/registro.ts` (módulo Biblioteca: rotas + menu "Biblioteca" sem permissão, na posição da Base), `source/domain/enum/Anexo.ts` (`DonoAnexo.BIBLIOTECA = "biblioteca"`), `source/useCases/anexos/GerirAnexos.ts` (`acesso` para `BIBLIOTECA`), `source/infra/http/routes/AnexoRoutes.ts`, `source/infra/http/swagger.ts` (rotas novas)
- Test: `test/http/biblioteca.test.ts`

**Interfaces:**
- Consumes: B1, B2.
- Produces (API, consumida por F1):
  - Corpo de `POST /biblioteca` e `PUT /biblioteca/:codigo`: `{ titulo, conteudo?, links?: string[] | "a, b", tags?: string[] | "a, b", codigoProjeto?: string | null, sigilo?: "todos"|"gestao"|"projeto" }`.
  - Resposta de item: `{ codigo, titulo, conteudo, links, tags, projeto: {codigo,nome}|null, sigilo, autor: {codigo,nome}|null, criadoEm, atualizadoEm, podeAlterar: boolean, anexos: Anexo[] }` (anexos no formato que `GerirAnexos.porDono` já devolve para a Base).
  - `GET /biblioteca?q=&tag=&projeto=&sigilo=&autor=` → array de itens visíveis. `GET /biblioteca/:codigo` → item ou 404. `DELETE /biblioteca/:codigo` → 204, apaga anexos (arquivos inclusive). Anexos: `POST /biblioteca/:codigo/anexos` e o download/exclusão genéricos de `/anexos`.
  - `SalvarItemBiblioteca.criar(usuario, entrada): Promise<ItemBiblioteca>` e `.editar(usuario, codigo, entrada)`; em `editar`, `exigirPodeUsarSigiloEProjeto` só roda se `sigilo` ou `codigoProjeto` mudou.
  - `GerirAnexos.acesso` para `BIBLIOTECA`: lê com `exigirVerItem`; `podeAlterar = podeAlterarItem`.

- [ ] **Step 1:** Testes HTTP (`test/http/biblioteca.test.ts`, no padrão de `test/http/conhecimento.test.ts` com `subirServidor`; projetos `proj-meu` com `ctx.membro`, `proj-alheio` com Bruno, `proj-antigo` em que Ana saiu):
  - membro cria item só com título → 200, `sigilo: "todos"`, `autor` = Ana, `podeAlterar: true`.
  - membro cria com `sigilo: "gestao"` → 403; com `codigoProjeto: "proj-alheio"` → 403; com `proj-antigo` → 200.
  - gerente cria `gestao`; Bruno não vê na lista e `GET /biblioteca/:codigo` → 404.
  - **(Review 1)** anexo enviado pelo gerente em item `gestao`: Bruno pede o download → 404.
  - **(Review 2)** Ana (autora de item `todos`) faz `PUT` com `sigilo: "gestao"` → 403 e `GET` mostra `todos`; com `codigoProjeto: "proj-alheio"` → 403.
  - **(Review 3)** item `projeto` de `proj-antigo` criado por Ana: Ana lê, edita o título sem mudar sigilo → 200, e envia anexo → 200.
  - **(Review 4)** `GET /biblioteca?projeto=proj-meu` como Ana: inclui itens `todos` e `projeto` ligados ao `proj-meu`; não inclui item `gestao` ligado ao `proj-meu`.
  - outro membro edita item de Ana → 403; gerente edita → 200; Ana exclui → 204 e o anexo some do armazenamento.
  - busca `?q=ifood` e `?tag=delivery` filtram.
  - menu: o módulo Biblioteca aparece para membro (ver `test/permissoesModulos.test.ts`, acrescentar caso).
- [ ] **Step 2:** `npx jest test/http/biblioteca.test.ts` → FAIL (rota 404).
- [ ] **Step 3:** Implementar os casos de uso, a rota e as mudanças em anexos/registro/swagger.
- [ ] **Step 4:** `npx jest test/http/biblioteca.test.ts test/permissoesModulos.test.ts test/swaggerRoutes.test.ts` → PASS; `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(biblioteca): rotas, casos de uso e anexos`.

### Task B4: Exclusão de projeto

**Files:**
- Modify: `source/useCases/projetos/ExcluirProjeto.ts`
- Test: `test/excluirProjeto.test.ts`

**Interfaces:**
- Consumes: `BibliotecaRepositoryInterface.listar({ codigoProjeto })`, `.desligarProjeto`, `ExcluirItemBiblioteca` (B3).
- Produces: `ExcluirProjeto.execute(codigo)` sem dependência de pastas (a chamada a `ExcluirPasta` sai aqui).

- [ ] **Step 1:** **(Review 5)** Teste: projeto com item `projeto` (com anexo) e item `todos` ligados; após excluir o projeto, `buscarPorCodigo` do item `projeto` → null e o arquivo do anexo foi apagado do armazenamento em memória; o item `todos` existe com `projeto === null`. Remover do arquivo os casos de pastas.
- [ ] **Step 2:** `npx jest test/excluirProjeto.test.ts` → FAIL.
- [ ] **Step 3:** Implementar: para cada item `projeto` do projeto, `ExcluirItemBiblioteca`; depois `desligarProjeto`; depois tarefas e projeto, como hoje.
- [ ] **Step 4:** `npx jest test/excluirProjeto.test.ts` → PASS.
- [ ] **Step 5:** Commit `feat(biblioteca): excluir projeto leva os itens da equipe`.

### Task B5: Remover Gestão, Base e Iniciativas

**Files:**
- Modify: `migrations/012_biblioteca.sql` (partes 2–4 da spec 5.6), `source/domain/entity/Tarefa.ts`, `source/useCases/tarefas/CriarTarefa.ts`, `EditarTarefa.ts`, `EditarTarefaInput.ts`, `source/infra/http/routes/TarefaRoutes.ts`, `source/infra/repository/database/TarefaRepositoryDatabase.ts`, `source/domain/enum/Anexo.ts`, `GerirAnexos.ts`, `AnexoRoutes.ts`, `source/infra/arquivos/ArmazenamentoAnexosDisco.ts`, `source/infra/arquivos/conferenciaAnexos.ts` (`TABELA_DO_DONO = { biblioteca: "biblioteca_itens", capacitacao: "capacitacoes" }`), `source/scripts/conferirAnexos.ts` (flag `--apagar-sem-registro`), `swagger.ts`, `mensagensDeErro.ts`, as três factories, `registro.ts`, `catalogoPermissoes.ts` (tirar `DOCUMENTOS_*`, `CONHECIMENTO_GERIR`, `INICIATIVAS_GERIR`), `source/infra/database/migracoes.ts` se citar tabelas antigas
- Delete: tudo dos três módulos listado na spec 5.6.1 (entidades `Pasta`, `Documento`, `Conhecimento`, `Iniciativa`; enums `SigiloPasta`, `CategoriaConhecimento`, `Iniciativa`; interfaces, repositórios memória/banco, casos de uso `documentos/`, `conhecimento/`, `iniciativas/`; rotas `PastaRoutes`, `DocumentoRoutes`, `ConhecimentoRoutes`, `IniciativaRoutes`; `sigiloPastas.ts`, `regrasConhecimento.ts`, `regrasIniciativa.ts`) e os testes deles (`criarPasta`, `listarPastas`, `renomearPasta`, `excluirPasta`, `documentos`, `enviarDocumento`, `excluirDocumento`, `listarDocumentos`, `renomearDocumento`, `http/conhecimento`, `http/iniciativas`, `http/documentosSigilo`; e `criarPasta`/`criarDocumento` de `test/fixtures.ts`)
- Test: `test/conferenciaAnexos.test.ts`, `test/criarTarefa.test.ts`, `test/editarTarefa.test.ts`, `test/http/anexos.test.ts`, `test/http/seguranca.test.ts` (ajustar para o dono `biblioteca`)

**Interfaces:**
- Produces: `DonoAnexo = { BIBLIOTECA, CAPACITACAO }`; `npm run build && node dist/source/scripts/conferirAnexos.js --apagar-sem-registro` apaga do disco os arquivos em `semRegistro` e relata quantos; sem a flag, só relata (como hoje).

- [ ] **Step 1:** Testes: `conferenciaAnexos` com `TABELA_DO_DONO` novo; teste do script com a flag (função exportada `apagarSemRegistro(pasta, nomes): Promise<number>`, testada com pasta temporária); `POST /tarefas` com `iniciativa` no corpo ignora o campo (resposta sem `iniciativa`); `GET /pastas`, `/documentos`, `/conhecimento`, `/iniciativas` → 404.
- [ ] **Step 2:** Rodar esses testes → FAIL.
- [ ] **Step 3:** Apagar e ajustar os arquivos listados. Conferir com `grep -rniE "iniciativa|conhecimento|pasta|documento" source migrations/012_biblioteca.sql` que só sobram comentários históricos ou a migração.
- [ ] **Step 4:** `npm run build` (sem erro de tipo), `npm run lint`, `npm test` → PASS. Migração no banco de teste: aplicar 001–012 num `konvex_teste` limpo e conferir `\dt` (sem as 7 tabelas, com `biblioteca_itens`) e `\d anexos` (`CHECK` só `biblioteca`/`capacitacao`); `npm run test:integracao` → PASS.
- [ ] **Step 5:** Commit `refactor(biblioteca)!: remove Gestão, Base de Inteligência e Iniciativas` com corpo explicando que a migração 012 apaga os dados (decisão de 14/11).

### Task B6: Documentação da sessão

**Files:**
- Modify: `docs/sistema/06_documento_do_sistema.md` (seção 2: ordem do menu e um bloco "Biblioteca" no lugar dos três; Configurações: tirar a frase da área Inovação; Anexos: donos; seção 3: tabela "Biblioteca" no lugar das duas, com as linhas de 5.2–5.4 da spec e a perda da área Inovação; seção 4: registro curto da decisão de 14/11), `CLAUDE.md` ("Onde estamos": sessão 17 e o procedimento de publicação abaixo), `.konvex/acompanhamento.md`, `.konvex/roteiro.md`.

- [ ] **Step 1:** Escrever as mudanças. No "Onde estamos", registrar a ordem de publicação: **(1)** backup do banco (`pg_dump`) e da pasta de anexos; **(2)** deploy (a migração 012 roda); **(3)** `conferirAnexos --apagar-sem-registro`; **(4)** `conferirAnexos` sem flag deve sair com código 0.
- [ ] **Step 2:** Conferir que nenhum `.md` do repositório ainda manda o leitor para `/pastas`, `/conhecimento` ou `/iniciativas` como rota viva: `grep -rn "/pastas\|/conhecimento\|/iniciativas" docs CLAUDE.md README.md`.
- [ ] **Step 3:** Commit `docs(biblioteca): documento do sistema e acompanhamento da sessão 17`.

---

## Frontend (`~/FrontendProjetosERP`)

### Task F1: Serviço e mapeamento da Biblioteca

**Files:**
- Create: `src/services/biblioteca.js`
- Modify: `src/lib/apiMappers.js` (`itemBibliotecaDaApi`)
- Test: `test/biblioteca.test.js`, `test/apiRouteCoverage.test.js` (se ele lista rotas do backend, trocar as antigas por `/biblioteca`)

**Interfaces:**
- Consumes: API de B3.
- Produces: `biblioteca.listar(filtros?: {q, tag, projeto, sigilo, autor})`, `biblioteca.obter(codigo)`, `biblioteca.criar(dados)`, `biblioteca.editar(codigo, dados)`, `biblioteca.excluir(codigo)`, todos devolvendo itens já mapeados; `SIGILOS = [{valor:'todos', rotulo:'Todos'}, {valor:'gestao', rotulo:'Só gestão'}, {valor:'projeto', rotulo:'Equipe do projeto'}]`; `sigilosPermitidos(gestor: boolean)` (membro: `todos` e `projeto`).

- [ ] **Step 1:** Testes no padrão de `test/conhecimento.test.js`: monta a query só com filtros preenchidos; `criar` envia `codigoProjeto: null` quando sem projeto; mapeia `projeto`/`autor` nulos; `sigilosPermitidos(false)` não contém `gestao`.
- [ ] **Step 2:** `node --test test/biblioteca.test.js` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(biblioteca): serviço da API`.

### Task F2: Página Biblioteca, menu, rotas e aba do projeto

**Files:**
- Create: `src/pages/Biblioteca.jsx` (exporta default `Biblioteca` e `ItensDoProjeto({ projeto })`)
- Modify: `src/lib/utils.js` (`NAV`/`path`: entrada `biblioteca` no lugar de `conhecimento`), `src/App.jsx` (rota `/biblioteca`; `/gestao`, `/conhecimento`, `/iniciativas` com `<Navigate to="/biblioteca" replace />` **fora** do `<Layout>`), `src/pages/Projeto.jsx` (aba `['biblioteca', 'Biblioteca']`, importando `ItensDoProjeto` de `Biblioteca.jsx`), `src/components/Icon.jsx` (ícone da Biblioteca, se faltar)
- Test: `test/utils.test.js` (NAV contém `biblioteca` e não contém `conhecimento`, `iniciativas`, `gestao`)

**Interfaces:**
- Consumes: F1; componentes `Table`, `FormModal`, `Multi`, `Anexos`, `Markdown` existentes.
- Produces: tela com busca (texto), filtros (tag, projeto, sigilo), lista, ficha do item (Markdown, links, anexos, editar/excluir se `podeAlterar`), formulário (título, projeto, sigilo, texto, links, tags, arquivos). O formulário bloqueia salvar sem conteúdo, link ou arquivo escolhido (mensagem "Preencha um texto, um link ou escolha um arquivo."); com arquivo, cria o item e envia os anexos; se um envio falhar, mantém o item e avisa qual arquivo falhou. O seletor de projeto usa a lista de projetos que a pessoa já recebe; o de sigilo usa `sigilosPermitidos`.

- [ ] **Step 1:** Teste de `NAV` → FAIL.
- [ ] **Step 2:** Implementar página, menu, rotas e aba.
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build` → PASS.
- [ ] **Step 4:** Commit `feat(biblioteca): página, menu e aba do projeto`.

### Task F3: Remover telas e campos antigos

**Files:**
- Delete: `src/pages/Gestao.jsx`, `src/pages/Conhecimento.jsx`, `src/pages/Iniciativas.jsx`, `src/services/documentos.js`, `src/services/conhecimento.js`, `src/services/iniciativas.js`, `test/documentos.test.js`, `test/conhecimento.test.js`, `test/iniciativas.test.js`
- Modify: `src/components/TaskModal.jsx`, `src/pages/Tarefas.jsx` (formulário de avulsa sem iniciativa; sem `iniciativas.listar()`), `src/services/tarefas.js` (sem `iniciativaDa`), `src/lib/apiMappers.js`, `src/lib/utils.js`, `src/components/Icon.jsx`, `src/lib/useCarregar.js`, `src/components/Anexos.jsx`, `src/services/anexos.js` e `src/styles/components.css` onde citarem os módulos antigos
- Test: `test/tarefas.test.js`, `test/apiMappers.test.js`, `test/anexos.test.js`

- [ ] **Step 1:** Ajustar testes: tarefa mapeada não tem `iniciativa`; payload de tarefa avulsa não envia `iniciativa`; anexos usam dono `biblioteca`.
- [ ] **Step 2:** `npm test` → FAIL nos ajustados.
- [ ] **Step 3:** Apagar e ajustar. Conferir com `grep -rniE "iniciativa|conhecimento|pasta|documento" src` que nada vivo sobrou.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` → PASS.
- [ ] **Step 5:** Commit `refactor(biblioteca)!: remove Gestão, Base de Inteligência e Iniciativas`.

### Task F4: Conferência ponta a ponta

- [ ] **Step 1:** Subir a stack de dev do backend da branch (`npm run dev:docker`, portas 5434/5002) com a migração 012 aplicada e o frontend com `npm run dev`.
- [ ] **Step 2:** Com Playwright (reinstalar no scratchpad, ver `CLAUDE.md`), como membro e como gerente: menu mostra "Biblioteca" e não mostra Gestão, Base, Iniciativas; membro cria item com arquivo e sem texto; membro não vê opção "Só gestão"; gerente cria item "Só gestão" e o membro não o encontra; aba Biblioteca do projeto lista os itens; `/gestao` abre `/biblioteca`; formulário de tarefa avulsa sem campo de iniciativa. Rodar `npm run e2e` (`e2e/levantamento.mjs`) e corrigir o script se ele visitava as telas antigas.
- [ ] **Step 3:** Registrar o resultado no `.konvex/acompanhamento.md` (B6) e fazer commit se algo mudou.
