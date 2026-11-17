# Kanban editável por projeto: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cada projeto tem as próprias colunas de quadro (etapas), editáveis pelo líder e pela gestão, e as tarefas do projeto andam por elas.

**Architecture:** tabela `colunas_projeto` e `tarefas.coluna_codigo` (migração 015). O projeto carrega as colunas (`Projeto.colunas`); a tarefa de projeto aponta para uma coluna e o `status` é derivado do papel dela (`entrada` → `pendente`, `meio` → `andamento`, `concluida` → `concluida`), de modo que contagens, indicadores e a tela Tarefas não mudam. No frontend, quadro novo por etapa no projeto; o quadro por semana fica só na tela Tarefas.

**Tech Stack:** backend Express + TypeScript + `pg`, Jest; frontend React 18 (JS) + Bootstrap + Vite, `node --test`; Playwright para e2e (fora das dependências).

**Spec:** `docs/superpowers/specs/2026-11-16-kanban-colunas-design.md` (ler inteiro antes de qualquer tarefa).

## Global Constraints

- Repositórios: backend `~/BackendProjetosERP`, frontend `~/FrontendProjetosERP`, branch `feat/kanban-colunas` nos dois.
- Antes de cada commit, sem pipe: `npm run lint` e `npm run format:check` (os dois repos). Backend: `npm test`. Frontend: `npm test`.
- Commits: Conventional Commits em português, `tipo(escopo): descrição no imperativo`, até 72 caracteres, sem ponto final; corpo explica o porquê; termina com `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Escopos: `tarefas`, `projetos`, `ui`, `infra`. Migração = tipo `db`.
- Erros: `ErroValidacao` 400, `ErroProibido` 403, `ErroConflito` 409, `ErroNaoEncontrado` 404. Texto em `source/shared/erros/mensagensDeErro.ts`, dizendo o campo e a coluna errados. Nunca 500 por entrada inválida.
- Nenhuma validação nova pode rodar ao **ler** tarefa ou projeto do banco (lição das sessões 19 e 20).
- Limites: 2 a 12 colunas; nome 1 a 40 caracteres (depois de `trim`), único no projeto sem diferenciar maiúsculas; papéis `entrada`, `meio`, `concluida`; exatamente uma `entrada` e uma `concluida`, colunas diferentes.
- Paleta (chaves): `cinza`, `azul`, `verde`, `amarelo`, `laranja`, `vermelho`, `roxo`, `rosa`.
- Colunas padrão, nesta ordem: `A fazer` (`cinza`, `entrada`), `Fazendo` (`azul`, `meio`), `Revisando` (`amarelo`, `meio`), `Concluído` (`verde`, `concluida`).
- Frontend: responsivo só em `src/styles/responsive.css`; claro e escuro; erros com `error.message`; confirmações com `alerts.confirm`; sem emoji; `useCarregar` com `{ chave }` que inclua todos os `deps`.
- Integração local: stack de dev em `localhost:5434` (`konvex_teste`), `DATABASE_URL_TESTE=postgresql://...:5434/konvex_teste npm run test:integracao`, também com `TZ=America/Sao_Paulo`.

## Review Focus

1. **Duas pessoas no mesmo quadro:** alguém cria tarefa numa coluna enquanto o líder a exclui sem destino. Esperado: 409 `QUADRO_MUDOU` com mensagem para recarregar, nunca 500 (teste na B3).
2. **Trocas num só salvar:** renomear A↔B e trocar qual coluna é `entrada`/`concluida` no mesmo `PUT`. Esperado: grava, apesar dos índices únicos (teste de integração na B3).
3. **Linha divergente no banco:** tarefa com `status` diferente do papel da coluna, ou concluída sem data. Esperado: `GET /tarefas` responde 200 com o status do papel da coluna (teste na B2).
4. **Janela da tarefa aberta com colunas velhas:** a coluna escolhida foi excluída por outra pessoa. Esperado: 400 `COLUNA_DE_OUTRO_PROJETO` com texto claro, e a tela recarrega o projeto (testes na B4 e na F4).
5. **Troca de conta na mesma aba:** líder sai, membro entra. Esperado: o membro não vê "Editar colunas" nem colunas guardadas de projeto que não vê (e2e na F5).

---

## Mapa de arquivos

Backend, novos:
- `source/domain/enum/ColunaProjeto.ts`: `PapelColuna`, `CORES_COLUNA`, `statusDoPapel`.
- `source/domain/entity/ColunaProjeto.ts`: entidade e `colunasPadrao()`.
- `source/domain/interfaces/ColunaProjetoRepositoryInterface.ts`, `source/infra/repository/memory/ColunaProjetoRepositoryMemory.ts`, `source/infra/repository/database/ColunaProjetoRepositoryDatabase.ts`.
- `source/useCases/projetos/GerirColunasProjeto.ts`, `source/useCases/tarefas/MoverTarefa.ts`.
- `migrations/015_colunas_projeto.sql`.
- Testes: `test/colunaProjeto.test.ts`, `test/gerirColunasProjeto.test.ts`, `test/moverTarefa.test.ts`, `test/http/colunasProjeto.test.ts`, `test/integracao/migracao015.int.ts`, `test/integracao/colunas.int.ts`.

