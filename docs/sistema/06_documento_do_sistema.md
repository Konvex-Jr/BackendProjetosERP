# Documento do sistema: módulos, regras e quem vê e faz o quê (14/11/2026)

> **Sessão 17 (Biblioteca):** este documento descreve o sistema com a Biblioteca, implementada na branch `feat/biblioteca`.

> Um lugar só para entender o ERP da Konvex como ele está em produção. Junta o que estava espalhado no `docs/GUIA_DE_USO.md` e nos docs 02 a 04 desta pasta, e foi conferido no código (ADR-009: o código é a referência).
>
> - Para as pessoas que usam o sistema: `docs/GUIA_DE_USO.md`.
> - Tabelas e colunas: [04_modelo_de_dados.md](04_modelo_de_dados.md). Camadas e infraestrutura: [03_arquitetura.md](03_arquitetura.md).
> - **Mudou uma permissão ou regra de acesso? Atualize a seção 3 deste arquivo no mesmo PR.**

## 1. Como o acesso funciona

### Papéis
| Papel no sistema | No banco (`usuarios.perfil`) | Quem é |
|---|---|---|
| Diretor | `ADMIN` | Diretoria |
| Gerente | `MANAGER` | Gerência |
| Membro | `MEMBER` | Demais membros ativos |

"Gestão" = diretores e gerentes. Não há cadastro público: a gestão cria as contas.

**Trainee** (status `Trainee`, sessão 20) **tem login**, sempre com o papel **membro** (`exigirTraineeMembro` em `useCases/pessoas/dadosPessoa.ts`: trainee com outro papel é 400 `TRAINEE_SO_MEMBRO`). Enxerga o que o membro enxerga, **menos a Biblioteca** (sem item no menu, `semTrainee` em `modulos/registro.ts`; as rotas da Biblioteca e dos anexos de item respondem 403, `exigirNaoTrainee` em `permissoes.ts`) e **não lidera** projeto (`PUT /projetos/:codigo/lider` responde 400 `TRAINEE_NAO_LIDERA`). O status vem do banco a cada requisição, então virar Ativo vale na chamada seguinte. Trainee é **só a etapa de entrada**: a pessoa nasce Trainee (ou Ativa) e ninguém volta a ser trainee; mudar o status **para** Trainee é 400 `STATUS_TRAINEE_SO_NA_ENTRADA` (`AlterarStatusPessoa`).

### Duas camadas de permissão
1. **Ações do catálogo, por papel.** `source/shared/seguranca/catalogoPermissoes.ts` lista as ações (`projetos.editar`, `tarefas.atribuir`…) e o mapa `PERMISSOES_POR_PAPEL` diz quais cada papel tem. As rotas checam a ação, nunca o papel (`exigirPermissao` e `temPermissao` em `permissoes.ts`).
   - Diretor: todas as ações.
   - Gerente: todas, **menos** `pessoas.gerirDiretores`, `projetos.excluir` e `configuracoes.editar` (lista `DO_GESTOR`).
   - Membro: **nenhuma**. Tudo o que o membro faz vem da camada 2.
2. **Regras por item.** Para o que depende da relação da pessoa com o item (autor, responsável, líder, participante, área, instrutor), há uma regra por módulo em `source/shared/seguranca/`:

| Arquivo | Decide |
|---|---|
| `visibilidadeProjetos.ts` | Quais projetos a pessoa vê (`participaOuParticipou`, `acessoAoProjeto`, `exigirAcessoCompleto`, `podeGerirAcesso`, `projetosVisiveisPara`) |
| `regrasTarefa.ts` | Ver, organizar, mudar status e comentar em cada tarefa (`papelNoProjeto`, `regrasTarefa`) |
| `regrasBiblioteca.ts` | Quem lê e quem altera um item da Biblioteca, e quem pode usar sigilo e projeto (`podeVerItem`, `podeAlterarItem`, `exigirPodeUsarSigiloEProjeto`) |
| `regrasCapacitacao.ts` | Gestão de capacitações e acesso às avaliações (`podeGerirCapacitacoes`, `acessoAosFeedbacks`) |

