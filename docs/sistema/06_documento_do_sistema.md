# Documento do sistema: módulos, regras e quem vê e faz o quê (14/11/2026)

> **Sessão 17 (Biblioteca):** este documento descreve o sistema com a Biblioteca, implementada na branch `feat/biblioteca`.

> Um lugar só para entender o ERP da Konvex como ele está em produção. Junta o que estava espalhado no `docs/GUIA_DE_USO.md` e nos docs 02 a 04 desta pasta, e foi conferido no código (ADR-009: o código é a referência).
>
> - Para as pessoas que usam o sistema: `docs/GUIA_DE_USO.md`.
> - Tabelas e colunas: [04_modelo_de_dados.md](04_modelo_de_dados.md). Camadas e infraestrutura: [03_arquitetura.md](03_arquitetura.md).
> - **Mudou uma permissão ou regra de acesso? Atualize a seção 3 deste arquivo no mesmo PR.**

## 1. Como o acesso funciona

### Cargos e permissões (sessão 31a)
Não há mais perfil fixo (diretor/gerente/membro). **O que cada pessoa pode vem do cargo** do seu período aberto na área (uma pessoa tem no máximo um período com cargo por vez, desde a 24a):

- Cada cargo tem uma **posição** (1 = presidente; menor = mais alto; vários cargos podem dividir a posição, como os gerentes) e a **lista de permissões** do catálogo (`source/shared/seguranca/catalogoPermissoes.ts`, 29 ações com rótulo e grupo).
- Quem não tem cargo recebe o conjunto **"Sem cargo"**; quem tem status **Trainee** recebe o conjunto **"Trainee"** (mesmo que tenha cargo). Fora da EJ: nada.
- O cargo do **presidente** (posição 1) sempre pode tudo, fica sempre na posição 1, ativo e com alguém num período aberto (`PRESIDENTE_VAGO`).
- A gestão muda tudo na **grade** de Configurações → Permissões (`GET/PUT /permissoes`, `GerirPermissoes`), com a **hierarquia** (`hierarquia.ts`): cada um só altera cargos **abaixo** do seu, só liga permissões que ele mesmo tem, só dá a outra pessoa cargo abaixo do seu e só gere pessoas cujo cargo está abaixo do seu. O próprio cadastro e os próprios períodos, só o presidente altera. Só o presidente mexe nos diretores (decisão do usuário, 26/11).
- As permissões são lidas do banco **a cada requisição** (`permissoesEfetivas.ts`, chamado pelo `AuthExpress`): mudar a grade vale no clique seguinte.

Padrões da migração 030 (cada cargo recebeu as permissões do perfil mais baixo de quem o ocupava): **diretor** = todas; **gerente** = todas menos abrir todos os projetos, excluir projeto, dados do cliente, liderar todas as áreas, Configurações e Permissões (gerente abre só os projetos **da área do seu cargo**); **membro / Sem cargo** = ver Projetos, Tarefas, agenda e Capacitações, liderar projeto, criar reunião e usar a Biblioteca; **Trainee** = o do membro sem liderar e sem Biblioteca. Nas tabelas da seção 3, as colunas Diretor / Gerente / Membro são esses padrões.

**Trainee** (status `Trainee`, sessão 20) tem login. O status vem do banco a cada requisição. Trainee é **só a etapa de entrada**: mudar o status **para** Trainee é 400 `STATUS_TRAINEE_SO_NA_ENTRADA` (`AlterarStatusPessoa`).

### Duas camadas de permissão
1. **Ações do catálogo, pelo cargo.** As rotas checam a ação, nunca o cargo (`exigirPermissao` e `temPermissao` em `permissoes.ts`, que leem `usuario.permissoes`).
2. **Regras por item.** Para o que depende da relação da pessoa com o item (autor, responsável, líder, participante, equipe, instrutor), há uma regra por módulo em `source/shared/seguranca/`; essas ficam fixas no código (decisão do usuário, 26/11):

| Arquivo | Decide |
|---|---|
| `visibilidadeProjetos.ts` | Quem abre cada projeto (`acessoAoProjeto`, `exigirAcessoCompleto`, `exigirNaoSeTrancar`) |
| `regrasTarefa.ts` | Ver, organizar, editar, mudar status e comentar em cada tarefa (`papelNoProjeto`, `regrasTarefa`) |
| `regrasBiblioteca.ts` | Quem lê e quem altera um item da Biblioteca, e quem pode usar sigilo e projeto (`podeVerItem`, `podeAlterarItem`, `exigirPodeUsarSigiloEProjeto`) |
| `regrasCapacitacao.ts` | Gestão de capacitações e acesso às avaliações (`podeGerirCapacitacoes`, `acessoAosFeedbacks`) |
| `hierarquia.ts` | Quem mexe em quais cargos, pessoas e períodos |

### Detalhes que valem para tudo
- Permissões e cargo são lidos do banco **a cada requisição**, não do token. Pessoa sem lista de permissões recebe nada (na dúvida, nega).
- 401 sem login, 403 sem permissão. Itens que a pessoa nem pode saber que existem respondem **404**: item da Biblioteca que ela não lê, tarefa de projeto que ela não abre, anexo de item que ela não lê. O projeto em si não some: quem não vê completo recebe só o cartão (nome, tipo, área do interno, situação, líder e equipe atual); as demais rotas do projeto respondem 403 `PROJETO_SEM_ACESSO`.
- A API devolve booleanos por item (`podeAlterar`, `podeGerir`, `podeInscrever`…) e a tela obedece. O menu vem de `GET /auth/permissoes`, montado por `menuDoUsuario` em `source/modulos/registro.ts`; o `Layout` do frontend só abre telas que vieram no menu.
- Login: 5 falhas bloqueiam aquele e-mail naquele IP, e 30 falhas bloqueiam o IP inteiro, por 15 minutos (429; `limiteTentativas.ts`, limites em `LoginUsuario.ts`). Sessão: JWT de 15 min + refresh de 7 dias.

## 2. Módulos e regras de negócio