Backend, alterados: `Projeto.ts`, `Tarefa.ts`, `mensagensDeErro.ts`, `RepositoryFactoryInterface.ts` e as duas factories, `carregadores.ts`, `ProjetoRepositoryDatabase.ts`, `ProjetoRepositoryMemory.ts`, `TarefaRepositoryDatabase.ts`, `CriarTarefa.ts` (+Input), `EditarTarefa.ts` (+Input), `AlterarStatusTarefa.ts`, `resumoProjeto.ts`, `ProjetoRoutes.ts`, `TarefaRoutes.ts`, `swagger.ts`, `scripts/dados-ficticios.mjs`, docs.

Frontend, novos: `src/lib/colunas.js`, `test/colunas.test.js`, `src/components/CartaoTarefa.jsx`, `src/components/KanbanEtapas.jsx`, `src/components/ColunasModal.jsx`, `src/components/SeloEtapa.jsx`, `e2e/colunas.mjs`.

Frontend, alterados: `src/lib/apiMappers.js`, `src/services/tarefas.js`, `src/services/projetos.js`, `src/components/KanbanTarefas.jsx`, `src/components/TaskModal.jsx`, `src/pages/Projeto.jsx`, `src/pages/Tarefas.jsx`, `src/styles/theme.css`, `src/styles/components.css`, `src/styles/responsive.css`.

---

### Task B1: domínio (coluna, projeto com colunas, tarefa com status derivado)

**Files:**
- Create: `source/domain/enum/ColunaProjeto.ts`, `source/domain/entity/ColunaProjeto.ts`, `test/colunaProjeto.test.ts`
- Modify: `source/domain/entity/Projeto.ts`, `source/domain/entity/Tarefa.ts`, `source/shared/erros/mensagensDeErro.ts`, `source/useCases/tarefas/{CriarTarefa,EditarTarefa,AlterarStatusTarefa}.ts`
- Test: `test/colunaProjeto.test.ts`, e os testes existentes de tarefa continuam passando

**Interfaces (Produces):**

```ts
// enum/ColunaProjeto.ts
export enum PapelColuna { ENTRADA = "entrada", MEIO = "meio", CONCLUIDA = "concluida" }
export const CORES_COLUNA = ["cinza","azul","verde","amarelo","laranja","vermelho","roxo","rosa"] as const;
export type CorColuna = (typeof CORES_COLUNA)[number];
export function statusDoPapel(papel: PapelColuna): StatusTarefa;

// entity/ColunaProjeto.ts  (valida nome 1..40 após trim, cor, papel; é montada também ao ler do banco, que já garante os três)
export default class ColunaProjeto {
    constructor(nome: string, cor: CorColuna, papel: PapelColuna, codigo?: string);
    readonly codigo: string; readonly nome: string; readonly cor: CorColuna; readonly papel: PapelColuna;
}
export function colunasPadrao(): ColunaProjeto[];
/** Regras do conjunto (2..12, uma entrada, uma concluída, nomes únicos). Chamada só ao gravar. */
export function validarColunas(colunas: ColunaProjeto[]): void;

// Projeto: DetalhesProjeto ganha `colunas?: ColunaProjeto[]` (ausente = colunasPadrao())
readonly colunas: ColunaProjeto[];          // em ordem; entra no toJSON como [{codigo,nome,cor,papel}]
get colunaDeEntrada(): ColunaProjeto;       // sem coluna `entrada` (dado estranho): a primeira
get colunaConcluida(): ColunaProjeto;       // sem `concluida`: a última
colunaParaStatus(status: StatusTarefa, atual?: ColunaProjeto | null): ColunaProjeto;
comColunas(colunas: ColunaProjeto[]): Projeto;

// Tarefa: 16º parâmetro do construtor `coluna: ColunaProjeto | null = null`
readonly coluna: ColunaProjeto | null;
naColuna(coluna: ColunaProjeto, hoje: Date, quem: Usuario | null): Tarefa;
exigirConclusaoCoerente(): void;            // lança DATA_CONCLUSAO_OBRIGATORIA / DATA_CONCLUSAO_INCOMPATIVEL
```

Regras que o código precisa seguir:
- `colunaParaStatus`: `concluida` → `colunaConcluida`; `pendente` → `colunaDeEntrada`; `andamento` → `atual` se o papel dele for `meio`, senão a primeira `meio` na ordem, senão `colunaDeEntrada`.
- Construtor de `Tarefa` com projeto: `coluna = coluna ?? projeto.colunaParaStatus(status)` e depois `status = statusDoPapel(coluna.papel)` (o status passado é ignorado quando há coluna). Sem projeto: `coluna = null`, status como hoje. Passar coluna em tarefa avulsa: `ErroValidacao` `TAREFA_AVULSA_SEM_COLUNA`.
- As duas validações de conclusão saem do construtor para `exigirConclusaoCoerente()`. `CriarTarefa`, `EditarTarefa` e `AlterarStatusTarefa` passam a chamá-la antes de gravar. As demais validações do construtor não mudam. `comStatus` e `semDependencia` repassam `coluna`.
- `naColuna`: entra em `concluida` vindo de fora → `dataConclusao = hoje`, `concluidaPor = quem`; já estava concluída → mantém os dois; sai → apaga os dois.
- `Tarefa.toJSON()`: acrescenta `coluna` (`{codigo,nome,cor,papel}` ou `null`) e **não** repete `projeto.colunas` dentro de `projeto`.
- Códigos de erro novos (texto em `mensagensDeErro.ts`, com o nome da coluna quando houver): `NOME_COLUNA_INVALIDO`, `COR_COLUNA_INVALIDA`, `PAPEL_COLUNA_INVALIDO`, `QUANTIDADE_COLUNAS_INVALIDA`, `NOME_COLUNA_REPETIDO`, `COLUNA_ENTRADA_UNICA`, `COLUNA_CONCLUIDA_UNICA`, `TAREFA_AVULSA_SEM_COLUNA`.