### Detalhes que valem para tudo
- O papel é lido do banco **a cada requisição**, não do token: mudar o papel de alguém vale na chamada seguinte (`UsuarioAutenticado` em `permissoes.ts`).
- Papel desconhecido recebe lista vazia (na dúvida, nega: `permissoesDoPapel`).
- 401 sem login, 403 sem permissão. Itens que a pessoa nem pode saber que existem respondem **404**: item da Biblioteca que ela não lê, tarefa avulsa de outra pessoa, anexo de item que ela não lê, projeto sigiloso que ela não vê.
- A API devolve booleanos por item (`podeAlterar`, `podeGerir`, `podeInscrever`…) e a tela obedece. O menu vem de `GET /auth/permissoes`, montado por `menuDoUsuario` em `source/modulos/registro.ts`; o `Layout` do frontend só abre telas que vieram no menu.
- Login: 5 falhas bloqueiam aquele e-mail naquele IP, e 30 falhas bloqueiam o IP inteiro, por 15 minutos (429; `limiteTentativas.ts`, limites em `LoginUsuario.ts`). Sessão: JWT de 15 min + refresh de 7 dias.

## 2. Módulos e regras de negócio

Os módulos estão registrados em `source/modulos/registro.ts` (rotas, ações do catálogo e itens de menu). Ordem do menu: Dashboard, Tarefas, Projetos, Capacitações, Biblioteca, Visão Estratégica, Simular precificação, Pessoas, Configurações, Meu perfil.

### Pessoas (`/usuarios`, `/auth/*`, `/fotos`)
- A gestão cadastra, edita, muda o status e redefine a senha. Criar, editar ou promover **diretor** exige também `pessoas.gerirDiretores` (`exigirPodeGerirPerfil`).
- Ninguém altera o próprio papel nem o próprio status, nem inativa a própria conta.
- Criar pessoa: o status inicial é Ativo ou Trainee (`STATUS_INICIAL_INVALIDO` nos outros casos). Trainee com papel diferente de membro é 400 (`TRAINEE_SO_MEMBRO`), na criação e na edição. A lista de acesso de projeto sigiloso só aceita pessoas com login (`ACESSO_PESSOA_SEM_LOGIN`).
- Ninguém é excluído (ADR-006): `DELETE /usuarios/:codigo` só muda o status para Inativo. Quando alguém sai, as participações em projetos são encerradas e o histórico fica.
- Trocar área ou cargo grava histórico (`historico_areas`, `historico_cargos`).
- Cada pessoa edita no próprio perfil só contato e apresentação: nome de exibição, telefone, LinkedIn, GitHub, link do calendário, curso, semestre e bio (`PUT /auth/perfil`). E troca a própria senha e a própria foto.
- **Foto de perfil:** cada pessoa envia, troca e remove a própria foto (`PUT` e `DELETE /auth/foto`). O navegador recorta em quadrado e manda 256×256 em WebP (ou JPEG no Safari e no iPhone); o backend aceita JPEG, PNG ou WebP (confere a assinatura) de até 300 KB e regrava sempre em WebP 256×256 (`sharp`), sem metadados. O arquivo fica em `anexos/fotos/` com nome UUID e é servido em `GET /fotos/:arquivo`, **sem login** (nome impossível de adivinhar, cache longo). Trocar ou remover apaga o arquivo antigo; inativar a pessoa não mexe na foto (ninguém é excluído). Onde aparecem as iniciais, aparece a foto, se houver.
- **Links do perfil:** GitHub, LinkedIn e calendário aparecem como cartões com o logo oficial (calendário do Google com o logo do Google Agenda; outro calendário, ícone genérico).
- **Tecnologias saíram** (18/11, migração 016): sem tabelas, sem campo e sem tela. Se o corpo do `PUT /auth/perfil` ainda trouxer `tecnologias`, é ignorado.
- Todos os logados consultam a lista de pessoas e os perfis (links e foto visíveis). No perfil de outra pessoa, o membro vê só os projetos que os dois compartilham (`ObterPerfilPessoa`).
- O perfil mostra projetos atuais e anteriores, histórico de área e cargo, capacitações e horas cumpridas (só com presença marcada).

