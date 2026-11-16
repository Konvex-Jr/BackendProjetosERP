# Sessão 21: Kanban editável por projeto (desenho)

Data: 16/11/2026. Branch `feat/kanban-colunas` nos dois repositórios. Migração 015.

## Por que

Hoje o quadro de tarefas do projeto tem colunas fixas por **semana** ("Essa semana", "Semana que vem", "Daqui a duas semanas", "Concluído"): a coluna vem do prazo, e arrastar muda o prazo. O status (`pendente`, `andamento`, `concluida`) existe no banco, mas só "concluída" aparece no quadro. Cada projeto trabalha de um jeito, e o líder não consegue mostrar as etapas do trabalho (por exemplo, "Revisando"). O pedido (15/11, confirmado em 16/11): o quadro do projeto passa a ser **por etapa**, e o líder monta as colunas como achar melhor.

## Decisões do usuário (16/11)

- O quadro do projeto é por etapa. Colunas padrão: **A fazer, Fazendo, Revisando, Concluído**.
- O líder pode criar, renomear, reordenar, mudar a cor e excluir colunas, e decide quantas existem.
- O quadro por semana **sai do projeto**. O prazo fica na tarefa (aparece no cartão, muda abrindo a tarefa) e não depende da coluna.
- A tela **Tarefas** (todos os projetos e avulsas juntos) e as tarefas avulsas **continuam por semana**, como hoje. O cartão ganha um selo com a etapa.
- Do roteiro (15/11): uma coluna marcada como **concluída** (conta para progresso, burndown e indicadores) e uma de **entrada** (onde caem as tarefas novas); excluir coluna com tarefas pede para onde elas vão; projetos existentes recebem as colunas padrão na migração, sem perder o status das tarefas.

## Abordagens consideradas

1. **Coluna nova + status mantido (escolhida pelo usuário).** Tabela de colunas por projeto; a tarefa aponta para a coluna; o `status` atual continua existindo, calculado pelo papel da coluna. Progresso, burndown, indicadores, Dashboard, Estratégia e a tela Tarefas não mudam. Risco baixo.
2. **Trocar status por coluna em tudo.** Mais limpo, mas mexe em todas as telas e consultas, e as avulsas (sem projeto) precisariam de regra à parte. Risco alto para o mesmo resultado visível.
3. **Colunas como lista (JSON) dentro do projeto.** Menos tabelas, mas excluir coluna e mover tarefas fica sem garantia do banco. Descartada.

## Objetivos, fora do escopo e o que seria fracasso

- **Objetivos:** colunas próprias por projeto; mover tarefa entre colunas; nada do que conta "concluída" muda de resultado depois da migração.
- **Fora do escopo** (se pedirem, vai para Opcionais): limite de tarefas por coluna; ordem manual dos cartões dentro da coluna; colunas editáveis para avulsas ou para a tela Tarefas; copiar colunas de um projeto para outro; visão por semana dentro do projeto.
- **Fracasso mesmo funcionando:** tarefa de projeto sem coluna; status diferente do papel da coluna (indicadores errados); projeto sem coluna de entrada ou sem coluna concluída; `GET /tarefas` quebrar para todos por causa de uma validação ao ler do banco (lição das sessões 19 e 20); perder o status das tarefas na migração.

## Regras

Decisões do Claude estão marcadas com **(Claude)**; mudar se o usuário discordar.

### Colunas

- Cada projeto tem de **2 a 12** colunas **(Claude)**, em ordem.
- Cada coluna: nome (1 a 40 caracteres, sem repetir no projeto, sem diferenciar maiúsculas) **(Claude)**, cor (de uma paleta fixa) e papel: `entrada`, `meio` ou `concluida`.
- Exatamente **uma** coluna `entrada` e **uma** `concluida` por projeto, e são colunas diferentes. A posição é livre (a concluída não precisa ser a última) **(Claude)**.
- Paleta **(Claude)**: 8 chaves (`cinza`, `azul`, `verde`, `amarelo`, `laranja`, `vermelho`, `roxo`, `rosa`). A API guarda a chave; o frontend traduz para tokens do Halo, em claro e escuro. Padrão: A fazer `cinza`, Fazendo `azul`, Revisando `amarelo`, Concluído `verde`.
- Projeto novo nasce com as quatro colunas padrão, na mesma transação da criação.

### Status calculado pela coluna