- [ ] **Step 1: testes que falham** em `test/colunaProjeto.test.ts`:
  - `colunasPadrao()` devolve os quatro nomes, cores e papéis das Global Constraints, nessa ordem.
  - `new ColunaProjeto("  ", "azul", MEIO)` e nome com 41 caracteres lançam `NOME_COLUNA_INVALIDO`; nome com 40 passa; `"  Fazendo "` vira `"Fazendo"`; cor `"preto"` lança `COR_COLUNA_INVALIDA`; papel `"fim"` lança `PAPEL_COLUNA_INVALIDO`.
  - `validarColunas`: 1 coluna e 13 colunas → `QUANTIDADE_COLUNAS_INVALIDA`; `"Fazendo"` e `"fazendo"` → `NOME_COLUNA_REPETIDO`; duas `entrada` ou nenhuma → `COLUNA_ENTRADA_UNICA`; idem `COLUNA_CONCLUIDA_UNICA`.
  - Projeto sem `colunas` nos detalhes tem as 4 padrão; `colunaParaStatus` nos cinco casos da regra acima (incluindo projeto só com `entrada` e `concluida`).
  - Tarefa de projeto criada com status `concluida` e sem coluna fica na `Concluído`; criada com `coluna = Revisando` e status `pendente` tem `status === "andamento"`.
  - Tarefa de projeto na coluna concluída com `dataConclusao = null` **não lança no construtor**; `exigirConclusaoCoerente()` lança `DATA_CONCLUSAO_OBRIGATORIA`.
  - `naColuna`: os três casos (entra, já estava, sai).
  - `JSON.parse(JSON.stringify(tarefa))`: tem `coluna.nome`, e `projeto.colunas` é `undefined`.
  - Avulsa com coluna → `TAREFA_AVULSA_SEM_COLUNA`.
- [ ] **Step 2:** `npx jest test/colunaProjeto.test.ts` → falha (módulos não existem).
- [ ] **Step 3:** implementar conforme Interfaces e regras.
- [ ] **Step 4:** `npm test` → tudo verde (os testes antigos de tarefa seguem passando sem alteração de expectativa; se algum quebrar por depender de status e coluna juntos, corrigir o código, não o teste).
- [ ] **Step 5:** lint, format, commit `feat(tarefas): coluna do projeto com status derivado do papel`.

### Task B2: migração 015 e repositórios

**Files:**
- Create: `migrations/015_colunas_projeto.sql`, `test/integracao/migracao015.int.ts`
- Modify: `source/infra/repository/database/{carregadores,ProjetoRepositoryDatabase,TarefaRepositoryDatabase}.ts`, `source/infra/repository/memory/ProjetoRepositoryMemory.ts` (se precisar), `docs/sistema/04_modelo_de_dados.md`

**Interfaces:** Consumes B1. Produces: projeto lido do banco vem com `colunas` em ordem; `ProjetoRepository.criar` grava `projeto.colunas` na mesma transação; `ProjetoRepository.editar` **não** mexe em colunas; `TarefaRepository.criar/editar` gravam `coluna_codigo` (e o `status` derivado); a leitura monta a tarefa com a coluna do projeto.

Migração (transação, pode rodar de novo; ver `migrations/014_sigilo_trainee.sql` e `migracao014.int.ts` como modelo):

```sql
CREATE TABLE IF NOT EXISTS colunas_projeto (
    codigo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_codigo UUID NOT NULL REFERENCES projetos(codigo) ON DELETE CASCADE,
    nome VARCHAR(40) NOT NULL,
    cor VARCHAR(10) NOT NULL CHECK (cor IN ('cinza','azul','verde','amarelo','laranja','vermelho','roxo','rosa')),
    ordem INT NOT NULL,
    papel VARCHAR(10) NOT NULL CHECK (papel IN ('entrada','meio','concluida')),
    UNIQUE (codigo, projeto_codigo)
);
-- índices únicos: (projeto_codigo) WHERE papel='entrada'; idem 'concluida'; (projeto_codigo, lower(nome))
-- tarefas.coluna_codigo UUID NULL
-- FK (coluna_codigo, projeto_codigo) → colunas_projeto(codigo, projeto_codigo), NO ACTION (não RESTRICT nem CASCADE)
```

Ordem dentro da migração: (1) tabela e índices; (2) coluna `coluna_codigo`; (3) para cada projeto **sem** colunas, as 4 padrão (ordem 0 a 3); (4) `UPDATE tarefas` de projeto com `coluna_codigo IS NULL` pela correspondência de status; (5) acerto de conclusão: concluída sem data recebe `data_fim`; não concluída com data perde `data_conclusao` e `concluida_por_codigo`; (6) FK composta, `CHECK ((projeto_codigo IS NULL) = (coluna_codigo IS NULL))` e `CHECK ((status = 'concluida') = (data_conclusao IS NOT NULL))`, cada um só se ainda não existir.

