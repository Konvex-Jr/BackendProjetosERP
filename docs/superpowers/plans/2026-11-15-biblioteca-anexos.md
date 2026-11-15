# Sessão 19: Biblioteca e anexos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Busca sem acento, ver e baixar PDF/imagem rápido (antecipar, guardar na aba, envio em fluxo), itens da pessoa no perfil, clipe nas listas, ver PDF/imagem no navegador, vários arquivos com arrastar e soltar (Biblioteca, Capacitações, tarefas) e anexos nas tarefas.

**Architecture:** Backend: migração 013 (`unaccent` + dono `tarefa`), busca com `unaccent` no repositório, novo ramo `tarefa` em `GerirAnexos` com as regras de `regrasTarefa`, cascata na exclusão de tarefa e projeto, `quantidadeAnexos` nas respostas de tarefa. Frontend: `Anexos.jsx` ganha zona de envio múltiplo com arrastar e soltar e janela de visualização; seção de anexos no `TaskModal`; clipe na lista da Biblioteca e no Kanban; seção no perfil via `GET /biblioteca?autor=`.

**Tech Stack:** Backend Express + TypeScript + `pg` + Jest (`~/BackendProjetosERP`). Frontend React 18 (JS) + Bootstrap + Vite + `node --test` (`~/FrontendProjetosERP`). Branch `feat/biblioteca-anexos` nos dois.

**Spec:** `docs/superpowers/specs/2026-11-15-biblioteca-anexos-design.md` (backend). Ler antes de cada tarefa.

## Global Constraints

- Erro por entrada inválida responde 400 com mensagem que diz o campo; nunca 500. Mensagens novas em `source/shared/erros/mensagensDeErro.ts`.
- Quem não vê o dono do anexo recebe **404** (mesma resposta de inexistente) em enviar, listar, baixar e excluir.
- A API continua servindo arquivo com `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`. Não mudar `ExpressHttp.ts` nessa parte.
- Limite 20 MB e tipos aceitos não mudam (`TIPOS_ANEXO`).
- Visualização só para `pdf`, `png`, `jpg`, `jpeg`, `webp`, `gif`; o tipo do `Blob` vem da extensão, nunca da resposta.
- Toda rota nova entra no OpenAPI (`source/infra/http/swagger.ts`, conferido por `test/swaggerRoutes.test.ts`) e no `test/apiRouteCoverage.test.js` do frontend.
- Telas: responsivas (só `src/styles/responsive.css`), Halo, claro e escuro. Depois de anexar/excluir, recarregar pela `aoMudar`/`recarregar` (memória da sessão 18).
- Antes de cada commit: `npm run lint && npm run format:check` sem pipe; testes passando. Commits Conventional em português, escopos `anexos`, `biblioteca`, `tarefas`, `ui`, `db`.
- Integração: `DATABASE_URL_TESTE=postgresql://postgres:postgres@localhost:5434/konvex_teste TZ=America/Sao_Paulo npm run test:integracao` (stack de dev; ver `CLAUDE.md`).

## Review Focus

1. **Troca de conta na mesma aba** (lição da 18): a seção do perfil e os anexos da tarefa não podem mostrar o dado guardado da pessoa anterior. Teste em F4 (chave da memória inclui o código da pessoa vista; a memória já é por quem está logado).
2. **Ex-participante** de projeto vê a tarefa e baixa o anexo, mas não anexa (403) e só exclui o que ele mesmo enviou. Teste em B3.
3. **Lote com arquivo inválido no meio** (ex.: `.exe` entre dois PDFs, ou um de 21 MB): os válidos sobem, o alerta lista o que falhou. Teste em F1.
4. **Nome com acento, espaço ou `%`** no arquivo visualizado e baixado (`Relatório 50%.pdf`): o nome aparece igual na janela e no download. Teste em F1.
5. **Arquivo guardado depois de perder o acesso ou trocar de conta:** sai na troca, no logout, em 10 min e em 401/403/404. Teste em F6.
6. **Busca com `%`, `_` e acento juntos** (`"50%_reuniao"`): continua literal e ignora acento. Teste em B2.

---

## Backend

### Task B1: Migração 013 e dono `tarefa`