### Configurações (`/areas`, `/cargos`, `/senioridades`)
- Só o diretor cria e edita áreas (hierárquicas, com subáreas), cargos e senioridades (`configuracoes.editar`). Todos os logados leem as listas (servem aos formulários).
- A área **Inovação** não dá mais nenhum direito especial (desde a sessão 17). É só uma área como as outras.
- `valor_hora` da senioridade ainda é 0: a precificação pela API espera a diretoria definir as taxas.

### Projetos (`/projetos`)
- A gestão vê todos (`projetos.verTodos`). O membro vê só os projetos de que participa **ou participou**: quem saiu continua vendo o histórico.
- A gestão cria e edita, muda a situação (Em andamento, Atenção, Bloqueado, Concluído, Arquivado), monta a equipe (função, alocação, entrada e saída) e escolhe o líder (`projetos.editar`). Um líder por projeto, escolhido na equipe.
- O sistema avisa quando a alocação de alguém passa de 100%.
- **Projeto sigiloso (sessão 20).** Quem cria (`projetos.editar`) pode marcar `sigiloso: true` e já informar `acesso` (códigos de pessoas com login). Regra única em `acessoAoProjeto` (`visibilidadeProjetos.ts`):
  - **Vê completo:** diretor (`projetos.verSigilosos`), quem criou o projeto, quem está na lista de acesso (`projeto_acesso`) e a **equipe atual**. Quem saiu da equipe **perde** o acesso (no projeto normal, ex-membro continua vendo).
  - **Gerente fora:** vê só o **resumo** (`resumo: true`) em `GET /projetos` e `GET /projetos/:codigo`: nome, situação, datas, contagem de tarefas, equipe e alocação; nunca cliente, descrição nem tarefas. As demais rotas respondem 403 `PROJETO_SIGILOSO`. Na lista, filtro por pessoa, área e responsável não vale para o resumo, e a busca é só pelo nome.
  - **Membro ou trainee fora:** 404, na lista e nas rotas do projeto.
  - **Quem muda o sigilo e a lista de acesso:** diretor e quem criou (`podeGerirAcesso`; `PUT /projetos/:codigo/acesso` com `{ codigos }`; mudar `sigiloso` no `PUT /projetos/:codigo` por outra pessoa é 403 `SIGILO_SEM_PERMISSAO`). Gerente fora não edita nada do projeto.
  - **Tarefas:** sem acesso completo, ninguém tem papel no projeto, nem a gestão (`papelNoProjeto`, `regrasTarefa.ts`). Membro ou trainee fora recebe o mesmo 404 da tarefa inexistente ("Tarefa não encontrada."); o gerente fora, 403. Anexos dessas tarefas: 404 para todos que não veem, gerente fora inclusive (decisão: esconde mais e segue a sessão 19).
  - **Biblioteca:** itens ligados a sigiloso que a pessoa não vê completo somem para todos os papéis, gestão inclusive, e ninguém liga item a ele (`regrasBiblioteca.ts`).
- Só o diretor exclui projeto (`projetos.excluir`); excluir leva junto os itens da Biblioteca com sigilo "Equipe do projeto" (e os anexos deles); os itens de sigilo Todos ou Só gestão só perdem a ligação com o projeto. O recomendado é Arquivar.
- Ativos = Em andamento, Atenção e Bloqueado.

### Tarefas (`/tarefas`)
Toda tarefa tem **projeto** ou **categoria** (Inovação, Capacitação, Execução). Sem projeto, ela é "avulsa". Tarefas antigas ligadas a iniciativas perderam essa ligação (a migração 012 removeu a coluna). O acompanhamento de inovação é feito com tarefas avulsas de categoria Inovação, que continuam só da gestão.

