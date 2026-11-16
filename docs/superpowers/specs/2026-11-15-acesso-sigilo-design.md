# Sessão 20: acesso do trainee e projetos sigilosos (desenho)

Data: 15/11/2026. Branch `feat/acesso-sigilo` nos dois repositórios. Migração 014.

## Por que

- **Trainee:** hoje a pessoa com status Trainee está registrada, pode estar na equipe de um projeto, mas não tem login. A gestão quer que ela use o sistema para acompanhar o próprio trabalho, sem acesso a material restrito, porque pode não ser efetivada.
- **Projeto sigiloso:** alguns contratos têm cláusula de sigilo. Os **detalhes** do projeto (cliente, descrição, tarefas, comentários, anexos, material da Biblioteca) não podem vazar para quem não está autorizado, nem para gerentes. O **nome** pode aparecer (decisão do usuário, 15/11). A gestão ainda precisa dos números (quantidade de tarefas, alocação das pessoas) para as estatísticas.

## Decisões do usuário (15/11)

Trainee:
- É identificado pelo **status Trainee** (não é papel novo nem senioridade). Ao ser efetivado, a gestão muda o status para Ativo.
- Vê: as próprias tarefas; os projetos em que está na equipe, **como um membro** (página do projeto, todas as tarefas, burndown); o próprio perfil; Capacitações; Dashboard (com os dados que recebe); a lista de pessoas.
- Não vê nada restrito.

Projeto sigiloso:
- A visibilidade (normal ou sigiloso) é escolhida ao criar o projeto. Quem cria escolhe as pessoas que o verão.
- A equipe do projeto entra na lista.
- **Todos os diretores sempre veem** o projeto sigiloso.
- Gerente e membro fora da lista não veem o projeto.
- **Diretores e o criador** podem mudar a lista e trocar o projeto entre normal e sigiloso. Ao virar sigiloso, a lista começa com a equipe.
- Para quem não vê: os detalhes somem. **O nome pode aparecer** (correção do usuário, 15/11: "só os detalhes não podem vazar"). A gestão fora da lista vê nome, status, datas, contagem de tarefas, equipe e alocação; o cliente fica escondido. Membro e trainee fora da lista não veem o projeto (como hoje no projeto normal), e para eles as rotas respondem **404**.
- A **gestão** (gerente fora da lista) recebe uma **versão resumida** só com números: contagem de tarefas, alocação das pessoas, status e datas, sem detalhar (abordagem A, abaixo).

## Abordagens consideradas

- **A. Versão resumida do projeto (escolhida).** `GET /projetos` devolve o sigiloso para o gerente fora da lista com uma lista fechada de campos (código e nome reais, status, datas, contagens de tarefas, equipe como pessoa + alocação). Os cálculos de indicadores, alocação e perfil, que rodam no frontend, continuam funcionando quase sem mudança.
- **B. Rota só de números (`/estatisticas`).** Vaza menos, mas obriga indicadores, alocação e perfil a juntar duas fontes, e cada estatística nova exige mexer na rota. Descartada: a alocação por pessoa vira um número solto.

## Situação de hoje (levantamento de 15/11)

- `shared/seguranca/visibilidadeProjetos.ts`: gerente e diretor veem todos os projetos (`projetos.verTodos`); membro vê os de que participa ou participou. Acesso negado responde **403** (`exigirVerProjeto`).
- Totais do Dashboard e da Visão Estratégica são calculados no frontend (`src/lib/indicadores.js`) com o que `GET /projetos` e `GET /tarefas` devolvem.
- Cada tarefa leva o projeto inteiro aninhado (`Tarefa.toJSON`).
- `ObterPerfilPessoa`: `alocacao.total` já soma todos os projetos; a lista de projetos é filtrada para membro.
- Biblioteca: o campo `projeto` do item sai nulo para quem não vê o projeto (`podeVerProjetoDoItem`); filtrar por esse projeto devolve vazio.
- `StatusPessoa.STATUS_COM_ACESSO = [ATIVO]`; `Usuario.ativo` deriva dele e é usado no login, na renovação de sessão, no middleware, em "responsável ativo" das tarefas e em capacitações.
- A tabela `projetos` não guarda quem criou.

## Desenho