- [ ] **Step 1: teste de integração que falha** (`migracao015.int.ts`): monta o banco até a 014, insere 2 projetos; no primeiro, tarefas `pendente`, `andamento`, `concluida` (com data), uma `concluida` sem data e uma `pendente` com data (inserção direta em SQL); uma avulsa. Guarda `contarPorProjetos`. Roda a 015 duas vezes. Confere:
  - cada projeto tem 4 colunas com nomes, cores, papéis e ordem padrão;
  - cada tarefa está na coluna do seu status; a avulsa tem `coluna_codigo` nulo;
  - concluída sem data ficou com `data_conclusao = data_fim`; a pendente perdeu a data;
  - `contarPorProjetos` igual a antes (`total`, `concluidas`);
  - `INSERT` de tarefa de projeto sem coluna falha; com coluna de **outro** projeto falha; segunda coluna `entrada` no mesmo projeto falha; `"FAZENDO"` repetindo `"Fazendo"` falha;
  - `DELETE FROM projetos` de um projeto com tarefas e colunas funciona;
  - **Review Focus 3:** `UPDATE tarefas SET status='pendente', data_conclusao=NULL` numa tarefa da coluna concluída (antes, só neste teste, `ALTER TABLE tarefas DROP CONSTRAINT` do CHECK de conclusão) e `TarefaRepositoryDatabase.listar()` devolve a tarefa com `status === "concluida"` sem lançar.
- [ ] **Step 2:** rodar a integração → falha (migração não existe).
- [ ] **Step 3:** escrever a migração e ajustar os repositórios. `carregadores.carregarProjetos` busca as colunas de todos os projetos pedidos numa consulta só (`ORDER BY projeto_codigo, ordem`). `TarefaRepositoryDatabase.carregar` passa `projetos.get(...).colunas.find(c => c.codigo === linha.coluna_codigo) ?? null` (se não achar, o construtor cai na coluna do status).
- [ ] **Step 4:** `npm test`; integração com e sem `TZ=America/Sao_Paulo` → verde (as outras integrações também).
- [ ] **Step 5:** atualizar `docs/sistema/04_modelo_de_dados.md` (tabela nova, coluna nova, checks). Commit `db(tarefas): migração 015 com colunas por projeto`.

### Task B3: gravar colunas (`PUT /projetos/:codigo/colunas`)

**Files:**
- Create: `source/domain/interfaces/ColunaProjetoRepositoryInterface.ts`, as versões `memory` e `database`, `source/useCases/projetos/GerirColunasProjeto.ts`, `test/gerirColunasProjeto.test.ts`, `test/http/colunasProjeto.test.ts`, `test/integracao/colunas.int.ts`
- Modify: `RepositoryFactoryInterface.ts`, `DatabaseRepositoryFactory.ts`, `MemoryRepositoryFactory.ts`, `ProjetoRoutes.ts`, `resumoProjeto.ts` (se o resumo listar campos), `mensagensDeErro.ts`, `swagger.ts`

**Interfaces:**

```ts
// Consumes: B1, B2.
export default interface ColunaProjetoRepositoryInterface {
    /** Troca as colunas do projeto pela lista (na ordem) e regrava coluna, status e conclusão das tarefas dadas. Uma transação. */
    substituir(codigoProjeto: string, colunas: ColunaProjeto[], tarefas: Tarefa[]): Promise<void>;
}
// factory: criarColunaProjetoRepository(): ColunaProjetoRepositoryInterface

export interface EntradaColuna { codigo?: string; nome: string; cor: string; papel: string }
export default class GerirColunasProjeto {
    constructor(factory: RepositoryFactoryInterface);
    execute(input: { codigoProjeto: string; colunas: EntradaColuna[]; destinos?: Record<string, string>;
                     hoje?: Date; quem: Usuario | null }): Promise<ColunaProjeto[]>;
}
```

Regras:
- Entrada que não é lista, item que não é objeto, `destinos` que não é objeto: 400 `COLUNAS_INVALIDAS`.
- `codigo` que não é coluna deste projeto: 400 `COLUNA_DE_OUTRO_PROJETO`. Colunas com `codigo` mantêm o código; sem `codigo` ganham um novo.
- `validarColunas` sobre a lista final.
- Coluna existente ausente da lista = excluída. Se tem tarefas: `destinos[codigo]` obrigatório (`DESTINO_COLUNA_OBRIGATORIO`, mensagem com o nome da coluna e quantas tarefas) e tem que ser coluna existente que continua (`DESTINO_COLUNA_INVALIDO`).
- Tarefas a regravar: as das colunas excluídas (via `naColuna(destino, hoje, quem)`) e as de colunas cujo papel mudou (`naColuna(colunaNova, hoje, quem)`). Só elas vão para `substituir`.
- Banco: os índices únicos de papel e de nome impedem trocas diretas. Dentro da transação, primeiro pôr todas as colunas mantidas com `papel = 'meio'` e `nome = 'tmp-' || codigo` (40 caracteres, cabe), depois gravar os valores finais e inserir as novas, depois regravar as tarefas, por último apagar as excluídas. Violação de FK ao apagar (tarefa nova caiu na coluna nesse meio-tempo) → `ErroConflito` `QUADRO_MUDOU`: "O quadro mudou enquanto você editava. Recarregue e tente de novo."
- Rota em `ProjetoRoutes.ts`, ao lado de `PUT /projetos/:codigo/acesso`: carrega o projeto com as mesmas checagens de visibilidade das outras rotas do projeto (sigiloso sem acesso → 404; resumo → 403); depois exige `papelNoProjeto(usuario, projeto)` em `gestao` ou `lider`, senão 403 "Só o líder do projeto e a gestão podem fazer isso.". Responde com as colunas gravadas.
- `GET /projetos` e `GET /projetos/:codigo`: versão completa traz `colunas`; o resumo do sigiloso não traz.