**Files:**
- Create: `migrations/013_anexos_tarefas_busca.sql`
- Modify: `source/domain/enum/Anexo.ts` (enum `DonoAnexo`), `source/infra/arquivos/conferenciaAnexos.ts` (`TABELA_DO_DONO`), comentário de `source/domain/entity/Anexo.ts`
- Test: `test/integracao/migracao013.int.ts`, `test/conferenciaAnexos.test.ts`

**Interfaces:**
- Produces: `DonoAnexo.TAREFA = "tarefa"`; `TABELA_DO_DONO.tarefa === "tarefas"`; extensão `unaccent` disponível.

- [ ] **Step 1: Testes que falham**
  - `migracao013.int.ts` (padrão do `migracao012.int.ts`: aplica até a 012, insere um anexo `biblioteca`, aplica todas): `SELECT unaccent('Reunião')` = `'Reuniao'`; `INSERT` de anexo com `dono_tipo = 'tarefa'` funciona; `dono_tipo = 'documento'` falha com violação de `anexos_dono_valido`; o anexo `biblioteca` anterior continua lá.
  - `conferenciaAnexos.test.ts`: registro `{ donoTipo: "tarefa", donoCodigo: "t1" }` com `donosExistentes` contendo `"tarefa:t1"` não entra em `semDono`; `TABELA_DO_DONO.tarefa` é `"tarefas"`.
- [ ] **Step 2:** Rodar `npm test -- conferenciaAnexos` e a integração: FAIL.
- [ ] **Step 3:** Migração (cabeçalho com sessão, data, aviso de backup e a reversão do spec):
  ```sql
  CREATE EXTENSION IF NOT EXISTS unaccent;
  ALTER TABLE anexos DROP CONSTRAINT IF EXISTS anexos_dono_valido;
  ALTER TABLE anexos ADD CONSTRAINT anexos_dono_valido CHECK (dono_tipo IN ('biblioteca', 'capacitacao', 'tarefa'));
  ```
  Acrescentar `TAREFA = "tarefa"` ao enum e `tarefa: "tarefas"` ao mapa.
- [ ] **Step 4:** Testes e integração: PASS.
- [ ] **Step 5:** `git commit -m "db(anexos): migração 013 com unaccent e anexos de tarefa"`

### Task B2: Busca da Biblioteca sem acento

**Files:**
- Modify: `source/infra/repository/database/BibliotecaRepositoryDatabase.ts:63-66`, `source/infra/repository/memory/BibliotecaRepositoryMemory.ts:6-11`
- Create: `source/shared/textos.ts` (se ainda não houver utilitário equivalente: `grep -rn "normalize(\"NFD\")" source`)
- Test: `test/bibliotecaRepository.test.ts`, `test/integracao/biblioteca.int.ts`

**Interfaces:**
- Produces: `semAcento(texto: string): string` em `source/shared/textos.ts` (`normalize("NFD")` + remover `\p{M}` + `toLowerCase()`).

- [ ] **Step 1: Testes que falham** (memória e integração, mesmos casos):
  - item "Reunião de alinhamento": busca `"reuniao"` acha; `"REUNIÃO"` acha; `"reuníão"` acha.
  - item com texto "Ação comercial" e tag `"inovação"`: `"acao"` acha pelo texto; `"inovacao"` acha pela tag.
  - item "Meta 50%_final": `"50%_"` acha; `"50x"` não acha; `"%"` sozinho só acha itens com `%` (escape mantido).
  - filtro `tag: "inovacao"` (sem acento) **não** acha a tag `"inovação"` (filtro exato, decisão do spec).
- [ ] **Step 2:** `npm test -- bibliotecaRepository`: FAIL.
- [ ] **Step 3:** SQL: `unaccent(b.titulo) ILIKE unaccent(${p})`, idem `b.conteudo` e `unaccent(t)`; manter `literal()`. Memória: comparar `semAcento(texto).includes(semAcento(busca))`; atualizar o comentário da função `atende`.
- [ ] **Step 4:** Testes e integração: PASS.
- [ ] **Step 5:** `git commit -m "feat(biblioteca): busca sem diferenciar acentos"`

### Task B3: Anexos nas tarefas (regras e rotas)

