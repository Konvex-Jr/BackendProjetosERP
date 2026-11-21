# Sessão 27a: visibilidade de projetos (cartão para todos, fim da lista de acesso)

Data: 20/11/2026. Primeiro item da sessão 27 (roteiro). O resto da 27 (textos e telas de erro, toasts, links que viram botões, checklist com iniciais, botões que viram, confirmações) fica para a 27b.

## 1. Intenção

Pedido do usuário (20/11): todo mundo logado sabe **que projetos existem** na Konvex. Os detalhes e as tarefas ficam com quem trabalha neles e com a gestão. A lista de acesso à parte (sessão 20) sai, porque complica a regra: quem precisa ver entra na equipe.

Hoje o membro só enxerga, na lista, os projetos de que participa ou participou. O sigiloso tem quatro portas de entrada (diretor, criador, lista de acesso, equipe atual), e o gerente de fora vê um "resumo" com progresso e equipe.

## 2. Regra nova

| Projeto | Vê completo (ficha, tarefas, equipe, quadro, Biblioteca ligada) | Os demais logados |
|---|---|---|
| Normal | equipe atual e antiga, diretores, gerentes (`projetos.verTodos`); no geral da área, quem lidera a área | cartão |
| Sigiloso | equipe **atual** e diretores (`projetos.verSigilosos`) | cartão (com selo de sigiloso) |

- Todo logado (diretor, gerente, membro, trainee) recebe o cartão de todos os projetos que não vê completo.
- **Cartão** (lista fechada, montada campo a campo, nunca espalhando o projeto): `codigo`, `nome`, `tipo`, `area` (só nos internos: código e nome), `status`, `lider` (código e nome; nulo se não houver), `sigiloso`, `geralDaArea`, `cartao: true`.
  - **Fora do cartão:** datas, contagem de tarefas e progresso, cliente, descrição, referência, equipe, funções e colunas.
  - Mesmo cartão para o projeto normal e o sigiloso. O nome do sigiloso nunca foi segredo (decisão de 15/11).
  - Na tela, o cartão não abre a ficha (como o resumo de hoje) e mostra o selo quando é sigiloso.
- Decididos com o usuário (20/11):
  - Ex-membro de projeto normal continua vendo completo (histórico). No sigiloso, perde o acesso (como hoje).
  - Quem criou um sigiloso e não está na equipe **perde** o acesso, como quem estava só na lista.
  - O líder da área segue vendo completo o projeto geral (que nunca é sigiloso).
  - O gerente de fora de um sigiloso passa a ver só o cartão (perde o progresso e a equipe do resumo da sessão 20).
  - O campinho (sessão 28) é só para gerentes e diretores; por isso a equipe não entra no cartão.

## 3. Abordagens

- **A. Nível "cartão" na regra central (escolhida pelo usuário em 20/11).** `acessoAoProjeto` passa a devolver `"completo" | "cartao"`. `GET /projetos` devolve todos os projetos, cada um completo ou cartão. Uma regra só; os usos atuais continuam perguntando "é completo?".
- B. Rota separada para os cartões (`GET /projetos/cartoes`), mantendo `/projetos` como está. Descartada: duas fontes para a mesma lista, dois jeitos de filtrar, e o front decidindo o que mostrar.

## 4. Backend

### 4.1 Regra central (`shared/seguranca/visibilidadeProjetos.ts`)
- `AcessoProjeto = "completo" | "cartao"`. Some o `"resumo"` e o `"nada"`.
- `ProjetoParaAcesso` perde `criadoPor` e `acesso`.
- Sai `podeGerirAcesso`.
- `exigirAcessoCompleto`: quem tem só o cartão recebe **403** (`PROJETO_SEM_ACESSO`, mensagem nova dizendo que só a equipe e a gestão veem os detalhes; no sigiloso, só a equipe e os diretores). O 404 para esconder a existência do projeto deixa de fazer sentido, porque o nome é público.
- `projetosVisiveisPara` deixa de forçar o membro aos próprios projetos na **lista de projetos** (a lista agora traz todos). Continua valendo onde serve para "projetos de que a pessoa participa" (tarefas do membro).