Os módulos estão registrados em `source/modulos/registro.ts` (rotas, ações do catálogo e itens de menu). Ordem do menu: Dashboard, Tarefas, Projetos, Capacitações, Biblioteca, Visão Estratégica, Simular precificação, Pessoas, Configurações, Meu perfil.

### Pessoas (`/usuarios`, `/auth/*`, `/fotos`)
- A gestão cadastra, edita, muda o status e **reenvia o link de senha**; ninguém vê nem define a senha de outra pessoa (`PUT /usuarios/:codigo/senha` saiu na 25a). Criar, editar ou promover **diretor** exige também `pessoas.gerirDiretores` (`exigirPodeGerirPerfil`).
- **Conta e senha (sessão 25a, migração 021):** a pessoa nasce sem senha e recebe um **convite** por e-mail (`POST /usuarios`; reenvio em `POST /usuarios/:codigo/link-senha`, que vira redefinição quando já há senha). Quem cria a senha é ela, pelo link (`GET/POST /auth/link-senha/:token`, público).
  - Link: token aleatório guardado só como hash, **uso único**, convite 72 h e redefinição 1 h. Link novo do mesmo tipo invalida os anteriores; usar um link invalida todos os da pessoa e revoga as sessões. O link vai só por e-mail: nunca na resposta da API nem em log de produção (`GerirLinkSenha`, `EnvioEmail*`).
  - `POST /auth/esqueci-senha` (público, com limite por IP) responde sempre a mesma mensagem, 200, exista ou não o e-mail.
  - Regra da senha nova (link e `PUT /auth/senha`): 8+ caracteres, maiúscula, número e caractere especial. O login não confere (senhas antigas entram).
  - E-mail de pessoa nova ou alterado tem de terminar em `@${EMAIL_DOMINIO}` (sem a variável, não confere).
  - "Manter conectado": cookie `konvex_lembrar` (`HttpOnly`, `SameSite=Strict`, `Secure` em produção, caminho `COOKIE_CAMINHO`), 15 dias do login, sem renovar o prazo. `POST /auth/retomar` troca o cookie por sessão nova e cookie novo; reapresentar um cookie (ou refresh) já girado encerra todas as sessões da pessoa (duas chamadas simultâneas com o mesmo token também, `girar` devolve se marcou); token revogado por logout, troca de senha, link de senha ou inativação só recebe 401 (coluna `refresh_tokens.girado`, migração 021).
- Ninguém altera o próprio papel nem o próprio status, nem inativa a própria conta.
- **Sessão 25b (migração 022):** o status **Alumni deixou de existir** (a 022 converteu em Inativo com `motivo_saida = 'Alumni'`); só `ativo`, `trainee`, `inativo`. **Motivo da saída**: obrigatório ao mudar **para** Inativo (`PATCH /usuarios/:codigo/status` e `DELETE`; 400 `MOTIVO_SAIDA_OBRIGATORIO`, até 500 caracteres, `MOTIVO_SAIDA_LONGO`); Inativo para Inativo (corrigir a data) não pede de novo; voltar a Ativo apaga motivo e data; sem motivo aparece "Não informado". **Fim do trainee** (`fim_trainee`): gravado com a data de hoje na troca Trainee para Ativo; só a gestão o edita (`PUT /usuarios/:codigo`, `exigirPodeGerirPerfil`), nunca a própria pessoa; não antes da entrada nem no futuro. **E-mail pessoal** (opcional, até 254, `EMAIL_PESSOAL_INVALIDO`): visível a todos; edita a própria pessoa (`PUT /auth/perfil`) ou a gestão. **Curso** (só os quatro cursos: Análise e Desenvolvimento de Sistemas (desde a migração 028), Ciência da Computação, Engenharia Elétrica e Engenharia Mecânica; obrigatório na criação) e **telefone** (10 ou 11 dígitos, `TELEFONE_INVALIDO`) são conferidos **só quando o campo muda**: pessoa antiga com valor fora da regra edita outros campos normalmente; editam a pessoa e a gestão. **Ingresso na faculdade** (`ingresso`, `AAAA/1` ou `AAAA/2`, de 2000 até o semestre atual, `INGRESSO_INVALIDO`; substitui o semestre, que saiu; também só conferido quando muda). **Perfil obrigatório**: curso, telefone, e-mail pessoal, ingresso e link do calendário; a API devolve `pendenciasPerfil` (lista de campos faltando, `[]` para inativo) em `GET /auth/me`, `PUT /auth/perfil`, login, retomar e criar senha, e a **tela** bloqueia até completar (o back só informa, não bloqueia rotas).
- Criar pessoa: o status inicial é Ativo ou Trainee (`STATUS_INICIAL_INVALIDO` nos outros casos). Trainee com papel diferente de membro é 400 (`TRAINEE_SO_MEMBRO`), na criação e na edição.
- Ninguém é excluído (ADR-006): `DELETE /usuarios/:codigo` só muda o status para Inativo (o corpo traz `motivoSaida`). Quando alguém sai, as participações em projetos são encerradas e o histórico fica.
- **Áreas e cargos por período** (sessão 23a, migração 017): a pessoa pode estar em várias áreas ao mesmo tempo, cada uma com um cargo opcional e um período `[início, fim)` (fim vazio = atual). A pessoa não grava mais área nem cargo; as "áreas atuais" (`areas` na resposta) são os períodos em aberto. Se uma tela antiga ainda mandar `codigoArea` ou `codigoCargo` no `PUT /usuarios/:codigo`, os campos são ignorados.
  - A gestão lança, corrige e exclui períodos em `/usuarios/:codigo/periodos` (mesma regra de editar a pessoa: `exigirPodeGerirPerfil`; ninguém altera os próprios períodos, exceto o diretor). Todos os logados leem.
  - Regras (400 com código): nenhuma data no futuro (`INICIO_NO_FUTURO`, `FIM_NO_FUTURO`); fim depois do início (`FIM_NAO_DEPOIS_DO_INICIO`); dois períodos da mesma pessoa na mesma área não se sobrepõem (`PERIODO_SOBREPOSTO`, garantido também pelo banco em gravações simultâneas); só área e cargo ativos ao escolher (`AREA_INATIVA`, `CARGO_INATIVO`; corrigir só as datas de um período antigo com área desativada continua permitido); período em aberto só para quem está na EJ (`PESSOA_FORA_DA_EJ`); fim não passa da saída da pessoa (`FIM_DEPOIS_DA_SAIDA`).
  - Quem sai da EJ (Inativo) tem os períodos em aberto **sempre** encerrados na data de saída, mesmo quando a gestão escolhe manter as participações nos projetos. Quem volta a Ativo não reabre nada: a gestão lança um período novo.