Para tarefa de projeto, o status é **sempre** o do papel da coluna: `entrada` → `pendente`, `meio` → `andamento`, `concluida` → `concluida`. O status segue gravado na tabela `tarefas` (as consultas de contagem usam `status = 'concluida'`), e toda escrita o mantém igual ao papel da coluna. Tarefa avulsa não tem coluna e segue com o status de hoje.

- Entrar na coluna concluída: `dataConclusao` = hoje (São Paulo), `concluidaPor` = quem moveu. Já estava concluída: mantém os dois (regra atual).
- Sair da coluna concluída: apaga os dois (regra atual).

### Quem pode

- **Editar colunas:** quem organiza as tarefas do projeto hoje: gestão (`tarefas.gerirTodas`) e o **líder** (`papelNoProjeto` = `gestao` ou `lider`) **(Claude: o usuário disse "o líder"; a gestão entra porque já organiza tudo no projeto)**. Sem permissão nova no catálogo.
- **Mover tarefa entre colunas:** a regra `mudarStatus` de hoje (quem organiza; participante da equipe atual nas tarefas em que é responsável). Antes essa pessoa só concluía e reabria; agora move entre quaisquer colunas **(Claude)**.
- **Ver colunas:** quem tem acesso completo ao projeto. O resumo do sigiloso (gerente fora da lista) não traz colunas. Projeto sigiloso sem acesso: 404/403 como nas outras rotas do projeto.
- Trainee: como membro, sem exceção.

## Banco (migração 015)

- Tabela `colunas_projeto`: `codigo` UUID, `projeto_codigo` (FK, some com o projeto), `nome`, `cor`, `ordem`, `papel`. Garantias no banco: uma `entrada` e uma `concluida` por projeto (índices únicos parciais); nome único por projeto sem diferenciar maiúsculas; `cor` e `papel` dentro das listas.
- `tarefas.coluna_codigo` (nulo só em avulsa). Garantias: tarefa tem coluna se e só se tem projeto (CHECK); a coluna é do mesmo projeto da tarefa (FK composta `(coluna_codigo, projeto_codigo)`). A FK não pode impedir a exclusão do projeto (que apaga tarefas e colunas juntas) nem apagar tarefas ao excluir coluna.
- Preenchimento: todo projeto existente ganha as quatro colunas padrão; cada tarefa de projeto vai para a coluna do seu status (`pendente` → A fazer, `andamento` → Fazendo, `concluida` → Concluído). Revisando começa vazia. Status, data de conclusão e quem concluiu não mudam.
- **(Claude)** CHECK novo em `tarefas`: `status = 'concluida'` se e só se `data_conclusao` não é nula. A migração confere antes se algum dado atual viola a regra; se violar, corrige (concluída sem data recebe `data_fim`; não concluída com data perde a data) e o teste de integração cobre os dois casos.
- A migração roda numa transação e pode rodar de novo sem efeito (padrão das anteriores).
- **Voltar atrás:** o backend antigo não cria tarefa de projeto com a migração 015 aplicada (o CHECK exige coluna). Voltar = restaurar o `pg_dump` e voltar back e front juntos. Registrar no `docs/PUBLICACAO.md`.

## API

- **Projeto:** o detalhe e a lista de projetos (versão completa) trazem `colunas` em ordem: `{ codigo, nome, cor, papel }`.
- **Tarefa:** o JSON da tarefa de projeto traz `coluna: { codigo, nome, cor, papel }`; avulsa traz `coluna: null`. `status` continua no JSON.
- **`PUT /projetos/:codigo/colunas`** (caso de uso novo `GerirColunasProjeto`): grava a lista inteira de uma vez, numa transação. Corpo: `{ colunas: [{ codigo?, nome, cor, papel }], destinos: { "<código da coluna excluída>": "<código da coluna de destino>" } }`. A ordem é a do array. Coluna sem `codigo` é nova; coluna existente que não veio é excluída.
  - Coluna excluída com tarefas exige destino, e o destino tem que ser uma coluna existente que continua. Coluna excluída vazia não precisa de destino.
  - Tarefas movidas por exclusão, e tarefas de colunas cujo papel mudou, têm status e conclusão recalculados na mesma transação (entra em concluída: hoje e quem salvou; sai: apaga).
  - Erros 400 dizem o campo e a coluna: quantidade fora de 2 a 12, nome vazio/longo/repetido, cor fora da paleta, falta ou sobra de `entrada`/`concluida`, código de coluna de outro projeto, destino faltando ou inválido. Mensagens em `mensagensDeErro.ts`.
  - Devolve as colunas gravadas.