### 4.2 Rotas de projeto (`ProjetoRoutes.ts`)
- `GET /projetos`: devolve todos os projetos (com os filtros de status e tipo); completo = `toJSON` + contagem de tarefas; cartão = `cartaoProjeto(projeto)` (novo, substitui `resumoProjeto.ts`).
  - Filtros com cartão: busca só pelo nome; filtro de **área** só mantém cartões de projetos **internos** (o cartão de cliente não mostra a área; decisão do Claude na implementação, 20/11); filtros de **pessoa** e **responsável** descartam os cartões (senão revelariam a equipe).
  - `podeGerirAcesso` sai da resposta.
- `GET /projetos/:codigo`: devolve o completo ou o cartão (200). Projeto inexistente: 404.
- Escrita e demais rotas do projeto (`carregarParaEscrita`, colunas, equipe, status): exigem completo (403 para quem tem cartão).
- **Ninguém se tranca fora de um sigiloso (decisão do usuário, 20/11):** `POST /projetos` com `sigiloso: true` e `PUT /projetos/:codigo` que muda `sigiloso` de falso para verdadeiro respondem **400** se quem grava não é diretor (`projetos.verSigilosos`) e não estaria na equipe atual (na criação, a equipe inicial do corpo). Mensagem: ficaria sem acesso ao projeto sigiloso; coloque-se na equipe ou peça a um diretor. Sair da equipe de um sigiloso depois continua livre.
- Sai `PUT /projetos/:codigo/acesso` (passa a responder 404 de rota inexistente) e o campo `acesso` do `POST /projetos`.

### 4.3 Usos da regra
- **Tarefas** (`regrasTarefa.ts`, `TarefaRoutes.ts`): a lógica segue "sem completo, nenhum papel". Tarefa e anexo de quem não vê o projeto seguem **404** (`TAREFA_NAO_ENCONTRADA`), como hoje para o sigiloso. Projeto normal: o membro de fora recebe 404 na tarefa, como já recebe; o gerente vê (completo). O 404 vale para projeto normal e sigiloso, para todos os papéis.
- **Biblioteca** (`regrasBiblioteca.ts`): sem mudança de comportamento (item ligado a sigiloso que a pessoa não vê completo some).
- **Perfil** (`ObterPerfilPessoa.ts`): sem mudança de comportamento, coerente com a decisão abaixo (membro olhando outra pessoa vê só os projetos que vê completo; a gestão e a própria pessoa veem todos, com `restrito` nos que não veem completo).
- **Quem sabe quem está em cada projeto (decisão do usuário, 20/11):** a gestão (`projetos.verTodos`) sabe quem está em cada projeto, inclusive nos sigilosos de que está fora (nome do projeto e período, sem detalhes). O membro e o trainee não sabem a equipe de projeto que veem só pelo cartão.
- **Ocupação** (`ConsultarOcupacao.ts`): cartão + gestão = linha do projeto (nome e horas), como o `"resumo"` de hoje; cartão + membro/trainee = **"Outras tarefas"**.
- **Avisos** (`ConsultarAvisos.ts`): sem mudança de comportamento (só completo).
- **Projetos do membro** (`ListarProjetos`): sai a união com `listarComAcesso`; sai `listarComAcesso` das interfaces e dos dois repositórios.

### 4.4 Entidade e repositórios
- `Projeto` perde `acesso` (detalhes, `copiar`, `toJSON`). `criadoPor` continua gravado (histórico), sem uso na regra.
- Saem `DefinirAcessoProjeto.ts`, `validarCodigosAcesso`, as mensagens `ACESSO_*` e o que gravava e carregava `projeto_acesso` (`ProjetoRepositoryDatabase`, `carregadores.ts`, `ProjetoRepositoryMemory`).
- Swagger sem `/acesso`.

### 4.5 Migração 024
- `DROP TABLE IF EXISTS projeto_acesso;` (pode rodar de novo).
- **Antes da publicação** (`docs/PUBLICACAO.md`, seção nova "Publicação da sessão 27a"): consulta que lista, por sigiloso, quem está na lista e **não** está na equipe atual nem é diretor, e criadores na mesma situação. A gestão guarda a lista e, depois do deploy, coloca na equipe quem ainda precisar.
- Voltar o backend depois da 024 = restaurar o `pg_dump` (e voltar o front junto).