- Cada pessoa edita no próprio perfil só contato e apresentação: nome de exibição, telefone, e-mail pessoal, LinkedIn, GitHub, link do calendário, curso, ingresso na faculdade, data de entrada na EJ (desde 25/11; não no futuro, 400 `ENTRADA_NO_FUTURO`, conferida só quando muda) e bio (`PUT /auth/perfil`). Períodos de área e cargo seguem com a gestão. E troca a própria senha e a própria foto.
- **Foto de perfil:** cada pessoa envia, troca e remove a própria foto (`PUT` e `DELETE /auth/foto`). O navegador recorta em quadrado e manda 256×256 em WebP (ou JPEG no Safari e no iPhone); o backend aceita JPEG, PNG ou WebP (confere a assinatura) de até 300 KB e regrava sempre em WebP 256×256 (`sharp`), sem metadados. O arquivo fica em `anexos/fotos/` com nome UUID e é servido em `GET /fotos/:arquivo`, **sem login** (nome impossível de adivinhar, cache longo). Trocar ou remover apaga o arquivo antigo; inativar a pessoa não mexe na foto (ninguém é excluído). Onde aparecem as iniciais, aparece a foto, se houver.
- **Links do perfil:** GitHub, LinkedIn e calendário aparecem como cartões com o logo oficial (calendário do Google com o logo do Google Agenda; outro calendário, ícone genérico).
- **Tecnologias saíram** (18/11, migração 016): sem tabelas, sem campo e sem tela. Se o corpo do `PUT /auth/perfil` ainda trouxer `tecnologias`, é ignorado.
- Todos os logados consultam a lista de pessoas e os perfis (links e foto visíveis). No perfil de outra pessoa, o membro vê só os projetos que os dois compartilham (`ObterPerfilPessoa`).
- O perfil mostra projetos atuais e anteriores, os períodos nas áreas (abertos primeiro), capacitações e horas cumpridas (só com presença marcada). A resposta traz `podeGerirPeriodos` para a tela mostrar os botões.

### Configurações (`/areas`, `/cargos`, `/senioridades`)
- Só o diretor cria e edita áreas (hierárquicas, com subáreas), cargos e senioridades (`configuracoes.editar`). Todos os logados leem as listas (servem aos formulários).
- Área tem a opção **Projeto geral** (`temGeral`, desde a 24b, migração 020; padrão ligada). Desligar exclui o geral da área se ele não tem tarefas; com tarefas, 409 `GERAL_COM_TAREFAS` e nada muda. Religar cria um geral novo e vazio. Área sem geral não quebra listas nem ocupação.
- A área **Inovação** não dá mais nenhum direito especial (desde a sessão 17). É só uma área como as outras.
- Cargo tem a marca **"Lidera a área"** (`lideraArea`, desde a 23a). A migração 017 marcou os cargos cujo nome começa com "Gerente" ou "Diretor"; o diretor confere em Configurações.
- **Liderança de área (regra provisória; as lideranças da EJ vão decidir a definitiva, 18/11/2026):** lidera uma área quem tem o papel diretor do sistema, ou um período em aberto com cargo que lidera nessa área ou em alguma acima dela (subindo pela área pai). Fica toda em `source/shared/seguranca/liderancaArea.ts`. Na 23a ela só existe e é testada; quem a usa é a 23b (projeto geral e projetos internos).
- `valor_hora` da senioridade ainda é 0: a precificação pela API espera a diretoria definir as taxas.

### Projetos (`/projetos`)
- Todos veem **todos** os projetos na lista: completo ou só o **cartão** (sessão 27a). **Sessão 31a: todo projeto é fechado.** Abre por inteiro (`acessoAoProjeto` = `completo`) quem participa **ou participou** da equipe (quem saiu não perde o acesso), quem tem `projetos.abrirTodos`, quem tem `projetos.abrirDaArea` e período com cargo na área do projeto (só a própria área, sem subáreas; projeto sem área só abre para a equipe e quem abre todos), o líder da área no projeto geral e, no projeto geral, todo logado. Os demais veem o cartão (`cartao: true`): `codigo`, `nome`, `tipo`, `area` (só de projeto interno), `status`, `lider`, `membros` (equipe atual: código, nome e foto) e `geralDaArea`. O projeto só tem **líder** (o campo responsável saiu na 27b); o líder pode ser escolhido já na criação (`codigoLider`: ativo na EJ, com `projetos.liderar`; entra na equipe junto). Quem cria precisa abrir o que cria (400 `SEM_ACESSO_AO_CRIAR`).
- A gestão cria e edita, muda a situação (Em andamento, Atenção, Bloqueado, Concluído, Arquivado), monta a equipe (função, alocação, entrada e saída) e escolhe o líder (`projetos.editar`). Um líder por projeto, escolhido na equipe.
- O sistema avisa quando a alocação de alguém passa de 100%.
- **Projeto sigiloso: saiu na sessão 31a** (migração 030 apaga `projetos.sigiloso`). Todo projeto passou a ser fechado pela regra acima. **Tarefas:** sem acesso completo, ninguém tem papel no projeto, nem a gestão (`papelNoProjeto`). Tarefa, comentários e anexos de projeto que a pessoa não abre respondem o mesmo 404 da tarefa inexistente.
- Só o diretor exclui projeto (`projetos.excluir`); excluir leva junto os itens da Biblioteca com sigilo "Equipe do projeto" (e os anexos deles); os itens de sigilo Todos ou Só gestão só perdem a ligação com o projeto. O recomendado é Arquivar.
- Ativos = Em andamento, Atenção e Bloqueado.
- **Clientes, classe e área (sessão 31b).** `clientes` é uma lista (até 10) de `{ nome, empresa, telefone, email }`; nome obrigatório, telefone de 10 a 13 dígitos, e-mail válido (400 dizendo qual cliente). Quem abre o projeto recebe nome e empresa; telefone e e-mail só com `clientes.ver`; mandar `clientes` no POST/PUT sem `clientes.ver` = 403. `codigoClasse` (tabela `classes_projeto`, editável em Configurações com `config.estrutura`) é obrigatório ao criar (400 `CLASSE_OBRIGATORIA`) e área é obrigatória no projeto de cliente ao criar (400 `AREA_OBRIGATORIA_CLIENTE`); na edição, as duas só são conferidas quando mudam. O cartão ganhou `progresso` (% de tarefas concluídas) e `classe` (nome). A busca acha pelo nome e pela empresa do cliente, nunca pelo telefone ou e-mail.
- **Projeto interno (sessão 23b).** `tipo` é `cliente` (padrão) ou `interno`; outro valor é 400 `TIPO_PROJETO_INVALIDO`. Interno sempre tem área (400 `AREA_OBRIGATORIA_INTERNO`). `GET /projetos?tipo=interno|cliente` filtra.
- **Projeto geral da área.** Um por área (`geralDaArea`), nome "Área geral", interno. Criado pelo sistema (migração 018 para as áreas existentes e `SalvarArea` para as novas); renomear a área renomeia o geral, inativar arquiva e reativar volta a Em andamento. A equipe e a liderança não são gravadas: vêm dos períodos da área e da `liderancaArea`. Editar, excluir, mudar status, acesso, equipe e líder do geral é 400 `PROJETO_GERAL_FIXO`; só `PUT /projetos/:codigo/colunas` segue valendo. As tarefas que eram avulsas moram nele.