- [ ] **Step 1: testes que falham.**
  - `test/gerirColunasProjeto.test.ts` (memória): criar coluna nova no meio; renomear; reordenar (a ordem devolvida é a enviada); mudar cor; excluir vazia sem destino; excluir com 2 tarefas sem destino → `DESTINO_COLUNA_OBRIGATORIO`; destino = a própria excluída ou código inexistente → `DESTINO_COLUNA_INVALIDO`; excluir com destino move as 2; trocar a `concluida` de "Concluído" para "Revisando": tarefas de Revisando ficam `concluida` com `dataConclusao = hoje` e `concluidaPor = quem`, as de Concluído voltam a `andamento` sem data; cada erro de `validarColunas` chega como 400; código de coluna de outro projeto → `COLUNA_DE_OUTRO_PROJETO`; corpo `colunas: "x"` → `COLUNAS_INVALIDAS`.
  - `test/http/colunasProjeto.test.ts` (modelo: `test/http/tarefas.test.ts` e `sigiloProjeto.test.ts`): `PUT` como líder 200, gerente 200, diretor 200, participante 403, membro de fora 403 ou 404 conforme as rotas do projeto já respondem, trainee da equipe 403; sigiloso: membro fora 404, gerente fora (resumo) 403; `GET /projetos/:codigo` traz `colunas` com 4 itens; resumo do sigiloso sem `colunas`; `POST /projetos` devolve projeto com as 4 padrão.
  - `test/integracao/colunas.int.ts`: **Review Focus 2** (um `PUT` que renomeia A↔B e troca `entrada` com `concluida`); depois de trocar a concluída, `SELECT count(*) FROM tarefas t JOIN colunas_projeto c ON c.codigo = t.coluna_codigo WHERE (t.status = 'concluida') <> (c.papel = 'concluida')` = 0; **Review Focus 1**: excluir coluna vazia depois de inserir, por SQL, uma tarefa nela sem informar destino no caso de uso (simula a corrida chamando `substituir` direto com a lista sem a coluna) → `ErroConflito` `QUADRO_MUDOU`; excluir projeto depois de personalizar colunas funciona.
- [ ] **Step 2:** rodar → falham.
- [ ] **Step 3:** implementar. Swagger: rota nova e campo `colunas`.
- [ ] **Step 4:** `npm test` e integração (com e sem `TZ`) → verde.
- [ ] **Step 5:** commit `feat(projetos): colunas do quadro editáveis por projeto`.

### Task B4: tarefa anda pelas colunas

**Files:**
- Create: `source/useCases/tarefas/MoverTarefa.ts`, `test/moverTarefa.test.ts`
- Modify: `AlterarStatusTarefa.ts`, `EditarTarefa.ts`, `EditarTarefaInput.ts`, `CriarTarefa.ts`, `CriarTarefaInput.ts`, `TarefaRoutes.ts`, `swagger.ts`, `mensagensDeErro.ts`; testes `test/alterarStatusTarefa.test.ts`, `test/editarTarefa.test.ts`, `test/criarTarefa.test.ts`, `test/http/tarefas.test.ts`

**Interfaces:**

```ts
// Consumes: B1 a B3.
export default class MoverTarefa {
    constructor(factory: RepositoryFactoryInterface);
    execute(codigo: string, codigoColuna: string, hoje?: Date, quem?: Usuario | null): Promise<Tarefa>;
}
// CriarTarefaInput e EditarTarefaInput: codigoColuna?: string | null
// Rota nova: PATCH /tarefas/:codigo/coluna  corpo { codigoColuna }
```

Regras:
- `MoverTarefa`: tarefa avulsa → 400 `TAREFA_AVULSA_SEM_COLUNA`; `codigoColuna` ausente, inexistente ou de outro projeto → 400 `COLUNA_DE_OUTRO_PROJETO` ("A coluna não existe mais neste projeto. Recarregue o quadro."); usa o projeto **atual** do repositório (colunas de agora) e `naColuna`.
- Rota `PATCH /tarefas/:codigo/coluna`: mesma checagem de `PATCH /status` (`regras.mudarStatus`, mesma mensagem 403).
- `AlterarStatusTarefa` em tarefa de projeto: `naColuna(projeto.colunaParaStatus(status, tarefa.coluna), hoje, quem)`; status fora do enum → 400 `STATUS_TAREFA_INVALIDO` como hoje. Avulsa: comportamento atual.
- `EditarTarefa`: com `codigoColuna`, vale a coluna (mesmos erros do mover); sem ele, o `status` é traduzido por `colunaParaStatus(status, atual.coluna)`. Conclusão segue a regra de `naColuna`.
- `CriarTarefa`: sem `codigoColuna` → `colunaDeEntrada`; com → essa coluna (se for a concluída: `dataConclusao = hoje`, `concluidaPor = criadaPor`). Avulsa com `codigoColuna` → `TAREFA_AVULSA_SEM_COLUNA`.
- Todos chamam `exigirConclusaoCoerente()` antes de gravar.