**Files:**
- Create: `source/useCases/tarefas/carregarTarefa.ts`
- Modify: `source/infra/http/routes/TarefaRoutes.ts:33-41` (usar `carregarTarefa`, mesmo comportamento), `source/useCases/anexos/GerirAnexos.ts`, `source/infra/http/routes/AnexoRoutes.ts`, `source/shared/erros/mensagensDeErro.ts`, `source/infra/http/swagger.ts`
- Test: `test/http/anexosTarefas.test.ts`

**Interfaces:**
- Produces:
  - `carregarTarefa(factory: RepositoryFactoryInterface, usuario: UsuarioAutenticado, codigo: string): Promise<{ tarefa: Tarefa; projeto: Projeto | null; regras: RegrasTarefa }>`; lança `ErroNaoEncontrado` se a tarefa não existe. **Não** lança por falta de `ver` (cada chamador decide: `TarefaRoutes` mantém 404 só para avulsa; `GerirAnexos` dá 404 sempre que `!regras.ver`).
  - `POST /tarefas/:codigo/anexos` → `Anexo` (JSON de hoje).
  - `GET /tarefas/:codigo/anexos` → `Array<AnexoJSON & { podeExcluir: boolean }>`, do mais antigo ao mais novo.
  - `GerirAnexos.listar(usuario, tipo: DonoAnexo.TAREFA, codigoDono): Promise<Array<...& { podeExcluir }>>`.
- Regras no ramo `TAREFA` de `GerirAnexos.acesso`: ver = `regras.ver` (senão 404); anexar = `regras.comentar` (senão 403); excluir = `anexo.enviadoPor?.codigo === usuario.codigo || regras.organizar` (senão 403). Biblioteca e capacitação inalteradas.
- Mensagens 403: projeto `"Só a equipe atual do projeto anexa arquivos nas tarefas."`; avulsa `"Só os responsáveis e a gestão anexam arquivos nesta tarefa."`; excluir `"Você só pode excluir os arquivos que enviou."`.

- [ ] **Step 1: Testes que falham** (`anexosTarefas.test.ts`, padrão de `test/http/anexos.test.ts` e `liderComentarios.test.ts`):
  - participante da equipe anexa PDF à tarefa do projeto (200) e `GET /tarefas/:c/anexos` traz o arquivo com `podeExcluir: true` para ele;
  - outro participante vê `podeExcluir: false` e `DELETE /anexos/:a` dá 403; líder e gestão excluem (200);
  - **ex-participante** (com `dataSaida`): lista e baixa (200), `POST` 403, exclui o que **ele** enviou antes de sair (200);
  - membro sem relação com o projeto: `POST`, `GET` lista, `GET /anexos/:a`, `DELETE` → 404;
  - avulsa: responsável anexa (200); gestão anexa e exclui; outro membro → 404 nas quatro rotas;
  - tarefa inexistente ou UUID mal formado → 404 (não 500);
  - `GET /anexos/:a` de anexo de tarefa devolve `Content-Disposition: attachment` e o nome original;
  - comentários de tarefa de projeto que a pessoa não vê continuam **403** (regressão);
  - biblioteca: quem enviou mas não pode alterar o item continua **sem** poder excluir (403) (regra só da tarefa).
- [ ] **Step 2:** `npm test -- anexosTarefas`: FAIL.
- [ ] **Step 3:** Implementar `carregarTarefa`, trocar `TarefaRoutes.carregar` para usá-la, ramo `TAREFA` em `GerirAnexos` (o `acesso` passa a receber o anexo opcional para decidir a exclusão), `listar`, rotas em `AnexoRoutes` com `RECEBE_ARQUIVO`, entradas no swagger.
- [ ] **Step 4:** `npm test` inteiro (inclui `swaggerRoutes` e os de tarefa/comentário): PASS.
- [ ] **Step 5:** `git commit -m "feat(anexos): anexos nas tarefas com as regras dos comentários"`

### Task B4: Cascata e `quantidadeAnexos`