### Tarefas (`/tarefas`)
Toda tarefa tem **projeto** (sessão 23b). A tarefa avulsa (sem projeto, com categoria) acabou: a migração 018 levou as avulsas para o **projeto geral da área** da categoria, e `POST /tarefas` sem `codigoProjeto` responde 400 `PROJETO_OBRIGATORIO` para todos (antes da checagem de permissão); `categoria` no corpo ou na consulta é ignorada. Tarefas antigas ligadas a iniciativas perderam essa ligação (a migração 012 removeu a coluna).

**Projeto geral da área (sessão 23b).** Cada área tem um projeto interno geral. A equipe dele não é montada à mão: vem dos períodos **abertos** na área (desde 25/11 quem saiu da área não aparece como ex-participante: o geral é aberto a todos, então o histórico não dá acesso). Todo logado vê o geral completo e as tarefas dele (`GET /tarefas?codigoProjeto=` devolve todas as tarefas do projeto que a pessoa vê completo); criar e mover tarefas continua com a área e a liderança. Quem tem cargo que lidera a área (`lideresDaArea`, regra de `liderancaArea.ts`) conta como **líder** do geral, mesmo com papel membro: vê tudo (`acessoAoProjeto` = `completo`), cria tarefa para qualquer pessoa da equipe, edita, move, exclui e organiza o quadro. Como não está na equipe, não entra como responsável (400 `RESPONSAVEL_FORA_DO_PROJETO`).

**Quadro por etapa (sessão 21).** O quadro do projeto é por etapa, não por semana. Cada projeto tem de 2 a 12 colunas (tabela `colunas_projeto`, migração 015); projeto novo nasce com A fazer, Fazendo, Revisando e Concluído.
- Cada coluna tem nome (1 a 40 caracteres, sem repetir no projeto, sem diferenciar maiúsculas), cor (`cinza`, `azul`, `verde`, `amarelo`, `laranja`, `vermelho`, `roxo`, `rosa`) e papel: `entrada` (onde caem as tarefas novas), `meio` ou `concluida`. Exatamente uma `entrada` e uma `concluida`, em colunas diferentes; a concluída não precisa ser a última.
- **O status da tarefa de projeto vem sempre do papel da coluna:** `entrada` = `pendente`, `meio` = `andamento`, `concluida` = `concluida`. Progresso, burndown e indicadores seguem usando o status. Entrar na coluna concluída grava a data de conclusão (hoje) e quem moveu; sair apaga os dois.
- `PUT /projetos/:codigo/colunas` grava a lista inteira numa transação: `{ colunas: [{ codigo?, nome, cor, papel }], destinos: { "<coluna excluída>": "<coluna de destino>" } }`. Coluna excluída com tarefas exige destino; as tarefas movidas, ou de coluna cujo papel mudou, têm status e conclusão recalculados. Erros 400 dizem o campo e a coluna. Coluna enviada com código que não está mais no projeto (outra pessoa a excluiu), ou tarefa que caiu numa coluna excluída durante a gravação: 409 `QUADRO_MUDOU`, e a tela recarrega o quadro.
- `PATCH /tarefas/:codigo/coluna` move a tarefa (`{ codigoColuna }`); coluna de outro projeto dá 400. `PATCH /tarefas/:codigo/status` segue existindo: em tarefa de projeto, `concluida` vai para a coluna concluída, `pendente` para a de entrada e `andamento` para a primeira coluna `meio` (ou fica onde está, se já está numa); se o projeto não tem coluna `meio`, `andamento` cai na coluna de entrada (e a tarefa fica `pendente`). Mover exige a mesma permissão de concluir ou reabrir (responsável, líder ou gestão); sem ela, 403.
- A tela Tarefas (todos os projetos) segue por semana, com um selo da etapa no cartão. O prazo da tarefa não depende da coluna.
- Regras: `source/useCases/projetos/GerirColunasProjeto.ts`, `source/useCases/tarefas/MoverTarefa.ts`, `regrasTarefa.ts`.