- [ ] **Step 1: testes que falham.**
  - `moverTarefa.test.ts`: A fazer → Revisando (`andamento`, sem data); → Concluído (`concluida`, data = hoje, `concluidaPor` = quem); Concluído → Concluído mantém data e autor; Concluído → Fazendo apaga os dois; coluna de outro projeto e código inexistente → `COLUNA_DE_OUTRO_PROJETO`; avulsa → `TAREFA_AVULSA_SEM_COLUNA`.
  - `alterarStatusTarefa.test.ts` (acrescentar): tarefa em Revisando recebe `andamento` e **fica** em Revisando; tarefa em Concluído recebe `andamento` e vai para Fazendo; recebe `pendente` e vai para A fazer; projeto só com entrada e concluída: `andamento` vai para a entrada (status `pendente`); avulsa segue igual.
  - `editarTarefa.test.ts`: `codigoColuna` vence `status`; sem `codigoColuna`, `status: "concluida"` leva à coluna concluída.
  - `criarTarefa.test.ts`: nasce na entrada; com `codigoColuna` da Revisando nasce lá; na concluída nasce com data.
  - `test/http/tarefas.test.ts`: responsável participante move a própria tarefa (200) e não a de outro (403); participante não responsável 403; líder 200; JSON de `GET /tarefas` tem `coluna.nome` e `coluna.cor` em tarefa de projeto, `coluna: null` em avulsa, e não tem `projeto.colunas`; **Review Focus 4**: mover para coluna excluída → 400 `COLUNA_DE_OUTRO_PROJETO`; tarefa de sigiloso sem acesso → 404 no `PATCH /coluna`.
- [ ] **Step 2:** rodar → falham.
- [ ] **Step 3:** implementar; swagger (rota nova, `codigoColuna`, `coluna`).
- [ ] **Step 4:** `npm test` e integração → verde.
- [ ] **Step 5:** commit `feat(tarefas): mover tarefa entre as colunas do projeto`.

### Task B5: dados fictícios e documentos

**Files:** `scripts/dados-ficticios.mjs`, `docs/sistema/06_documento_do_sistema.md`, `docs/GUIA_DE_USO.md`, `docs/PUBLICACAO.md`

- [ ] **Step 1:** `dados-ficticios.mjs`: no projeto principal, `PUT /projetos/:codigo/colunas` com 5 colunas (`A fazer` cinza entrada, `Fazendo` azul, `Em teste` roxo, `Revisando` amarelo, `Concluído` verde concluída), reaproveitando os códigos das 4 existentes, e pelo menos uma tarefa em cada coluna via `PATCH /tarefas/:codigo/coluna`. O script continua podendo rodar duas vezes sem erro.
- [ ] **Step 2:** subir a stack de dev (`KONVEX_DB_PORTA=5434 KONVEX_API_PORTA=5002 npm run dev:docker`, com `--force-recreate api` se a imagem mudou) e rodar `API_URL=http://localhost:5002 npm run dados:ficticios` duas vezes → as duas sem erro; `GET /projetos/:codigo` mostra 5 colunas.
- [ ] **Step 3:** docs. Doc 06: seção de Tarefas (quadro por etapa, status derivado, regras das colunas) e seção 3 (matriz: editar colunas = diretor, gerente, líder; mover tarefa = quem muda status). Guia: trocar o trecho do quadro por semana no projeto pelo quadro por etapa, "Editar colunas", "Mover para…"; a tela Tarefas segue por semana. `PUBLICACAO.md`: "Publicação da sessão 21" (backup do banco e dos anexos antes; deploy de back e front juntos; conferir no log "015"; voltar = restaurar o `pg_dump` e voltar back e front).
- [ ] **Step 4:** lint e format; commit `docs(tarefas): quadro por etapa no guia, documento e publicação`.

### Task F1: frontend, cálculos e serviços

**Files:**
- Create: `src/lib/colunas.js`, `test/colunas.test.js`
- Modify: `src/lib/apiMappers.js`, `src/services/tarefas.js`, `src/services/projetos.js`, testes existentes desses arquivos em `test/`

**Interfaces (Produces):**

```js
// src/lib/colunas.js
export const CORES = ['cinza','azul','verde','amarelo','laranja','vermelho','roxo','rosa']
export const adaptColuna = c => ({ id, nome, cor, papel })          // da API (codigo → id)
export function agrupar(colunas, tarefas)      // [{ coluna, tarefas }] na ordem das colunas; tarefa sem coluna conhecida vai para a de entrada; dentro: prioridade, depois prazo
export function novoRascunho(colunas)          // [{ id, nome, cor, papel, nova: false }]
export function mover(rascunho, indice, delta) // nova lista; fora dos limites devolve a mesma
export function marcar(rascunho, id, papel)    // 'entrada' | 'concluida': tira a marca da que tinha; a marcada que perde vira 'meio'; não deixa a mesma coluna com as duas marcas (a outra marca vai para a coluna que tinha a marca dada)
export function excluidasComTarefas(antes, rascunho, tarefas) // [{ coluna, quantidade }]
export function erroDoRascunho(rascunho)       // texto do primeiro problema (regras das Global Constraints) ou null
export function corpoColunas(rascunho, destinos) // { colunas: [{ codigo?, nome, cor, papel }], destinos }
export function efeitoNaConclusao(antes, rascunho, destinos, tarefas) // { concluem: n, reabrem: n }

// services
tarefas.mover(codigo, codigoColuna)            // PATCH /tarefas/:codigo/coluna
projetos.gravarColunas(codigo, corpo)          // PUT /projetos/:codigo/colunas
// adaptTask ganha `coluna` (adaptColuna ou null); corpoTarefa envia `codigoColuna` quando a tarefa tem coluna;
// corpoNovaTarefa(codigoProjeto, t) envia `codigoColuna` se `t.colunaId` existir;
// soMudouStatus passa a ignorar `coluna` na comparação; nova `soMudouEtapa(antes, depois)`;
// tarefas.salvar: só etapa mudou → mover; só status → alterarStatus; senão editar.
```