- **`PATCH /tarefas/:codigo/coluna`** `{ codigoColuna }`: move a tarefa. Regra `mudarStatus`. Coluna inexistente ou de outro projeto: 400 `COLUNA_DE_OUTRO_PROJETO`. Tarefa avulsa: 400.
- **`PATCH /tarefas/:codigo/status`** continua (avulsas, botão Concluir/Reabrir, tela Tarefas). Em tarefa de projeto vira movimento **(Claude)**: `concluida` → coluna concluída; `pendente` → coluna de entrada; `andamento` → se a tarefa já está numa coluna `meio`, fica onde está; senão, a primeira coluna `meio` na ordem; se o projeto não tem coluna `meio`, a de entrada.
- **`PUT /tarefas/:codigo`** aceita `codigoColuna` opcional. Com ele, vale a coluna; sem ele, o `status` enviado é tratado como no PATCH de status.
- **`POST /tarefas`** em projeto: a tarefa cai na coluna de entrada; `codigoColuna` opcional permite criar direto numa coluna (botão "+" da coluna).
- Swagger atualizado.

## Backend: estrutura

- Entidade `ColunaProjeto` (valida nome, cor, papel). `Tarefa` ganha `coluna`. Na tarefa de projeto, o status é **derivado** da coluna no construtor (nunca diverge ao ler do banco); sobre a coluna, a entidade valida só "tem projeto ⇔ tem coluna".
- **(Claude)** As duas validações de conclusão que hoje estão no construtor de `Tarefa` (`DATA_CONCLUSAO_OBRIGATORIA`, `DATA_CONCLUSAO_INCOMPATIVEL`) saem do construtor e passam a valer só nos caminhos de escrita (criar, editar, mover, gravar colunas), como já foi feito com `RESPONSAVEL_FORA_DO_PROJETO` na sessão 20: uma linha divergente no banco não pode derrubar o `GET /tarefas`. As demais validações do construtor ficam como estão.
- Repositório novo de colunas: interface + memória + banco + as duas factories (regra do projeto).
- Excluir projeto: segue funcionando (tarefas e colunas somem).
- `dados:ficticios`: pelo menos um projeto com colunas personalizadas e tarefas espalhadas nelas.

## Frontend

### Quadro do projeto (aba Tarefas → Kanban)

Componente novo para o quadro por etapa; o cartão da tarefa é extraído e compartilhado com o quadro por semana (`KanbanTarefas`, que segue na tela Tarefas).

```
[ Editar colunas ]                                   (só líder e gestão)

● A fazer  3   +   ● Fazendo  2   +   ● Revisando  1   +   ● Concluído ✓  5   +
┌───────────┐      ┌───────────┐      ┌───────────┐        ┌───────────┐
│ P1        │      │ P2        │      │ P3        │        │ P2        │
│ Título    │      │ Título    │      │ Título    │        │ Título    │
│ ⏱ 20/11 👤│      │ ⏱ 18/11 👤│      │ ⏱ 21/11 👤│        │ ⏱ 14/11 👤│
└───────────┘      └───────────┘      └───────────┘        └───────────┘
```

- Cabeçalho da coluna: marca de cor, nome, contagem, sinal de "entrada" e de "concluída" (com `title`), botão "+" (cria na coluna, para quem pode criar).
- Arrastar entre colunas chama `PATCH /tarefas/:codigo/coluna`. Pode arrastar quem pode mudar o status da tarefa. Arrastar não muda prazo.
- **(Claude)** Arrastar não funciona no toque. Por isso o menu do cartão (que já existe para quem pode mudar o status) ganha "Mover para…" com as colunas do projeto, também via `PATCH /tarefas/:codigo/coluna`.
- Ordem dentro da coluna: prioridade e depois prazo (como hoje).
- Cartão: igual ao de hoje (prazo, atrasada em vermelho, checklist, clipe, responsáveis).
- Celular (375 px): colunas roláveis na horizontal, como o quadro atual; regras só em `responsive.css`.
- Cronograma do projeto: não muda; as barras seguem com as três cores do status (concluída, em andamento, pendente) e a legenda atual **(Claude)**. A tela do projeto não tem visão de lista.

### Editar colunas (janela)