Tarefa de projeto, pelo papel da pessoa no projeto (`papelNoProjeto`):
| Papel no projeto | Pode |
|---|---|
| Gestão (`tarefas.gerirTodas`) ou líder (no geral, quem lidera a área) | Tudo: criar, editar, atribuir, excluir, concluir ou reabrir qualquer tarefa, apagar qualquer comentário |
| Participante (equipe atual) | Criar (fica como único responsável), concluir ou reabrir as tarefas em que é responsável, comentar, apagar os próprios comentários |
| Ex-participante | Ler as tarefas e os comentários; não comenta |
| Nenhum | Só vê as tarefas em que é responsável |

Responsável que já estava na tarefa continua ao editar, mesmo fora da equipe (caso das avulsas migradas com responsável de outra área); quem entra precisa estar na equipe.

Lista (`GET /tarefas`): a gestão recebe todas; o membro recebe as dos projetos de que participa ou participou (no geral, pelos períodos na área ou por liderar a área) e as que tem como responsável. Com `codigoProjeto` de um projeto que vê completo (ex.: o geral de outra área), recebe todas as tarefas dele.

### Capacitações (`/capacitacoes`)
- Todos os logados veem a lista e a ficha, com média e número de avaliações.
- Só a gestão cria, edita, exclui, anexa material e inscreve ou tira outra pessoa (`capacitacoes.gerir`).
- Chamada (presença): a gestão ou quem ministra, depois do início (sessão 28b; `podeFazerChamada`).
- A própria pessoa se inscreve e cancela **até a hora de início**, se houver vaga. A gestão inscreve e tira a qualquer momento. A vaga é conferida no banco (inscrições simultâneas não estouram o limite).
- Presença só depois do início. Só quem teve presença marcada avalia (nota de 1 a 5, "bom" e "melhorar"); avaliar de novo substitui a anterior.
- Avaliações individuais: a gestão lê com o nome; quem ministrou lê sem o nome (ordenadas pela nota); os demais veem só a média (`acessoAosFeedbacks`).
- A lista de inscritos aparece só para a gestão e para quem ministra.
- Horas no perfil contam só com presença marcada.

### Agenda e reuniões (`/agenda`, `/reunioes`; sessão 28b)
- `GET /agenda?de&ate` junta, num período de até 62 dias, as reuniões da pessoa, os prazos das tarefas em que ela é responsável e todas as capacitações (com `inscrito` e `ministra`).
- Cada um vê a própria agenda; a gestão (`projetos.verTodos`) usa `pessoa` para ver a de outra. Prazo de tarefa de projeto sem acesso completo vem sem título e sem código, só com o projeto.
- Reunião: qualquer pessoa logada cria; quem cria é participante. Participantes novos precisam estar ativos na EJ (quem já estava fica, mesmo se saiu). Quem não participa recebe 404 (a gestão vê todas). Só quem criou e a gestão editam e excluem.
- A ficha traz o e-mail de login dos participantes, usado pela tela para montar o link do Google Agenda (sem integração com a API do Google).

### Biblioteca (`/biblioteca`)
Um módulo só no lugar de Gestão (pastas e documentos), Base de Inteligência e Iniciativas. Guarda o material da Konvex: pesquisas, decisões, aprendizados, documentos, ideias.
- **Item:** título (até 160 caracteres), texto em Markdown simples, links `http(s)://`, anexos, tags, um projeto (opcional) e o sigilo. O autor é quem cadastrou. A lista ordena pelo mais recente alterado. O formulário pede conteúdo, link ou arquivo; a API exige só o título.
- **Sigilo:** **Todos** (padrão), **Só gestão**, **Equipe de um projeto** (exige projeto) ou **Só diretoria** (contratos, sessão 31b).
- **Quem lê:** "Só diretoria" só com `clientes.ver` (nem `biblioteca.verTodos` passa por cima). Fora isso, a gestão lê tudo (`biblioteca.verTodos`). Os demais leem os itens de sigilo Todos e os de projeto de que participam **ou participaram**. Item que a pessoa não lê responde 404, na lista, na ficha, nos anexos e na aba do projeto.
- **Quem cria:** qualquer pessoa logada. Sigilo "Só gestão" só com `biblioteca.gerir`; "Só diretoria" só com `clientes.ver` (403). Ligar a um projeto (em qualquer sigilo): a gestão liga qualquer um; o membro só liga projeto de que participa ou participou.
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
- **Visão Estratégica** (`estrategia.ver`): gestão. Não tem rota na API; o controle é o item de menu.
- **Simular precificação** (`precificacao.simular`): gestão. O cálculo fica no navegador (`src/lib/precificacao.js`) e nada é gravado. As regras ficam no banco (`regras_precificacao`, migração 027, uma linha em JSONB; sem linha, o padrão de `RegrasPrecificacao.ts`): `GET /config/precificacao` exige `precificacao.simular` (membro: 403); `PUT /config/precificacao` exige `configuracoes.editar` (só diretor), com todos os campos obrigatórios e faixas fixas (400 `REGRA_PRECIFICACAO_INVALIDA`, dizendo o campo; margem mínima não passa da padrão). O desconto acima do teto ou sem justificativa só barra o PDF na tela.

## 3. Matriz papel × o que vê e o que faz

Legenda: ✅ pode · ❌ não pode · texto = pode, com a condição. "Código" aponta a ação do catálogo (`catalogoPermissoes.ts`) ou a regra em `source/shared/seguranca/` que decide.

**Sessão 31a:** as colunas Diretor / Gerente / Membro são os **padrões** da migração 030 (seção 1); quem decide de verdade é a grade de Configurações → Permissões, por cargo. Trainee segue o conjunto "Trainee" da grade (por padrão: o do membro, sem liderar e sem Biblioteca).