- [ ] **Step 1: testes que falham** em `test/colunas.test.js`: `agrupar` (ordem, tarefa órfã na entrada, ordenação interna); `mover` nos limites; `marcar` (marcar como concluída a coluna que é entrada troca as duas marcas entre as colunas); `erroDoRascunho` para nome vazio, 41 caracteres, repetido sem diferenciar maiúsculas, 1 e 13 colunas, e `null` no padrão; `excluidasComTarefas`; `corpoColunas` (nova sai sem `codigo`; ordem preservada); `efeitoNaConclusao` (trocar a concluída: `concluem` = tarefas da nova, `reabrem` = tarefas da antiga; excluir coluna com destino na concluída conta em `concluem`). Nos testes de `tarefas`/`apiMappers`: `adaptTask` com e sem coluna; `soMudouEtapa`; `tarefas.salvar` escolhe o caminho certo (seguir o padrão de teste já usado para `soMudouStatus`).
- [ ] **Step 2:** `npm test` → falham.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run format:check` → verde.
- [ ] **Step 5:** commit `feat(tarefas): cálculos e chamadas das colunas do projeto`.

### Task F2: quadro por etapa no projeto

**Files:**
- Create: `src/components/CartaoTarefa.jsx`, `src/components/KanbanEtapas.jsx`, `src/components/SeloEtapa.jsx`
- Modify: `src/components/KanbanTarefas.jsx`, `src/pages/Projeto.jsx`, `src/styles/theme.css`, `src/styles/components.css`, `src/styles/responsive.css`

**Interfaces:** Consumes F1. Produces:

```jsx
<CartaoTarefa D t papel acoes abrir origem? colunas? aoArrastar aoSoltar />   // o cartão que hoje está dentro de KanbanTarefas, sem mudar o visual
<KanbanEtapas D T colunas papelDe acoes abrir adicionar />  // adicionar(colunaId) ou null
<SeloEtapa coluna />                                         // chip com ponto da cor e nome
// acoesTarefa ganha: mover: (t, colunaId) => salvarTarefa(() => tarefas.mover(t.id, colunaId))
```

Regras:
- Extrair o cartão de `KanbanTarefas` para `CartaoTarefa` sem mudar o resultado na tela Tarefas (conferir por captura antes e depois).
- `KanbanEtapas`: uma coluna por etapa (`agrupar`); cabeçalho com ponto da cor, nome, contagem, sinal de entrada e de concluída (ícone do `Icon.jsx` com `title` "Coluna de entrada: tarefas novas caem aqui" / "Coluna concluída: conta no progresso"), botão "+" quando `adicionar` existe. Soltar em outra coluna chama `acoes.mover` se `papel.organiza || papel.podeStatus(t)`; soltar na mesma não faz nada. Arrastar não muda prazo.
- Menu do cartão (para quem `podeStatus`): quando `colunas` é passado, item "Mover para…" que abre as colunas (menos a atual) e chama `acoes.mover`.
- `Projeto.jsx`: o kanban usa `KanbanEtapas` com `projeto.colunas.map(adaptColuna)`; "Nova tarefa" e o "+" passam `colunaId` (sem preencher prazo por semana; some o uso de `semanas` para isso). O cronograma não muda.
- Cores: em `theme.css`, variáveis `--kc-<chave>` (cor do ponto/borda) e `--kc-<chave>-b` (fundo suave) para as 8 chaves, no claro e no escuro, com contraste de texto ≥ 4,5:1 sobre o fundo suave. Classe `.kc-<chave>` aplica as duas.
- 375 px: colunas roláveis na horizontal como o `.kb` atual; o quadro aceita de 2 a 12 colunas sem quebrar a página (largura mínima por coluna, rolagem só no quadro).

- [ ] **Step 1:** implementar componentes e estilos.
- [ ] **Step 2:** `npm test`, `npm run lint`, `npm run format:check` → verde.
- [ ] **Step 3:** conferir no navegador (stack de dev + `VITE_API_URL=http://localhost:5002 npx vite --port 5173`, Playwright do scratchpad): projeto com 5 colunas em 1280 px e 375 px, claro e escuro; arrastar uma tarefa entre colunas; "Mover para…" pelo menu; tela Tarefas igual à captura de antes. Guardar as capturas no scratchpad.
- [ ] **Step 4:** commit `feat(ui): quadro do projeto por etapa`.

### Task F3: janela "Editar colunas"

**Files:** Create `src/components/ColunasModal.jsx`. Modify `src/pages/Projeto.jsx`, `src/styles/components.css`, `src/styles/responsive.css`.

**Interfaces:** Consumes F1, F2. `<ColunasModal colunas tarefas aoSalvar(corpo) aoFechar />`; `aoSalvar` chama `projetos.gravarColunas` e depois `aoSalvar` da página (recarrega projeto e dados compartilhados).