**Quadro por etapa (sessão 21).** O quadro do projeto é por etapa, não por semana. Cada projeto tem de 2 a 12 colunas (tabela `colunas_projeto`, migração 015); projeto novo nasce com A fazer, Fazendo, Revisando e Concluído.
- Cada coluna tem nome (1 a 40 caracteres, sem repetir no projeto, sem diferenciar maiúsculas), cor (`cinza`, `azul`, `verde`, `amarelo`, `laranja`, `vermelho`, `roxo`, `rosa`) e papel: `entrada` (onde caem as tarefas novas), `meio` ou `concluida`. Exatamente uma `entrada` e uma `concluida`, em colunas diferentes; a concluída não precisa ser a última.
- **O status da tarefa de projeto vem sempre do papel da coluna:** `entrada` = `pendente`, `meio` = `andamento`, `concluida` = `concluida`. Progresso, burndown e indicadores seguem usando o status. Entrar na coluna concluída grava a data de conclusão (hoje) e quem moveu; sair apaga os dois. Tarefa avulsa não tem coluna.
- `PUT /projetos/:codigo/colunas` grava a lista inteira numa transação: `{ colunas: [{ codigo?, nome, cor, papel }], destinos: { "<coluna excluída>": "<coluna de destino>" } }`. Coluna excluída com tarefas exige destino; as tarefas movidas, ou de coluna cujo papel mudou, têm status e conclusão recalculados. Erros 400 dizem o campo e a coluna. Coluna enviada com código que não está mais no projeto (outra pessoa a excluiu), ou tarefa que caiu numa coluna excluída durante a gravação: 409 `QUADRO_MUDOU`, e a tela recarrega o quadro.
- `PATCH /tarefas/:codigo/coluna` move a tarefa (`{ codigoColuna }`); coluna de outro projeto ou tarefa avulsa dá 400. `PATCH /tarefas/:codigo/status` segue existindo: em tarefa de projeto, `concluida` vai para a coluna concluída, `pendente` para a de entrada e `andamento` para a primeira coluna `meio` (ou fica onde está, se já está numa); se o projeto não tem coluna `meio`, `andamento` cai na coluna de entrada (e a tarefa fica `pendente`). Mover exige a mesma permissão de concluir ou reabrir (responsável, líder ou gestão); sem ela, 403.
- A tela Tarefas (todos os projetos e avulsas) segue por semana, com um selo da etapa no cartão. O prazo da tarefa não depende da coluna.
- Regras: `source/useCases/projetos/GerirColunasProjeto.ts`, `source/useCases/tarefas/MoverTarefa.ts`, `regrasTarefa.ts`.

Tarefa de projeto, pelo papel da pessoa no projeto (`papelNoProjeto`):
| Papel no projeto | Pode |
|---|---|
| Gestão (`tarefas.gerirTodas`) ou líder | Tudo: criar, editar, atribuir, excluir, concluir ou reabrir qualquer tarefa, apagar qualquer comentário |
| Participante (equipe atual) | Criar (fica como único responsável), concluir ou reabrir as tarefas em que é responsável, comentar, apagar os próprios comentários |
| Ex-participante | Ler as tarefas e os comentários; não comenta |
| Nenhum | Só vê as tarefas em que é responsável |

Tarefa avulsa:
- Só a gestão cria, edita, reatribui e exclui (`tarefas.atribuir`); responsável pode ser qualquer pessoa ativa.
- O responsável vê, conclui ou reabre e comenta. Para os demais, a tarefa não existe (404).

Lista (`GET /tarefas`): a gestão recebe todas; o membro recebe as dos projetos de que participa ou participou e as que tem como responsável.

### Capacitações (`/capacitacoes`)
- Todos os logados veem a lista e a ficha, com média e número de avaliações.
- Só a gestão cria, edita, exclui, anexa material, marca presença e inscreve ou tira outra pessoa (`capacitacoes.gerir`).
- A própria pessoa se inscreve e cancela **até a hora de início**, se houver vaga. A gestão inscreve e tira a qualquer momento. A vaga é conferida no banco (inscrições simultâneas não estouram o limite).
- Presença só depois do início. Só quem teve presença marcada avalia (nota de 1 a 5, "bom" e "melhorar"); avaliar de novo substitui a anterior.
- Avaliações individuais: a gestão lê com o nome; quem ministrou lê sem o nome (ordenadas pela nota); os demais veem só a média (`acessoAosFeedbacks`).
- A lista de inscritos aparece só para a gestão e para quem ministra.
- Horas no perfil contam só com presença marcada.