**Files:**
- Modify: `source/domain/interfaces/AnexoRepositoryInterface.ts`, `source/infra/repository/memory/AnexoRepositoryMemory.ts`, `source/infra/repository/database/AnexoRepositoryDatabase.ts`, `source/useCases/tarefas/ExcluirTarefa.ts`, `source/useCases/projetos/ExcluirProjeto.ts`, `source/infra/http/routes/TarefaRoutes.ts` (GET lista, POST, PUT, PATCH status)
- Test: `test/excluirTarefa.test.ts`, `test/excluirProjeto.test.ts`, `test/http/anexosTarefas.test.ts`, `test/integracao/fase1.int.ts` (ou novo `anexos.int.ts`) para `contarPorDonos` no PostgreSQL

**Interfaces:**
- Consumes: `GerirAnexos.excluirDosDonos(DonoAnexo.TAREFA, codigos)` (existente).
- Produces: `AnexoRepositoryInterface.contarPorDonos(tipo: DonoAnexo, codigos: string[]): Promise<Map<string, number>>` (uma consulta `GROUP BY dono_codigo`; lista vazia → mapa vazio sem consultar); campo `quantidadeAnexos: number` em cada tarefa das respostas de `GET /tarefas`, `POST /tarefas`, `PUT /tarefas/:c`, `PATCH /tarefas/:c/status`.

- [ ] **Step 1: Testes que falham**
  - excluir tarefa com 2 anexos: registros somem e `armazenamento.ler(arquivo)` devolve nulo;
  - excluir projeto com 2 tarefas com anexos: idem para todos;
  - `GET /tarefas` traz `quantidadeAnexos: 2` na tarefa com anexos e `0` nas outras; `PATCH` status devolve o campo;
  - `contarPorDonos` no PostgreSQL com 3 donos (2, 1, 0 anexos).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar; `ExcluirTarefa` e `ExcluirProjeto` apagam os anexos antes de apagar as tarefas (`ExcluirProjeto`: listar as tarefas do projeto para ter os códigos). A contagem em `TarefaRoutes` num helper privado `comAnexos(tarefas)` que devolve `{ ...t.toJSON(), quantidadeAnexos }`.
- [ ] **Step 4:** `npm test` e integração: PASS.
- [ ] **Step 5:** `git commit -m "feat(tarefas): apagar anexos com a tarefa e contar anexos na lista"`

### Task B6: Download em fluxo

**Files:**
- Modify: `source/domain/interfaces/ArmazenamentoAnexosInterface.ts`, `source/infra/arquivos/ArmazenamentoAnexosDisco.ts`, `source/infra/arquivos/ArmazenamentoAnexosMemoria.ts`, `source/infra/http/RespostaArquivo.ts`, `source/infra/http/ExpressHttp.ts:132-142`, `source/useCases/anexos/GerirAnexos.ts` (`baixar`)
- Test: `test/http/anexos.test.ts`

**Interfaces:**
- Produces: `ArmazenamentoAnexosInterface.abrir(arquivo: string): Promise<{ fluxo: NodeJS.ReadableStream; tamanho: number } | null>` (disco: `fs.stat` + `createReadStream`; memória: `Readable.from(buffer)`); `RespostaArquivo(nome, tipoMime, conteudo: Buffer | NodeJS.ReadableStream, tamanho: number)`; `GerirAnexos.baixar` devolve `{ anexo, fluxo, tamanho }`. `ler()` continua para o `conferirAnexos`.
- `ExpressHttp`: mesmos cabeçalhos de hoje (incluir `Content-Length = tamanho`); envia com `stream.pipeline(fluxo, res, ...)`; erro depois de começar → `res.destroy(erro)`, sem JSON.