### 1. Trainee com login

- `STATUS_COM_ACESSO` passa a incluir `TRAINEE`. Efeitos desejados: o trainee entra no sistema, pode ser responsável por tarefa e se inscrever em capacitações.
- O indicador "Membros ativos" continua contando só status Ativo (já é por status).
- **O trainee é sempre papel membro** (minha decisão: sem isso, um trainee com papel gerente veria tudo). Criar ou editar pessoa com status Trainee e papel diferente de membro responde 400 com código próprio. Mudar o status para Trainee de quem é gerente ou diretor também responde 400. A migração 014 passa a membro os trainees que tiverem outro papel.
- **Trainee não pode ser líder (decisão do usuário, 15/11):** `PUT /projetos/:codigo/lider` com um trainee responde 400 com código próprio. A migração 014 tira a liderança de trainees que forem líderes hoje (o projeto fica sem líder até a gestão escolher).
- **Trainee é só a etapa de entrada (decisão do usuário, 15/11):** ninguém volta a ser trainee. Mudar o status de uma pessoa **para** Trainee responde 400 `STATUS_TRAINEE_SO_NA_ENTRADA`; só se cria uma pessoa como Trainee.
- `UsuarioAutenticado` passa a levar `status` (lido do banco a cada requisição, como o papel).
- **Bloqueios do trainee** (além do que o papel membro já bloqueia):
  - Biblioteca: some do menu; as rotas da Biblioteca e dos anexos de item da Biblioteca respondem 403. (Minha decisão: a Biblioteca guarda material da EJ, então conta como "restrito".)
  - Perfil de outra pessoa: o trainee vê a lista de pessoas (`GET /usuarios`) e o próprio perfil. **Minha decisão:** abrir o perfil de outra pessoa segue a regra do membro (só os projetos em comum aparecem).
- O resto sai naturalmente da regra do membro: projetos da própria equipe, tarefas desses projetos e as próprias avulsas.
- Implementar o bloqueio como regra por status em `shared/seguranca/` (por exemplo, `ehTrainee(usuario)`), com o item de menu filtrado em `modulos/registro.ts`. Não mexer em `PERMISSOES_POR_PAPEL`.

### 2. Projeto sigiloso: dados

Migração 014:
- `projetos.sigiloso BOOLEAN NOT NULL DEFAULT false`.
- `projetos.criado_por_codigo UUID NULL REFERENCES usuarios(codigo) ON DELETE SET NULL`. Projetos antigos ficam com nulo; neles só os diretores mudam a lista e a visibilidade.
- Tabela `projeto_acesso (projeto_codigo, usuario_codigo, PK dos dois, ON DELETE CASCADE no projeto)`: a lista de pessoas autorizadas **além** da equipe.

Quem vê o projeto sigiloso por inteiro (`podeVerProjetoSigiloso`):
1. qualquer diretor;
2. o criador;
3. quem está em `projeto_acesso`;
4. quem está **hoje** na equipe (participação ativa; a equipe entra na lista sem precisar ser gravada).

Por isso, "ao virar sigiloso, a lista começa com a equipe" já é verdade sem copiar nada.

**Decisão do usuário (15/11):** no sigiloso, quem sai da equipe **perde o acesso** (diferente do projeto normal, em que quem participou vê o histórico). Se precisar, um diretor ou o criador põe a pessoa na lista. Quem sai da equipe e continua responsável por tarefa antiga do sigiloso também deixa de recebê-la no `GET /tarefas`.

Projeto normal: regra de hoje, sem mudança.

### 3. Projeto sigiloso: regras de acesso