### Biblioteca (`/biblioteca`)
Um módulo só no lugar de Gestão (pastas e documentos), Base de Inteligência e Iniciativas. Guarda o material da Konvex: pesquisas, decisões, aprendizados, documentos, ideias.
- **Item:** título (até 160 caracteres), texto em Markdown simples, links `http(s)://`, anexos, tags, um projeto (opcional) e o sigilo. O autor é quem cadastrou. A lista ordena pelo mais recente alterado. O formulário pede conteúdo, link ou arquivo; a API exige só o título.
- **Sigilo:** **Todos** (padrão), **Só gestão** ou **Equipe de um projeto** (exige projeto).
- **Quem lê:** a gestão lê tudo (`biblioteca.verTodos`). Os demais leem os itens de sigilo Todos e os de projeto de que participam **ou participaram**. Item que a pessoa não lê responde 404, na lista, na ficha, nos anexos e na aba do projeto.
- **Quem cria:** qualquer pessoa logada. Sigilo "Só gestão" só com `biblioteca.gerir`. Ligar a um projeto (em qualquer sigilo): a gestão liga qualquer um; o membro só liga projeto de que participa ou participou.
- **Quem edita e exclui:** o autor ou a gestão (`biblioteca.gerir`). As regras de sigilo e projeto só são conferidas quando esses campos **mudam** no salvar: quem saiu da equipe continua editando e excluindo o próprio item.
- **Projeto ligado que a pessoa não vê:** o item aparece sem projeto (`projeto` nulo), para não revelar o nome. Filtrar a lista por um projeto que a pessoa não vê devolve vazio.
- **Busca e filtros:** texto (título, conteúdo e tags) e filtros por tag, projeto, sigilo e autor. Tags e busca fazem o papel das antigas pastas e categorias.
- Na ficha do projeto, a aba **Biblioteca** mostra os itens daquele projeto que a pessoa pode ver.
- Saíram: pastas, categorias, tipos, status, responsável, frente, resultado e aprendizados. O acompanhamento de inovação passa a ser feito com tarefas avulsas de categoria Inovação.

### Anexos (`/anexos`, `/<dono>/:codigo/anexos`)
- Arquivos de itens da Biblioteca, de capacitações e de tarefas (sessão 19). Até 20 MB; PDF, Office, OpenDocument, CSV, TXT, MD, imagens e ZIP. Guardados no disco da VPS.
- **Cada anexo segue as regras do dono** (`GerirAnexos.acesso`): baixa quem lê o dono; envia e exclui quem altera o dono (exceto o dono tarefa, que tem regra própria, abaixo). Excluir o dono apaga os anexos dele. O download é enviado em fluxo (stream), com `Content-Disposition: attachment` e `nosniff`; a visualização de PDF e imagem é só do frontend.
- **Anexos de tarefa** (`POST` e `GET /tarefas/:codigo/anexos`; download e exclusão em `/anexos/:codigo`): ver e baixar = quem vê a tarefa (senão 404, em todas as rotas); anexar = `regrasTarefa().comentar` (equipe atual do projeto; na avulsa, responsável e gestão), senão 403; excluir = quem enviou ou `regrasTarefa().organizar` (líder e gestão; na avulsa, gestão), senão 403. Quem enviou e saiu da equipe ainda exclui o próprio, se ainda vê a tarefa. Regras em `source/shared/seguranca/regrasTarefa.ts` e `source/useCases/anexos/GerirAnexos.ts`. Excluir a tarefa ou o projeto apaga os anexos e os arquivos; as respostas de tarefa trazem `quantidadeAnexos`. O script `conferirAnexos` acha arquivos órfãos; com `--apagar-sem-registro` apaga os arquivos sem registro, menos os de menos de 10 minutos.