```
Colunas do quadro
 ↑ ↓  [ A fazer      ]  ●●●●●●●●  (•) entrada  ( ) concluída   🗑
 ↑ ↓  [ Fazendo      ]  ●●●●●●●●  ( ) entrada  ( ) concluída   🗑
 ↑ ↓  [ Revisando    ]  ●●●●●●●●  ( ) entrada  ( ) concluída   🗑
 ↑ ↓  [ Concluído    ]  ●●●●●●●●  ( ) entrada  (•) concluída   🗑
 + Nova coluna
                                            [Cancelar] [Salvar]
```

- Reordenar com botões subir/descer **(Claude: funciona no celular e no teclado; arrastar linhas fica fora)**.
- Excluir coluna com tarefas: pede a coluna de destino (entre as que continuam). Não deixa excluir a de entrada nem a concluída sem antes marcar outra.
- Trocar a coluna marcada como concluída: confirmação com `alerts.confirm` dizendo quantas tarefas passam a contar como concluídas e quantas voltam a abertas.
- Salvar = um `PUT`. Erro da API aparece com `error.message`. Depois de salvar: recarrega o projeto e os dados compartilhados.

### Janela da tarefa

- Tarefa de projeto: o seletor "Situação" vira "Etapa", com as colunas do projeto. Concluir/Reabrir continua.
- **(Claude)** Hoje o seletor fica dentro de um bloco desabilitado para quem não organiza. "Etapa" fica habilitado para quem pode mudar o status da tarefa (responsável da equipe atual); para essa pessoa a troca grava na hora pelo `PATCH /tarefas/:codigo/coluna` (o `PUT` segue exigindo organizar). Para quem organiza, a etapa vai junto no salvar (`codigoColuna` no `PUT`).
- Avulsa: como hoje.

### Tela Tarefas e demais

- Quadro por semana mantido. Cartão de tarefa de projeto ganha selo com nome e cor da etapa.
- **(Claude)** Lista da tela Tarefas: a coluna e o filtro "Situação" continuam com os três status (os nomes das etapas mudam de projeto para projeto); a linha de tarefa de projeto mostra o selo da etapa ao lado.
- **(Claude)** Reabrir (botão, menu ou arrastar para fora de "Concluído" na tela Tarefas) envia `andamento`: a tarefa de projeto vai para a primeira coluna `meio`, não para onde estava antes (lembrar a coluna anterior exigiria guardar mais um dado; fica fora).
- Dashboard, Estratégia, indicadores, burndown, progresso: sem mudança (usam `status`).
- Memória por aba: as colunas vêm junto do projeto e da tarefa, então seguem as regras de limpeza já existentes (troca de pessoa, 401/403/404).

## Testes

- Backend unitário/HTTP: cada regra e cada erro 400 acima; permissão (membro comum 403, líder e gestão 200, sigiloso sem acesso 404); status derivado; `PATCH status` em tarefa de projeto; criar projeto cria as colunas.
- Integração (PostgreSQL, também com `TZ=America/Sao_Paulo`): migração 015 sobre dados com os três status; garantias do banco; excluir projeto; depois de `PUT colunas` trocando a concluída, nenhuma tarefa com status diferente do papel da coluna; contagens do projeto iguais antes e depois da migração.
- Frontend: testes das funções puras (montar corpo do `PUT`, destinos, contagem da confirmação, agrupar por coluna).
- e2e: levantamento das telas com os 4 papéis, mais o fluxo **pela tela**: líder cria coluna, renomeia, reordena, muda cor, move tarefa, exclui coluna com tarefas escolhendo destino, troca a concluída e confere o progresso; membro responsável move a própria tarefa e não vê "Editar colunas".
- Revisão final: pedir os cenários "troca de conta na mesma aba" e "dá para fazer pela tela?".

## Documentos a atualizar no mesmo PR

`docs/sistema/06_documento_do_sistema.md` (tarefas e seção 3, matriz), `docs/sistema/04_modelo_de_dados.md`, `docs/GUIA_DE_USO.md` (quadro por etapa, editar colunas), `docs/PUBLICACAO.md` (publicação da sessão 21: backup antes, como voltar).

## Deixado para quem implementa

Nomes de arquivos e de classes CSS; formato exato dos índices e da FK; tokens de cor do Halo para cada chave da paleta; ícones de "entrada" e "concluída"; se o `PUT colunas` fica em `ProjetoRoutes` ou em rota própria; como a criação do projeto grava as colunas na mesma transação.