- Uma função central em `visibilidadeProjetos.ts` decide, para pessoa + projeto, uma de três respostas: **completo**, **resumo** (gerente fora da lista de sigiloso) ou **nada**.
- **Membro ou trainee fora → 404** em todas as rotas que tocam o projeto sigiloso: `GET /projetos/:codigo`; tarefas, comentários e anexos das tarefas do projeto. **Gerente fora da lista:** `GET /projetos/:codigo` devolve o mesmo resumo da listagem; as demais rotas do projeto (edição, status, exclusão, equipe, líder, tarefas, comentários, anexos) respondem **403** (o nome não é segredo, então não é preciso esconder que existe). Projeto normal continua respondendo 403 onde responde hoje.
- **O gerente fora da lista não edita o sigiloso** (nem equipe nem tarefas).
- **Equipe (minha decisão, segue "a equipe entra na lista"):** quem vê o projeto completo e tem `projetos.editar` (diretor, gerente da lista, gerente criador) põe qualquer pessoa na equipe, como hoje; ao entrar na equipe, a pessoa passa a ver o sigiloso. Não é preciso estar na lista antes.
- **Poderes de quem vê completo (minha decisão):** cada um mantém os poderes que teria num projeto normal. Gerente na lista gere o projeto, a equipe e as tarefas. Membro ou trainee na lista, mas fora da equipe, só lê (projeto, tarefas, comentários e anexos), como hoje quem já saiu da equipe; comentar continua exigindo a equipe atual.
- **Lista de acesso:** `PUT /projetos/:codigo/acesso { codigos: [...] }` só para diretor ou criador; os outros recebem 403 (404 para membro e trainee fora). Só pessoas com login (Ativo ou Trainee) entram na lista.
- **Visibilidade:** o campo `sigiloso` vai no `POST /projetos` (com `acesso` opcional) e no `PUT /projetos/:codigo`. Mudar o valor no PUT exige diretor ou criador (403 para os outros). Ao voltar a normal, a lista gravada fica guardada, mas não vale mais.
- `GET /projetos/:codigo` para quem vê completo traz `sigiloso`, `acesso` (pessoas da lista gravada) e `podeGerirAcesso`.

### 4. A versão resumida (só para o gerente fora da lista)

Em `GET /projetos` (e só lá), o projeto sigiloso que o gerente não vê sai como:

```json
{
  "codigo": "<código real>",
  "nome": "<nome real>",
  "sigiloso": true,
  "resumo": true,
  "status": "andamento",
  "dataInicio": "...",
  "dataFim": "...",
  "tarefas": { "total": 12, "concluidas": 5, "atrasadas": 2, "semana": 1 },
  "participacoes": [{ "usuario": { "codigo": "...", "nome": "..." }, "alocacao": 20, "ativa": true, "dataEntrada": "...", "dataSaida": null }]
}
```

- **Lista fechada de campos:** o resumo é montado campo a campo, nunca com cópia do projeto. Um teste garante que nenhum outro campo sai (cliente, descrição, referência, objetivo, tags, área, líder, função na equipe).
- Código e nome são os reais (sem máscara).
- `atrasadas` e `semana` usam a mesma definição do `src/lib/indicadores.js` e o "hoje" do servidor (`shared/datas`).
- As tarefas do sigiloso **não** saem no `GET /tarefas` para o gerente fora da lista; os números vêm só pelo resumo.
- O membro e o trainee fora da lista não recebem nem o resumo.
- **Busca e filtros** de `GET /projetos`: buscar pelo nome acha o sigiloso (vem como resumo). A busca **não** pode casar pelo cliente nem pela referência para quem recebe o resumo (o resumo só aparece se casar pelo nome). Filtros por área e responsável não incluem o resumo (esses campos são detalhe). Filtro por status vale.

### 5. Outros lugares

- **Perfil da pessoa (`GET /usuarios/:codigo/perfil`):** para o gerente fora da lista, o sigiloso aparece com o nome, status, datas e alocação, sem link. Para o membro, a regra de hoje já mostra só os projetos em comum. `alocacao.total` continua somando tudo.
- **Biblioteca (minha decisão: material do projeto é detalhe):** item ligado a um projeto sigiloso **some por inteiro** (fora da lista, 404 no item e nos anexos) para quem não vê o projeto completo, seja qual for o sigilo do item, inclusive para quem tem `biblioteca.verTodos`. O sigilo "equipe do projeto" num sigiloso vale para todos que veem o projeto completo. `podeVerItem`, `projetosDoUsuario`, o filtro da listagem e `podeVerProjetoDoItem` usam a regra nova. Ligar um item ao sigiloso exige vê-lo completo.
- **Visão Estratégica (minha decisão):** os resumos entram só nas contagens (projetos por grupo, tarefas atrasadas e da semana, alocação). Ficam **fora** dos blocos por projeto: burndown, "Tarefas por projeto", "Projetos críticos", progresso. Nada que abra o projeto aponta para um resumo.
- **Tarefas:** `regrasTarefa.ver` e o filtro do `GET /tarefas` usam a regra nova. O atalho "gestão recebe tudo" (`TarefaRoutes.ts:78`) deixa de valer para tarefas de sigiloso que o gerente não vê.
- **Contagens:** `comContagem` e `contarPorProjetos` seguem iguais para quem vê completo.