### Catálogo (grade de permissões)
| Grupo | Permissão | Diretor | Gerente | Membro | Trainee |
|---|---|---|---|---|---|
| Pessoas | `pessoas.ver` (tela Pessoas) | ✅ | ✅ | ❌ | ❌ |
| Pessoas | `pessoas.gerir` (convidar, editar, status, períodos; só abaixo do seu cargo) | ✅ | ✅ | ❌ | ❌ |
| Projetos | `projetos.ver` (tela Projetos) | ✅ | ✅ | ✅ | ✅ |
| Projetos | `projetos.abrirDaArea` (abre os da área do cargo, sem subáreas) | ✅ | ✅ | ❌ | ❌ |
| Projetos | `projetos.abrirTodos` | ✅ | ❌ | ❌ | ❌ |
| Projetos | `projetos.editar` (criar e editar os que abre) | ✅ | ✅ | ❌ | ❌ |
| Projetos | `projetos.excluir` | ✅ | ❌ | ❌ | ❌ |
| Projetos | `projetos.liderar` (pode ser escolhido líder; senão 400 `LIDER_SEM_PERMISSAO`) | ✅ | ✅ | ✅ | ❌ |
| Projetos | `clientes.ver` (telefone e e-mail dos clientes, alterar clientes e sigilo "Só diretoria" na Biblioteca) | ✅ | ❌ | ❌ | ❌ |
| Tarefas | `tarefas.ver` (tela Tarefas) | ✅ | ✅ | ✅ | ✅ |
| Tarefas | `tarefas.gerirTodas` (organiza tarefas dos projetos que abre) | ✅ | ✅ | ❌ | ❌ |
| Agenda | `agenda.ver` | ✅ | ✅ | ✅ | ✅ |
| Agenda | `agenda.gerirTodas` (agenda de outra pessoa, reunião de outros) | ✅ | ✅ | ❌ | ❌ |
| Agenda | `reunioes.criar` | ✅ | ✅ | ✅ | ✅ |
| Capacitações | `capacitacoes.ver` (tela e `GET /capacitacoes`) | ✅ | ✅ | ✅ | ✅ |
| Capacitações | `capacitacoes.gerir` (criar, editar, excluir) | ✅ | ✅ | ❌ | ❌ |
| Capacitações | `capacitacoes.presenca` (chamada de qualquer capacitação; o instrutor sempre faz a dele) | ✅ | ✅ | ❌ | ❌ |
| Biblioteca | `biblioteca.usar` (tela, itens e anexos) | ✅ | ✅ | ✅ | ❌ |
| Biblioteca | `biblioteca.verTodos` (itens "só gestão") | ✅ | ✅ | ❌ | ❌ |
| Biblioteca | `biblioteca.gerir` | ✅ | ✅ | ❌ | ❌ |
| Gestão | `estrategia.ver` (Relatórios) | ✅ | ✅ | ❌ | ❌ |
| Gestão | `precificacao.simular` | ✅ | ✅ | ❌ | ❌ |
| Gestão | `gestao.visoes` (Alocação, Campinho, ocupação de todos, sobrecarga, passagens antigas no perfil) | ✅ | ✅ | ❌ | ❌ |
| Gestão | `areas.liderarTodas` | ✅ | ❌ | ❌ | ❌ |
| Configurações | `configuracoes.ver` | ✅ | ❌ | ❌ | ❌ |
| Configurações | `config.estrutura` (áreas, cargos abaixo do seu, senioridades, projeto geral) | ✅ | ❌ | ❌ | ❌ |
| Configurações | `config.dificuldade` | ✅ | ❌ | ❌ | ❌ |
| Configurações | `config.precificacao` | ✅ | ❌ | ❌ | ❌ |
| Configurações | `permissoes.gerir` (a grade) | ✅ | ❌ | ❌ | ❌ |

Dashboard e o próprio perfil ficam sempre abertos. A API cobra o "ver" só onde os dados não são carregados no início do app (Capacitações, Biblioteca); `/usuarios`, `/projetos` e `/tarefas` seguem abertos a todo logado, e o que cada um mostra segue o acesso aos projetos.

### Pessoas e configurações
| Ação | Quem | Código |
|---|---|---|
| Editar o próprio contato, foto, senha, curso, ingresso e data de entrada | todo logado | `/auth/perfil`, `/auth/foto`, `/auth/senha` |
| Cadastrar, editar, mudar status, reenviar link, lançar períodos | `pessoas.gerir` e a pessoa **abaixo** do seu cargo (sem cargo = abaixo de todos) | `exigirGerirPessoa` (`hierarquia.ts`) |
| Dar período com cargo | só cargo abaixo do seu (403) | `exigirDarCargo` |
| Alterar o próprio cadastro ou períodos pela gestão | só o presidente | `exigirGerirPessoa` (403 `HIERARQUIA.PROPRIO`) |
| Encerrar ou excluir o último período aberto no cargo de presidente | ninguém (400 `PRESIDENTE_VAGO`) | `GerirPeriodosArea` |
| Criar e editar cargos | `config.estrutura`, só abaixo do seu, sem subir acima de si; o do presidente, só o presidente renomeia | `SalvarCargo` |
| Desativar cargo com alguém num período aberto | ninguém (409 `CARGO_COM_OCUPANTES`) | `SalvarCargo` |
| Mudar a grade | `permissoes.gerir`, só colunas abaixo do seu cargo e só permissões que você tem | `GerirPermissoes` |
| Ver ou definir a senha de outra pessoa | ninguém | a senha só é criada pela própria pessoa, pelo link do e-mail |

### Projetos (todo projeto é fechado desde a 31a; o "sigiloso" saiu)
| Ação | Quem | Código |
|---|---|---|
| Abrir por inteiro (ficha, tarefas, equipe, Biblioteca "equipe do projeto") | equipe atual **ou antiga** (quem sai não perde); `projetos.abrirTodos`; `projetos.abrirDaArea` se a área do projeto é a do período com cargo (só a própria área); projeto geral: todo logado; líder da área no geral | `acessoAoProjeto` |
| Ver o cartão (nome, tipo, área do interno, situação, líder, equipe atual) | todo logado, nos que não abre (demais rotas: 403 `PROJETO_SEM_ACESSO`; tarefa e anexo: 404) | `cartaoProjeto.ts` |
| Criar projeto | `projetos.editar` e precisa abrir o que cria (estar na equipe inicial, abrir todos ou ser da área) — senão 400 `SEM_ACESSO_AO_CRIAR` | `exigirNaoSeTrancar` |
| Editar, situação, equipe, líder | `projetos.editar` nos que abre; trocar a área sem continuar abrindo o projeto = 400 `SEM_ACESSO_AO_CRIAR` | `ProjetoRoutes` |
| Gerir pessoa inativa | pela posição do **último** cargo que ela teve (ex-diretor inativo segue acima do gerente) | `UsuarioRoutes.posicoesDosCargos` |
| Excluir projeto | `projetos.excluir` | `ProjetoRoutes` |