### 4.6 Testes
- Unidade da regra: tabela da seção 2 inteira (papel × normal/sigiloso × equipe atual/antiga/fora × líder da área no geral), criador fora da equipe = cartão.
- HTTP: membro e trainee recebem todos os projetos (cartões com só os campos da lista fechada; conferir que **não** vêm datas, tarefas, equipe, cliente); `GET /projetos/:codigo` de fora = 200 com cartão; escrita de fora = 403; tarefa de fora = 404; filtro de pessoa sem cartões; filtro de área com cartões; `PUT /acesso` = 404; ocupação com sigiloso alheio: linha do projeto para o gerente, "Outras tarefas" para o membro; criar ou marcar sigiloso sem estar na equipe = 400 (gerente), diretor passa.
- Integração: 024 aplica e roda de novo; listagem com o banco real.

## 5. Frontend

- `src/services/projetos.js`, `src/lib/carregarProjeto.js`, `src/lib/apiMappers.js`: o "resumo" vira "cartão" (`cartao: true`); quem tratava `resumo` passa a tratar `cartao`.
- **Projetos** (`Projetos.jsx`): a lista mostra todos; o cartão de fora mostra nome, tipo, área do interno, status, líder e selo (sigiloso); sem clique, sem progresso, sem datas. Filtros: Tipo, Área e status funcionam nos cartões; o filtro de pessoa (se houver) os esconde.
- **Formulário do projeto:** mostrar a mensagem do 400 de quem ficaria sem acesso ao sigiloso (sem fechar a janela).
- **Ficha** (`Projeto.jsx`): abrir pela URL um projeto em que só se tem o cartão mostra o cartão com o aviso de que os detalhes são da equipe e da gestão (sem as abas). Não é tela de erro.
- Sai a lista de acesso: `src/lib/gravarProjeto.js` (e `ErroAcessoParcial`), a seção "Lista de acesso" do formulário do projeto, `podeGerirAcesso`. O campo "Visibilidade" (sigiloso) continua.
- **Estratégia e indicadores** (`Estrategia.jsx`, `src/lib/indicadores.js`): não somam cartões (não têm contagem). Os cartões de projeto da Estratégia mostram os cartões sem números.
- **Dashboard, Tarefas, ocupação, Biblioteca**: conferir que cartão não quebra nenhum `.map` (sem `participacoes`, sem `tarefas`).
- Testes de `src/lib` (cartão, indicadores sem cartões) e e2e: `e2e/visibilidade-27a.mjs` pela tela (membro vê o cartão de projeto alheio e não abre; trainee idem; gerente vê o cartão do sigiloso alheio; diretor vê tudo; troca de conta na mesma aba; 375 px escuro); `e2e/projetos-internos.mjs` e o levantamento de 52 telas ajustados.

## 6. Documentação
- `docs/sistema/06_documento_do_sistema.md`, seção 3: tabela "Projeto sigiloso" e linhas de projetos refeitas pela seção 2 deste documento; sai tudo da lista de acesso.
- `docs/GUIA_DE_USO.md`: Projetos (cartões de fora) e fim da lista de acesso.
- `docs/PUBLICACAO.md`: "Publicação da sessão 27a" (consulta prévia, backup, back e front juntos, `Migração aplicada: 024_...` no log, `PUT /api/projetos/1/acesso` sem login = 404, gestão coloca na equipe quem ficou de fora).

## 7. Fora do escopo
- O resto da sessão 27 (27b).
- Campinho e visão "Alocação" (28).
- Mudar quem é diretor ou gerente, ou o que `projetos.verTodos` cobre fora de projetos.

## 8. Deixado a quem constrói
- Nome do código de erro e texto exato das mensagens (dizendo o motivo).
- Como o cartão aparece na ficha aberta pela URL (dentro do visual Halo, claro e escuro, responsivo).
- Ordem dos commits.