### 6. Frontend

- **Formulário do projeto:** escolha "Normal / Sigiloso". No sigiloso, escolher as pessoas da lista (busca nas pessoas com login), com a observação de que diretores e equipe já veem. Mudar a visibilidade e a lista depois: só aparece para quem tem `podeGerirAcesso`.
- **Selo "Sigiloso"** (cadeado, sem emoji) no cartão e na página do projeto, para quem vê completo.
- **Resumo:** em Projetos, uma linha ou cartão cinza com o nome, o selo "Sigiloso" com cadeado e o status, sem link e sem ações. Em Dashboard e Visão Estratégica, os resumos entram nas contagens de projetos. `indicadores.js` soma `tarefas.atrasadas` e `tarefas.semana` dos resumos aos números de tarefas. A alocação por pessoa (`services/projetos.js`, `alocacaoPorPessoa`) conta as participações do resumo.
- Qualquer tela que abra o projeto pelo código não pode tentar abrir um resumo (sem link, fora do antecipar do menu).
- **Trainee:** o menu já vem da API (sem a Biblioteca). As telas obedecem aos `pode*` que a API manda.
- Responsivo, Halo claro e escuro, como as outras telas.

### 7. Documentação

- `docs/sistema/06_documento_do_sistema.md`, seção 3 (matriz): linha do trainee e regras do sigiloso.
- `docs/GUIA_DE_USO.md`: como criar projeto sigiloso, quem vê, o que a gestão vê no resumo, o que o trainee vê.

## Objetivos, não objetivos e o que não pode acontecer

- Objetivo: trainee usa o sistema para o próprio trabalho; projeto sigiloso só aparece por inteiro para a lista, a equipe, o criador e os diretores; a gestão continua com estatísticas.
- Não objetivo: auditoria de quem viu o quê; sigilo de tarefa avulsa; sigilo por campo do projeto.
- **Não pode acontecer** (falha mesmo que "funcione"):
  - o cliente ou qualquer detalhe do sigiloso (descrição, tarefas, comentários, anexos, material da Biblioteca) aparecer para quem não vê, em qualquer rota ou tela, inclusive por busca pelo cliente, tarefa aninhada, dependência entre tarefas, perfil ou Biblioteca;
  - membro ou trainee fora da lista descobrir que o projeto existe (para eles, 404);
  - a memória do frontend (por pessoa, sessão 18) mostrar dado do sigiloso depois de a pessoa sair da lista, além do tempo de uma atualização.

## Testes

- Unitários: as três respostas da regra central (completo, resumo, nada) para diretor, criador, lista, equipe atual e antiga, gerente fora, membro fora e trainee; lista fechada do resumo; trainee com papel diferente de membro (400); bloqueio da Biblioteca para trainee.
- HTTP: 404 em cada rota do sigiloso para membro e trainee fora; 403 nas rotas de detalhe e escrita para gerente fora, e resumo no `GET /projetos/:codigo`; `PUT /acesso` (diretor, criador, outro gerente); busca pelo cliente não acha o sigiloso para o gerente fora, busca pelo nome acha o resumo.
- Integração (PostgreSQL): migração 014; listar projetos com sigiloso e resumo; tarefas do sigiloso fora do `GET /tarefas` do gerente fora da lista.
- Frontend: `indicadores.js` e `alocacaoPorPessoa` com resumos; e2e com os três papéis mais um trainee, desktop e 375 px.
- Revisão final: pedir o cenário "troca de conta na mesma aba" (lição da sessão 18) e "pessoa sai da lista ou da equipe enquanto a tela está aberta".

## Deixado para quem constrói

- Nome dos códigos de erro e mensagens (seguindo `mensagensDeErro.ts`).
- Forma exata dos componentes da tela, dentro do visual Halo.