### Tarefas
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver tarefas de projeto | dos projetos que abre (31a) | dos projetos que abre (área do cargo) | dos seus projetos (atuais e anteriores; no geral, se tem ou teve período na área ou lidera a área) | `regrasTarefa().ver` (`acessoAoProjeto`) |
| Criar tarefa (sempre num projeto; sem projeto: 400 `PROJETO_OBRIGATORIO`) | ✅ | ✅ | se é da equipe atual (fica responsável); se é líder, para qualquer pessoa da equipe | `tarefas.gerirTodas` / `papelNoProjeto` |
| Editar, atribuir, excluir tarefa de projeto | ✅ | ✅ | se é líder do projeto (no geral: se tem cargo que lidera a área) | `regrasTarefa().organizar` / `Projeto.ehLider` |
| Editar e excluir a tarefa que criou (sem trocar responsáveis nem situação) | ✅ | ✅ | se é da equipe atual e criou a tarefa | `regrasTarefa().editar` |
| Corrigir a data de conclusão de tarefa concluída (não futura, não antes do início; quem concluiu não muda) | ✅ | ✅ | se é líder, ou participante e responsável, ou participante que criou a tarefa | `PATCH /tarefas/:codigo/conclusao` / `regrasTarefa().mudarStatus` ou `editar` |
| Marcar item do checklist (grava na hora; qualquer item da tarefa) | ✅ | ✅ | se é líder, ou participante e responsável, ou participante que criou a tarefa | `PATCH /tarefas/:codigo/checklist/:item` / `regrasTarefa().mudarStatus` ou `editar` |
| Concluir ou reabrir tarefa de projeto | ✅ | ✅ | se é líder, ou participante e responsável | `regrasTarefa().mudarStatus` |
| Mover tarefa de projeto entre as colunas | ✅ | ✅ | se é líder, ou participante e responsável (mesma regra de concluir e reabrir) | `PATCH /tarefas/:codigo/coluna` / `regrasTarefa().mudarStatus` |
| Editar as colunas do quadro do projeto (criar, renomear, reordenar, cor, papel, excluir) | ✅ | ✅ | se é líder do projeto (no geral: se lidera a área) | `PUT /projetos/:codigo/colunas` / `papelNoProjeto` = `gestao` ou `lider` (sem ação nova no catálogo) |
| Ver as colunas do projeto | dos projetos que abre | dos projetos que abre (fora: 403 `PROJETO_SEM_ACESSO`) | dos projetos que abre | acesso completo (`acessoAoProjeto`) |
| Comentar em tarefa de projeto | ✅ | ✅ | se é da equipe atual (no geral: período aberto na área) ou líder | `regrasTarefa().comentar` |
| Ver e baixar anexo de tarefa | ✅ | ✅ | se vê a tarefa (senão 404) | `regrasTarefa().ver` / `GerirAnexos.acesso` |
| Anexar arquivo na tarefa | ✅ | ✅ | se é da equipe atual ou líder | `regrasTarefa().comentar` / `GerirAnexos.acesso` |
| Excluir anexo de tarefa | ✅ | ✅ | o que enviou, ou se é líder | autor ou `regrasTarefa().organizar` / `GerirAnexos.acesso` |
| Apagar comentário | qualquer | qualquer | os próprios (líder: qualquer do projeto) | `TarefaRoutes` + `regrasTarefa().organizar` |
| Ver a ocupação semanal de todos (horas, teto, %) | ✅ | ✅ | ✅ (trainee também) | `GET /ocupacao` (todo logado; só totais, sem tarefas) |
| Ver o detalhe da ocupação de uma pessoa | ✅ | ✅ | ✅ (trainee também) | `GET /ocupacao/:codigoUsuario` / `ConsultarOcupacao.dePessoa` (`acessoAoProjeto` por tarefa) |
| Receber aviso de ocupação acima de 100% ao salvar tarefa | quem salva | quem salva | quem salva | `avisosOcupacao` em POST/PUT `/tarefas`, PATCH status e coluna (não bloqueia) |

Sessão 24a (ocupação): o total de cada pessoa é visível a todo logado, porque soma todas as tarefas abertas com dificuldade (inclusive as de projetos que quem pede não vê). O detalhe mostra cada tarefa pelo acesso de quem pede ao projeto dela: `completo` = linha da tarefa (título, projeto e horas); `cartao` com `gestao.visoes` (sessão 27a) = uma linha por projeto com o nome e as horas somadas, sem títulos; `cartao` com membro ou trainee (fora do projeto, inclusive a própria pessoa) = tudo numa linha "Outras tarefas", sem título, código nem projeto. O aviso ao salvar só traz nome e números dos responsáveis.

Sessão 23b: a tarefa avulsa acabou e a ação `tarefas.atribuir` saiu do catálogo (a gestão organiza qualquer tarefa com `tarefas.gerirTodas`). No projeto geral da área, quem tem período aberto é a equipe atual (desde 25/11 quem teve não aparece; todo logado vê o geral) e quem tem cargo que lidera a área é líder, mesmo com papel membro (organiza, mas não é responsável).

### Capacitações
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver lista, ficha, média e material | ✅ | ✅ | ✅ | só login (`GerirCapacitacoes.listar`) |
| Criar, editar, excluir, anexar material | ✅ | ✅ | ❌ | `capacitacoes.gerir` |
| Inscrever-se e cancelar | a qualquer hora | a qualquer hora | até o início, com vaga | `GerirCapacitacoes.inscrever/cancelar` |
| Inscrever ou tirar outra pessoa | ✅ | ✅ | ❌ | `capacitacoes.gerir` |
| Ver inscritos | ✅ | ✅ | se ministra | `podeGerirCapacitacoes` / `ehInstrutor` |
| Fazer a chamada (depois do início) | ✅ | ✅ | se ministra | `capacitacoes.gerir` / `ehInstrutor` |
| Avaliar | se presente | se presente | se presente | `GerirCapacitacoes.avaliar` (presença) |
| Ler avaliações individuais | com nome | com nome | sem nome, se ministrou | `acessoAosFeedbacks` |