### Painel, Visão Estratégica e Precificação (só no frontend)
- **Dashboard**, para todos: tarefas abertas e atrasadas da pessoa, burndown e capacitações inscritas. A faixa com os **sete indicadores** (projetos ativos, em atenção, concluídos, membros ativos, capacitações próximas, tarefas da semana e atrasadas) aparece só com `projetos.verTodos` (`Dashboard.jsx`).
- **Visão Estratégica** (`estrategia.ver`) e **Simular precificação** (`precificacao.simular`): gestão. Não têm rota na API; o controle é o item de menu. A precificação calcula no navegador.

## 3. Matriz papel × o que vê e o que faz

Legenda: ✅ pode · ❌ não pode · texto = pode, com a condição. "Código" aponta a ação do catálogo (`catalogoPermissoes.ts`) ou a regra em `source/shared/seguranca/` que decide.

Trainee (status `Trainee`, papel sempre membro) segue a coluna **Membro** em todas as tabelas, com as exceções da tabela "Trainee" abaixo. Projetos sigilosos têm a tabela própria "Projeto sigiloso".

### Pessoas e configurações
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver lista de pessoas e perfis | ✅ | ✅ | ✅ | só login (`UsuarioRoutes`) |
| Ver projetos no perfil de outra pessoa | todos | todos | só os em comum | `projetos.verTodos` + `participaOuParticipou` |
| Editar o próprio contato e senha | ✅ | ✅ | ✅ | só login (`/auth/perfil`, `/auth/senha`) |
| Enviar, trocar e remover a própria foto | ✅ | ✅ | ✅ | só login (`/auth/foto`) |
| Ver a foto de qualquer pessoa | ✅ (endereço público) | ✅ | ✅ | `GET /fotos/:arquivo`, sem login |
| Cadastrar, editar, mudar status, redefinir senha de membro ou gerente | ✅ | ✅ | ❌ | `pessoas.gerir` (`exigirPodeGerirPerfil`) |
| O mesmo para diretores (ou promover a diretor) | ✅ | ❌ | ❌ | `pessoas.gerirDiretores` |
| Alterar o próprio papel ou status | ❌ | ❌ | ❌ | `UsuarioRoutes` (checagem explícita) |
| Criar e editar áreas, cargos, senioridades | ✅ | ❌ | ❌ | `configuracoes.editar` |

### Projetos
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver projetos (normais) | todos | todos | os que participa ou participou | `projetos.verTodos` / `visibilidadeProjetos.ts` |
| Criar, editar, mudar situação, montar equipe, escolher líder | ✅ | ✅ | ❌ | `projetos.editar` |
| Excluir projeto | ✅ | ❌ | ❌ | `projetos.excluir` |

### Projeto sigiloso
| Ação | Diretor | Gerente | Membro / trainee | Código |
|---|---|---|---|---|
| Ver completo (ficha, tarefas, equipe, Biblioteca) | todos | se criou, está na lista de acesso ou na equipe atual | se está na lista de acesso ou na equipe atual (ex-membro: não) | `projetos.verSigilosos` / `acessoAoProjeto` |
| Ver só o resumo (nome, situação, datas, contagem de tarefas, equipe e alocação) | — (vê completo) | se é gerente fora (demais rotas: 403) | ❌ (404) | `acessoAoProjeto` = `resumo` / `ProjetoRoutes.paraResposta` |
| Criar projeto sigiloso e definir a lista de acesso inicial | ✅ | ✅ | ❌ | `projetos.editar` (`POST /projetos`) |
| Mudar sigilo e lista de acesso | todos | se criou o projeto | ❌ | `podeGerirAcesso` / `projetos.verSigilosos` |
| Ver item da Biblioteca ligado ao sigiloso | só se vê completo | só se vê completo | trainee: sem Biblioteca; membro: só se vê completo | `regrasBiblioteca.ts` (sigiloso oculto) |
| Tarefa do sigiloso (ver, editar, status, comentários) | ✅ | se vê completo (fora: 403) | se vê completo (fora: 404 igual ao da tarefa inexistente) | `regrasTarefa.ts` / `TarefaRoutes.carregar` |
| Anexos de tarefa do sigiloso | ✅ | se vê completo (fora: **404**, não 403) | se vê completo (fora: 404) | `regrasTarefa().ver` / `GerirAnexos.acesso` |