- [ ] **Step 1: Testes que falham:** baixar PDF de 3 MB devolve os mesmos bytes, `Content-Length: 3145728`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`; arquivo que sumiu do disco continua 404 com JSON (antes de começar a enviar).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `npm test` inteiro PASS.
- [ ] **Step 5:** `git commit -m "perf(anexos): enviar o arquivo enquanto lê o disco"`

### Task B5: Dados fictícios e documentação

**Files:**
- Modify: `scripts/dados-ficticios.mjs` (um item da Biblioteca com acento no título e um anexo PDF; um anexo numa tarefa), `docs/sistema/06_documento_do_sistema.md` (seção 3: linhas "anexar/ver/excluir arquivo na tarefa" por papel, apontando para `regrasTarefa.ts` e `GerirAnexos.ts`), `docs/GUIA_DE_USO.md` (anexos na tarefa, ver PDF/imagem, arrastar vários arquivos na Biblioteca e Capacitações, itens no perfil, busca sem acento)

- [ ] **Step 1:** `npm run dados:ficticios` na stack de dev roda sem erro e é idempotente (rodar 2 vezes).
- [ ] **Step 2:** `npm run lint && npm run format:check` (lint também lê `.konvex/`).
- [ ] **Step 3:** `git commit -m "docs(anexos): regras de anexo na tarefa, guia de uso e dados fictícios"`

---

## Frontend

### Task F1: Serviços de anexo

**Files:**
- Modify: `src/services/anexos.js`, `src/services/biblioteca.js` (remover `enviarArquivos`, usar `enviarVarios`), `src/services/tarefas.js`, `src/lib/apiMappers.js` (mapper de tarefa: `quantidadeAnexos`)
- Test: `test/anexos.test.js`, `test/biblioteca.test.js`, `test/tarefas.test.js`, `test/apiRouteCoverage.test.js`

**Interfaces:**
- Produces (em `src/services/anexos.js`):
  - `VISUALIZAVEIS: Record<string, string>` = `{ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }`
  - `podeVer(nome: string): boolean`
  - `enviarVarios(dono: string, codigo: string, arquivos: File[], enviar = anexos.enviar): Promise<{ enviados: number, falhas: Array<{ nome: string, erro: string }> }>` — confere com `conferirArquivo` antes (falha local entra em `falhas` sem chamar a API); um por vez; não para no primeiro erro.
  - `anexos.abrir(anexo): Promise<{ url: string, tipo: string }>` — `baixar(...)` → `new Blob([blob], { type: VISUALIZAVEIS[extensao(nome)] })` → `URL.createObjectURL`; rejeita se `!podeVer(nome)`.
  - `adaptAnexo` passa a levar `podeExcluir` (default `undefined`) e `ext`.
- Em `tarefas`: `anexos: codigo => get('/tarefas/${codigo}/anexos')`. `dono` para tarefa = `'tarefas'`.

- [ ] **Step 1: Testes que falham**
  - `enviarVarios` com `[a.pdf, b.exe, c.pdf(21 MB), d.pdf]` e `enviar` falso que rejeita `d.pdf`: `enviar` chamado 2 vezes (a, d), `enviados: 1`, `falhas` com os nomes `b.exe`, `c.pdf`, `d.pdf` e mensagens;
  - `podeVer('Relatório 50%.PDF')` true; `podeVer('a.svg')`, `podeVer('a.docx')` false;
  - `anexos.abrir` com resposta `text/html` de um `x.pdf` cria Blob `application/pdf`;
  - rota `GET /tarefas/task-1/anexos` e `POST /tarefas/task-1/anexos` no `apiRouteCoverage`;
  - mapper de tarefa: `quantidadeAnexos` ausente vira `0`.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test`: PASS.
- [ ] **Step 5:** `git commit -m "feat(anexos): envio de vários arquivos e abertura de PDF e imagem"`

### Task F2: Componentes de envio e visualização

**Files:**
- Modify: `src/components/Anexos.jsx`, `src/components/FormModal.jsx` (campo `t: 'file'` usa a zona de arrastar), `src/components/Icon.jsx` (ícone `clip`, se não houver), `src/styles/components.css`, `src/styles/responsive.css`

**Interfaces:**
- Consumes: F1.
- Produces:
  - `ZonaEnvio({ aoEscolher(arquivos: File[]), multiple = true, rotulo = 'Anexar arquivos', ocupado })` — botão (teclado) + área que aceita soltar; classe `is-over` ao arrastar por cima; mostra "Enviando 2 de 5…" quando `ocupado = { atual, total }`.
  - `JanelaAnexo({ anexo, fechar })` — modal Halo: `<img>` para imagem, `<iframe title={nome}>` para PDF; botões "Baixar" e "Fechar"; Esc fecha; revoga o URL ao desmontar.
  - `Anexos({ dono, codigo, lista, podeAlterar, aoMudar })` — clique no nome: `podeVer` → `JanelaAnexo`, senão baixa; no celular (`matchMedia('(max-width: 575.98px)')`) PDF baixa direto, imagem abre na janela; exclusão por anexo usa `a.podeExcluir ?? podeAlterar`; envio por `ZonaEnvio` + `enviarVarios`; ao fim: `toastSuccess('N arquivos enviados')` e, se houver falhas, `alerts.error('Alguns arquivos não foram enviados', lista nome: erro)`.
  - `BotaoAnexar` sai (procurar usos: `grep -rn BotaoAnexar src`).