Regras (desenho no spec, seção "Editar colunas"):
- Botão "Editar colunas" acima do quadro, só se `papel.organiza`.
- Cada linha: subir/descer (`aria-label` "Subir coluna X"/"Descer coluna X", desabilitados nas pontas), campo do nome (`maxLength` 40), 8 amostras de cor (botões com `aria-pressed` e `title` com o nome da cor), opção "entrada", opção "concluída", excluir. "Nova coluna" acrescenta antes da concluída, cor `cinza`, papel `meio`; desabilitado com 12.
- Excluir: desabilitado para a de entrada e a concluída (`title` "Marque outra coluna como entrada/concluída antes de excluir") e quando restam 2. Coluna com tarefas: a linha vira "Mover N tarefas para: [select das que continuam]" e o salvar exige a escolha.
- Salvar desabilitado enquanto `erroDoRascunho` devolver texto; o texto aparece na janela.
- Se `efeitoNaConclusao` tiver `concluem` ou `reabrem` > 0: `alerts.confirm` antes de salvar, com os dois números ("N tarefas passam a contar como concluídas hoje e M voltam a abertas.").
- Erro da API: `alerts.error('Não foi possível salvar', error.message)` e a janela fica aberta; no 409, recarrega o projeto e reinicia o rascunho.
- Fechar com rascunho alterado pede confirmação.

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** `npm test`, lint, format → verde.
- [ ] **Step 3:** conferir no navegador, 1280 e 375 px, claro e escuro, só teclado também: criar, renomear, reordenar, mudar cor, excluir com destino, trocar a concluída (confirmação e progresso do projeto muda), tentar nome repetido.
- [ ] **Step 4:** commit `feat(ui): janela para editar as colunas do quadro`.

### Task F4: janela da tarefa e tela Tarefas

**Files:** Modify `src/components/TaskModal.jsx`, `src/pages/Tarefas.jsx`, `src/components/KanbanTarefas.jsx`, `src/pages/Projeto.jsx`.

Regras:
- `TaskModal` recebe as colunas do projeto da tarefa. Tarefa de projeto: o seletor "Situação" vira "Etapa" (opções = colunas). Quem organiza: a escolha entra no rascunho e vai no salvar. Quem só `podeStatus`: o seletor fica **fora** do `fieldset` desabilitado e grava na hora com `acoes.mover`. Quem não pode: mostra `SeloEtapa`. Avulsa: como hoje. Concluir/Reabrir continua.
- **Review Focus 4:** erro 400 `COLUNA_DE_OUTRO_PROJETO` ao gravar → mensagem da API e recarregar (o `salvarTarefa` da página já recarrega no sucesso; passar a recarregar também nesse erro).
- Tela Tarefas: as colunas de cada projeto vêm de `D` (lista de projetos já carregada; conferir que `adaptProject` leva `colunas`, senão usar `t.coluna`). Cartão do quadro por semana e linha da lista mostram `SeloEtapa` em tarefa de projeto. A coluna e o filtro "Situação" da lista não mudam. O menu "Mover para…" **não** aparece na tela Tarefas (sem `colunas`).

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** `npm test`, lint, format → verde.
- [ ] **Step 3:** conferir no navegador como membro responsável (Bia): troca a etapa da própria tarefa pela janela e pelo menu; não consegue na tarefa de outro; avulsa inalterada; tela Tarefas com selos.
- [ ] **Step 4:** commit `feat(ui): etapa na janela da tarefa e selo na tela Tarefas`.

### Task F5: ponta a ponta

**Files:** Create `e2e/colunas.mjs` (modelo: `e2e/levantamento.mjs`; `API_URL=http://localhost:5002`).

- [ ] **Step 1:** escrever o fluxo, tudo **pela tela**: (a) líder cria coluna "Homologação", renomeia, sobe uma posição, muda a cor, salva e a vê no quadro; (b) move uma tarefa para ela pelo menu; (c) exclui a coluna escolhendo destino, e a tarefa aparece no destino; (d) troca a concluída, confirma, e o progresso do projeto muda; desfaz; (e) membro responsável move a própria tarefa e não vê "Editar colunas"; (f) **Review Focus 5:** líder sai, membro de outro projeto entra na mesma aba, abre Projetos e Tarefas: sem botão "Editar colunas", sem dados do projeto do líder; (g) 375 px: quadro rola na horizontal e o menu "Mover para…" funciona.
- [ ] **Step 2:** `NODE_PATH=<scratchpad>/node_modules API_URL=http://localhost:5002 node e2e/colunas.mjs` → todos os passos ok.
- [ ] **Step 3:** `npm run e2e` (levantamento, 4 papéis, desktop e 375 px) → sem problema.
- [ ] **Step 4:** commit `test(ui): fluxo das colunas do quadro ponta a ponta`.

### Fim da sessão (depois da revisão final da branch)

- Revisão final com os pedidos "troca de conta na mesma aba" e "dá para fazer pela tela?".
- PR em cada repo (`gh pr create --base main --title "..." --body-file <arquivo>`), CI verde.
- Atualizar `CLAUDE.md` ("Onde estamos"), `.konvex/acompanhamento.md`, `.konvex/roteiro.md`; copiar o acompanhamento para `~/Downloads` e lembrar o envio ao projeto do claude.ai.