Anexo de tarefa de sigiloso responde 404 também ao gerente fora, por decisão: esconde mais que o 403 das outras rotas e segue a regra dos anexos de tarefa da sessão 19 (quem não vê a tarefa recebe 404).

### Trainee
| Ação | Trainee | Código |
|---|---|---|
| Entrar no sistema | ✅ (papel membro) | `exigirTraineeMembro` (`dadosPessoa.ts`) |
| Ver projetos da equipe e as tarefas deles, as próprias avulsas, o próprio perfil, a lista de pessoas, capacitações e o Dashboard | ✅ (como membro) | `participaOuParticipou`, `regrasTarefa()`; menu em `registro.ts` |
| Biblioteca (menu, itens, anexos de item) | ❌ (403, sem item no menu) | `semTrainee` (`registro.ts`), `exigirNaoTrainee` (`BibliotecaRoutes`, `GerirAnexos`) |
| Ser líder de projeto | ❌ (400 `TRAINEE_NAO_LIDERA`) | `PUT /projetos/:codigo/lider` |
| Voltar a ser trainee depois de mudar de status | ❌ (400 `STATUS_TRAINEE_SO_NA_ENTRADA`) | `AlterarStatusPessoa` |

### Tarefas
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver tarefas de projeto | todas | todas | dos seus projetos (atuais e anteriores) e as que é responsável | `projetos.verTodos` + `regrasTarefa().ver` |
| Criar tarefa em projeto | ✅ | ✅ | se é da equipe atual (fica responsável) | `tarefas.gerirTodas` / `papelNoProjeto` |
| Editar, atribuir, excluir tarefa de projeto | ✅ | ✅ | se é líder do projeto | `regrasTarefa().organizar` |
| Concluir ou reabrir tarefa de projeto | ✅ | ✅ | se é líder, ou participante e responsável | `regrasTarefa().mudarStatus` |
| Mover tarefa de projeto entre as colunas | ✅ | ✅ | se é líder, ou participante e responsável (mesma regra de concluir e reabrir) | `PATCH /tarefas/:codigo/coluna` / `regrasTarefa().mudarStatus` |
| Editar as colunas do quadro do projeto (criar, renomear, reordenar, cor, papel, excluir) | ✅ | ✅ | se é líder do projeto | `PUT /projetos/:codigo/colunas` / `papelNoProjeto` = `gestao` ou `lider` (sem ação nova no catálogo) |
| Ver as colunas do projeto | todas | todas (sigiloso fora: não vê) | dos projetos que vê por completo | acesso completo (`acessoAoProjeto`) |
| Comentar em tarefa de projeto | ✅ | ✅ | se é da equipe atual | `regrasTarefa().comentar` |
| Ver e baixar anexo de tarefa | ✅ | ✅ | se vê a tarefa (senão 404) | `regrasTarefa().ver` / `GerirAnexos.acesso` |
| Anexar arquivo na tarefa | ✅ | ✅ | se é da equipe atual (avulsa: se é responsável) | `regrasTarefa().comentar` / `GerirAnexos.acesso` |
| Excluir anexo de tarefa | ✅ | ✅ | o que enviou, ou se é líder (avulsa: só o que enviou) | autor ou `regrasTarefa().organizar` / `GerirAnexos.acesso` |
| Apagar comentário | qualquer | qualquer | os próprios (líder: qualquer do projeto) | `TarefaRoutes` + `regrasTarefa().organizar` |
| Criar, editar, reatribuir, excluir tarefa avulsa | ✅ | ✅ | ❌ | `tarefas.atribuir` (`podeAtribuirAvulsas`) |
| Ver, concluir e comentar tarefa avulsa | todas | todas | só as que é responsável | `regrasTarefa()` (ramo avulsa) |