- [ ] **Step 1:** Testes de lógica pura que couberem em `test/anexos.test.js` (ex.: texto do progresso, decisão ver/baixar por nome e largura: `acaoAoAbrir(nome, celular): 'janela' | 'baixar'`). FAIL → implementar → PASS.
- [ ] **Step 2:** Manual no navegador (stack de dev): Biblioteca e Capacitações, claro e escuro, 1366 e 375 px — arrastar 3 arquivos (1 inválido), abrir PDF e PNG, Esc, baixar.
- [ ] **Step 3:** `npm run lint && npm run format:check && npm test`.
- [ ] **Step 4:** `git commit -m "feat(ui): arrastar vários arquivos e ver PDF e imagens"`

### Task F3: Anexos na tarefa e clipe no Kanban

**Files:**
- Modify: `src/components/TaskModal.jsx` (seção `AnexosTarefa` acima de `<Comentarios>`, só com `t.id`), `src/components/KanbanTarefas.jsx` (indicador `bd` com clipe e número quando `t.quantidadeAnexos > 0`; `title`/`aria-label` "1 arquivo"/"N arquivos"), página que recarrega a lista depois de mudar anexo (`aoMudar` do modal chama o recarregar da tela)

**Interfaces:**
- Consumes: `tarefas.anexos`, `Anexos` (F2) com `dono="tarefas"`, `podeAlterar={papel.participa}` e `podeExcluir` vindo da API por anexo.

- [ ] **Step 1:** Teste puro em `test/tarefas.test.js`: `rotuloArquivos(1) === '1 arquivo'`, `rotuloArquivos(3) === '3 arquivos'`. FAIL → implementar em `src/services/tarefas.js` → PASS.
- [ ] **Step 2:** Manual: como membro da equipe anexa; como ex-participante não vê a zona de envio; avulsa como responsável; clipe aparece no Kanban e some ao excluir o último arquivo; 375 px.
- [ ] **Step 3:** Lint, format, testes.
- [ ] **Step 4:** `git commit -m "feat(tarefas): anexos na tarefa e clipe no Kanban"`

### Task F4: Clipe na Biblioteca e itens no perfil

**Files:**
- Modify: `src/pages/Biblioteca.jsx` (`TituloItem`: clipe com número se `x.anexos.length > 0`, mesmo rótulo de F3), `src/pages/Perfil.jsx` (seção "Itens na Biblioteca"), `src/services/biblioteca.js` (exportar `rotuloArquivos` de `tarefas.js` ou mover para `src/lib/utils.js`)

**Interfaces:**
- Seção do perfil: `useCarregar(() => biblioteca.listar({ autor: codigo }), [codigo], { chave: 'biblioteca:autor:' + codigo })` — a chave usa o **código** da pessoa vista, nunca `'eu'`. Lista: título (link para a ficha), tags, clipe, data; vazia: "Nenhum item na Biblioteca." em `<small>`.

- [ ] **Step 1:** Teste em `test/biblioteca.test.js`: o `consulta({ autor: 'u1' })` gera `?autor=u1` (se ainda não coberto) e a chave do perfil para `me = 'u1'` em `/perfil` é igual à de `/perfil/u1`.
- [ ] **Step 2:** Manual: perfil próprio e de outra pessoa; item com sigilo "só gestão" do autor não aparece para membro; trocar de conta na mesma aba (A abre perfil de C, Sair, B abre perfil de C) e conferir que B só vê o que pode.
- [ ] **Step 3:** Lint, format, testes.
- [ ] **Step 4:** `git commit -m "feat(biblioteca): clipe nas listas e itens da pessoa no perfil"`