### Agenda e reuniões
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver a própria agenda | ✅ | ✅ | ✅ | só login (`GerirAgenda.agenda`) |
| Ver a agenda de outra pessoa | ✅ | ✅ | ❌ | `projetos.verTodos` |
| Criar reunião | ✅ | ✅ | ✅ | só login |
| Ver reunião | todas | todas | se participa | `GerirAgenda.buscarVisivel` (404) |
| Editar e excluir reunião | todas | todas | se criou | `GerirAgenda.podeAlterar` |

### Biblioteca
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ler itens | todos | todos | sigilo Todos e os dos seus projetos (atuais e anteriores) | `biblioteca.verTodos` / `podeVerItem` |
| Cadastrar item | ✅ | ✅ | ✅ | só login (`SalvarItemBiblioteca`) |
| Usar sigilo "Só gestão" | ✅ | ✅ | ❌ | `biblioteca.gerir` (`exigirPodeUsarSigiloEProjeto`) |
| Usar e ler sigilo "Só diretoria" (31b) | ✅ | ❌ | ❌ | `clientes.ver` (`exigirPodeUsarSigiloEProjeto`, `podeVerItem`) |
| Ver telefone e e-mail dos clientes e alterar a lista (31b) | ✅ | ❌ | ❌ | `clientes.ver` (`ProjetoRoutes.paraResposta`, `exigirPodeAlterarClientes`) |
| Ligar item a projeto | qualquer | qualquer | os que participa ou participou | `biblioteca.gerir` / `exigirPodeUsarSigiloEProjeto` |
| Editar e excluir item e seus anexos | ✅ | ✅ | se é o autor | `biblioteca.gerir` / `podeAlterarItem` |
| Ver o nome do projeto ligado | ✅ | ✅ | só dos projetos que vê (senão, sem projeto) | `projetos.verTodos` / `podeVerProjetoDoItem` |
| Baixar anexo | ✅ | ✅ | se lê o item | `GerirAnexos.acesso` |
| Enviar e excluir anexo | ✅ | ✅ | se edita o item | `GerirAnexos.acesso` |

Perdas da sessão 17: a área **Inovação** não cria mais nada de forma especial; ideias de quem é da área entram como itens da Biblioteca (sugestão: tag `inovacao`).

### Painel e telas da gestão
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Dashboard pessoal | ✅ | ✅ | ✅ | menu sem permissão (`registro.ts`) |
| Sete indicadores no Dashboard | ✅ | ✅ | ❌ | `projetos.verTodos` (`Dashboard.jsx`) |
| Visão Estratégica | ✅ | ✅ | ❌ | `estrategia.ver` (menu) |
| Simular precificação | ✅ | ✅ | ❌ | `precificacao.simular` (menu e `GET /config/precificacao`) |
| Alterar as regras da precificação | ✅ | ❌ | ❌ | `configuracoes.editar` (`PUT /config/precificacao`) |
| Avisos gravados (tarefa recebida, capacitação nova) e situação (atrasadas, a vencer, capacitação próxima) | ✅ | ✅ | ✅ | `GET /avisos` e `PATCH /avisos/lidos`: só login, sem permissão (`ConsultarAvisos.ts`) |
| Aviso de sobrecarga (pessoas acima de 100% na semana) | ✅ | ✅ | ❌ | `projetos.verTodos` (hoje diretor e gerente) em `ConsultarAvisos.ts`; trainee e membro não recebem |

Os avisos só falam de tarefas de projetos com acesso **completo**: quem não abre o projeto deixa de receber os avisos das tarefas dele (omitidos na leitura, não apagados). O aviso de tarefa excluída some. A lista traz no máximo 30; `naoLidos` conta só os visíveis; lidos há mais de 30 dias são apagados ao consultar. Marcar como lido só vale para os avisos da própria pessoa.

## 4. Registro da decisão de 14/11/2026 (sessão 17)

Gestão (documentos), Base de Inteligência e Iniciativas guardavam o mesmo tipo de material, com três regras de acesso diferentes. A gestão decidiu **simplificar**: viraram a **Biblioteca**, com uma regra de leitura (sigilo por item) e uma de escrita (autor ou gestão).
- **Dados antigos descartados:** pastas, documentos, itens da Base, iniciativas, ligações e anexos deles. O usuário decidiu começar do zero; a migração 012 apaga tudo e exige backup do banco e da pasta de anexos antes da publicação.
- **Área Inovação perdeu o direito especial** de criar. Tarefa avulsa continua só da gestão.
- **Tarefas** perderam a ligação com iniciativa.
- Spec: `docs/superpowers/specs/2026-11-14-biblioteca-design.md`.

## 4.1. Registro da sessão 22 (foto e links do perfil)

A pessoa passou a ter **foto de perfil** (no lugar do campo `avatar_url`) e os links do perfil ganharam cartões com logo. As **tecnologias** (tabelas `habilidades` e `usuario_habilidades`) saíram do sistema: a migração 016 apaga esses dados, que só voltam do backup anterior à publicação. A foto não cria ação nova no catálogo de permissões (basta estar logado).
- Spec: `docs/superpowers/specs/2026-11-18-perfil-design.md`.

## 4.2. Registro da sessão 23a (áreas por período)

`usuarios.area_codigo`, `usuarios.cargo_codigo`, `historico_areas` e `historico_cargos` viraram a tabela `periodos_area` (migração 017, com a carga do que existia). A regra de liderança por área é provisória e não muda nenhuma permissão na 23a.
- Spec: `docs/superpowers/specs/2026-11-18-areas-design.md`.

## 5. O que ainda não existe
Homologação, auditoria (quem mudou o quê), LGPD e retenção, precificação pela API, integração com a API do Google Calendar (a agenda só gera o link do Google), e-mails, busca global, Board Tático, CRM. Ver o `.konvex/roteiro.md` (fases 6 e 7).