### Capacitações
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver lista, ficha, média e material | ✅ | ✅ | ✅ | só login (`GerirCapacitacoes.listar`) |
| Criar, editar, excluir, anexar material | ✅ | ✅ | ❌ | `capacitacoes.gerir` |
| Inscrever-se e cancelar | a qualquer hora | a qualquer hora | até o início, com vaga | `GerirCapacitacoes.inscrever/cancelar` |
| Inscrever ou tirar outra pessoa | ✅ | ✅ | ❌ | `capacitacoes.gerir` |
| Ver inscritos | ✅ | ✅ | se ministra | `podeGerirCapacitacoes` / `ehInstrutor` |
| Marcar presença (depois do início) | ✅ | ✅ | ❌ | `capacitacoes.gerir` |
| Avaliar | se presente | se presente | se presente | `GerirCapacitacoes.avaliar` (presença) |
| Ler avaliações individuais | com nome | com nome | sem nome, se ministrou | `acessoAosFeedbacks` |

### Biblioteca
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ler itens | todos | todos | sigilo Todos e os dos seus projetos (atuais e anteriores) | `biblioteca.verTodos` / `podeVerItem` |
| Cadastrar item | ✅ | ✅ | ✅ | só login (`SalvarItemBiblioteca`) |
| Usar sigilo "Só gestão" | ✅ | ✅ | ❌ | `biblioteca.gerir` (`exigirPodeUsarSigiloEProjeto`) |
| Ligar item a projeto | qualquer | qualquer | os que participa ou participou | `biblioteca.gerir` / `exigirPodeUsarSigiloEProjeto` |
| Editar e excluir item e seus anexos | ✅ | ✅ | se é o autor | `biblioteca.gerir` / `podeAlterarItem` |
| Ver o nome do projeto ligado | ✅ | ✅ | só dos projetos que vê (senão, sem projeto) | `projetos.verTodos` / `podeVerProjetoDoItem` |
| Baixar anexo | ✅ | ✅ | se lê o item | `GerirAnexos.acesso` |
| Enviar e excluir anexo | ✅ | ✅ | se edita o item | `GerirAnexos.acesso` |

Perdas da sessão 17: a área **Inovação** não cria mais nada de forma especial; tarefa avulsa (inclusive de Inovação) continua só da gestão (`tarefas.atribuir`); ideias de quem é da área entram como itens da Biblioteca (sugestão: tag `inovacao`).

### Painel e telas da gestão
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Dashboard pessoal | ✅ | ✅ | ✅ | menu sem permissão (`registro.ts`) |
| Sete indicadores no Dashboard | ✅ | ✅ | ❌ | `projetos.verTodos` (`Dashboard.jsx`) |
| Visão Estratégica | ✅ | ✅ | ❌ | `estrategia.ver` (menu) |
| Simular precificação | ✅ | ✅ | ❌ | `precificacao.simular` (menu) |

## 4. Registro da decisão de 14/11/2026 (sessão 17)

Gestão (documentos), Base de Inteligência e Iniciativas guardavam o mesmo tipo de material, com três regras de acesso diferentes. A gestão decidiu **simplificar**: viraram a **Biblioteca**, com uma regra de leitura (sigilo por item) e uma de escrita (autor ou gestão).
- **Dados antigos descartados:** pastas, documentos, itens da Base, iniciativas, ligações e anexos deles. O usuário decidiu começar do zero; a migração 012 apaga tudo e exige backup do banco e da pasta de anexos antes da publicação.
- **Área Inovação perdeu o direito especial** de criar. Tarefa avulsa continua só da gestão.
- **Tarefas** perderam a ligação com iniciativa.
- Spec: `docs/superpowers/specs/2026-11-14-biblioteca-design.md`.

## 4.1. Registro da sessão 22 (foto e links do perfil)

A pessoa passou a ter **foto de perfil** (no lugar do campo `avatar_url`) e os links do perfil ganharam cartões com logo. As **tecnologias** (tabelas `habilidades` e `usuario_habilidades`) saíram do sistema: a migração 016 apaga esses dados, que só voltam do backup anterior à publicação. A foto não cria ação nova no catálogo de permissões (basta estar logado).
- Spec: `docs/superpowers/specs/2026-11-18-perfil-design.md`.

## 5. O que ainda não existe
Homologação, auditoria (quem mudou o quê), LGPD e retenção, precificação pela API, Google Calendar, e-mails, busca global, Board Tático, CRM. Ver o `.konvex/roteiro.md` (fases 6 e 7).