### Task F6: Ver e baixar rápido (antecipar, guardar, progresso)

**Files:**
- Create: `src/lib/memoriaArquivos.js`
- Modify: `src/services/api.js` (`baixar(path, { aoProgresso } = {})`), `src/services/anexos.js` (`anexos.abrir`/`anexos.baixar` usam a memória; `anexos.antecipar`), `src/components/Anexos.jsx` (antecipar em `onPointerEnter`, `onFocus`, `onTouchStart`; barra de progresso), `src/lib/auth*`/onde o logout chama `memoria.definirPessoa` (limpar também a memória de arquivos)
- Test: `test/memoriaArquivos.test.js`, `test/anexos.test.js`, `test/api.test.js`

**Interfaces:**
- Produces (`src/lib/memoriaArquivos.js`):
  - `memoriaArquivos.obter(codigo: string): Blob | undefined` — `undefined` se passou de 10 min ou se a pessoa mudou (`memoria.pessoa()` diferente da que guardou).
  - `memoriaArquivos.buscar(codigo: string, carregar: () => Promise<Blob>): Promise<Blob>` — reaproveita busca em andamento; grava só se a pessoa ainda for a mesma ao terminar; erro com `status` 401/403/404 apaga a chave.
  - `memoriaArquivos.apagar(codigo)`, `memoriaArquivos.limpar()`; limite total `LIMITE_BYTES = 50 * 1024 * 1024` (sai o usado há mais tempo); `VALIDADE_MS = 10 * 60 * 1000`.
  - `anexos.antecipar(anexo)`: só se `podeVer(nome)` e `tamanhoBytes <= 5 * 1024 * 1024`; erros ignorados em silêncio.
  - `baixar(path, { aoProgresso(recebidos, total|null) })`: lê `response.body` em pedaços quando houver `aoProgresso`.
- Exclusão de anexo (`anexos.excluir`) chama `memoriaArquivos.apagar(codigo)`.

- [ ] **Step 1: Testes que falham** (`node --test`, relógio falso):
  - segunda `buscar` da mesma chave em andamento não chama `carregar` de novo;
  - após 10 min `obter` devolve `undefined`;
  - 3 blobs de 20 MB: o mais antigo sai, total ≤ 50 MB;
  - `definirPessoa('B')` depois de A guardar: `obter` devolve `undefined`; busca de A que termina depois da troca não grava;
  - `limpar()` no logout; erro 404 apaga a chave;
  - `antecipar` de PDF de 6 MB ou de `.docx` não busca;
  - `baixar` com `aoProgresso` chama com `(recebidos, total)` crescente e termina em `(total, total)`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `npm test` PASS.
- [ ] **Step 5:** Manual com latência (DevTools, "Fast 4G"): passar o mouse num PDF de 2 MB e clicar depois de 1 s abre sem espera; abrir de novo é instantâneo; Sair e entrar como outra pessoa não reaproveita o arquivo.
- [ ] **Step 6:** `git commit -m "perf(anexos): antecipar e guardar PDF e imagens na aba"`

### Task F5: Ponta a ponta, PRs e registros

- [ ] **Step 1:** Backend na stack de dev com a branch (`npm run dev:docker`, `npm run dados:ficticios`); frontend com `VITE_API_URL=http://localhost:5002`; `NODE_PATH=<pw>/node_modules npm run e2e`: 3 papéis, desktop e 375 px, sem problema.
- [ ] **Step 2:** `npm run desempenho` sem queda (Desempenho ≥ 95, Acessibilidade 100).
- [ ] **Step 3:** Revisão final da branch inteira por revisor novo, pedindo o cenário "troca de conta na mesma aba" e os 404 de anexo.
- [ ] **Step 4:** PRs (`gh pr create --base main --body-file ...`), CI verde. No corpo do PR do backend: **publicar com backup do banco e da pasta `anexos/` antes (migração 013)**; depois `conferirAnexos` sem flag, código 0.
- [ ] **Step 5:** Atualizar `CLAUDE.md` ("Onde estamos"), `.konvex/roteiro.md` (a 19 **tem** migração 013) e `.konvex/acompanhamento.md`.
