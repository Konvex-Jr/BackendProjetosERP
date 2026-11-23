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
1. **Ações do catálogo, por papel.** `source/shared/seguranca/catalogoPermissoes.ts` lista as ações (`projetos.editar`, `tarefas.gerirTodas`…) e o mapa `PERMISSOES_POR_PAPEL` diz quais cada papel tem. As rotas checam a ação, nunca o papel (`exigirPermissao` e `temPermissao` em `permissoes.ts`).
   - Diretor: todas as ações.
   - Gerente: todas, **menos** `pessoas.gerirDiretores`, `projetos.excluir` e `configuracoes.editar` (lista `DO_GESTOR`).
   - Membro: **nenhuma**. Tudo o que o membro faz vem da camada 2.
2. **Regras por item.** Para o que depende da relação da pessoa com o item (autor, responsável, líder, participante, área, instrutor), há uma regra por módulo em `source/shared/seguranca/`:

| Arquivo | Decide |
|---|---|
| `visibilidadeProjetos.ts` | Quais projetos a pessoa vê (`participaOuParticipou`, `acessoAoProjeto`, `exigirAcessoCompleto`, `projetosVisiveisPara`) |
| `regrasTarefa.ts` | Ver, organizar, editar, mudar status e comentar em cada tarefa (`papelNoProjeto`, `regrasTarefa`) |
| `regrasBiblioteca.ts` | Quem lê e quem altera um item da Biblioteca, e quem pode usar sigilo e projeto (`podeVerItem`, `podeAlterarItem`, `exigirPodeUsarSigiloEProjeto`) |
| `regrasCapacitacao.ts` | Gestão de capacitações e acesso às avaliações (`podeGerirCapacitacoes`, `acessoAosFeedbacks`) |

### Detalhes que valem para tudo
- O papel é lido do banco **a cada requisição**, não do token: mudar o papel de alguém vale na chamada seguinte (`UsuarioAutenticado` em `permissoes.ts`).
- Papel desconhecido recebe lista vazia (na dúvida, nega: `permissoesDoPapel`).
- 401 sem login, 403 sem permissão. Itens que a pessoa nem pode saber que existem respondem **404**: item da Biblioteca que ela não lê, tarefa de projeto que ela não vê completo (normal ou sigiloso), anexo de item que ela não lê. O projeto em si não some: quem não vê completo recebe só o cartão (nome, tipo, área do interno, situação, líder, equipe atual e selo); as demais rotas do projeto respondem 403 `PROJETO_SEM_ACESSO`.
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
- **Sessão 25b (migração 022):** o status **Alumni deixou de existir** (a 022 converteu em Inativo com `motivo_saida = 'Alumni'`); só `ativo`, `trainee`, `inativo`. **Motivo da saída**: obrigatório ao mudar **para** Inativo (`PATCH /usuarios/:codigo/status` e `DELETE`; 400 `MOTIVO_SAIDA_OBRIGATORIO`, até 500 caracteres, `MOTIVO_SAIDA_LONGO`); Inativo para Inativo (corrigir a data) não pede de novo; voltar a Ativo apaga motivo e data; sem motivo aparece "Não informado". **Fim do trainee** (`fim_trainee`): gravado com a data de hoje na troca Trainee para Ativo; só a gestão o edita (`PUT /usuarios/:codigo`, `exigirPodeGerirPerfil`), nunca a própria pessoa; não antes da entrada nem no futuro. **E-mail pessoal** (opcional, até 254, `EMAIL_PESSOAL_INVALIDO`): visível a todos; edita a própria pessoa (`PUT /auth/perfil`) ou a gestão. **Curso** (só os três cursos: Ciência da Computação, Engenharia Mecânica, Engenharia Elétrica; obrigatório na criação) e **telefone** (10 ou 11 dígitos, `TELEFONE_INVALIDO`) são conferidos **só quando o campo muda**: pessoa antiga com valor fora da regra edita outros campos normalmente; editam a pessoa e a gestão. **Ingresso na faculdade** (`ingresso`, `AAAA/1` ou `AAAA/2`, de 2000 até o semestre atual, `INGRESSO_INVALIDO`; substitui o semestre, que saiu; também só conferido quando muda). **Perfil obrigatório**: curso, telefone, e-mail pessoal, ingresso e link do calendário; a API devolve `pendenciasPerfil` (lista de campos faltando, `[]` para inativo) em `GET /auth/me`, `PUT /auth/perfil`, login, retomar e criar senha, e a **tela** bloqueia até completar (o back só informa, não bloqueia rotas).
- Criar pessoa: o status inicial é Ativo ou Trainee (`STATUS_INICIAL_INVALIDO` nos outros casos). Trainee com papel diferente de membro é 400 (`TRAINEE_SO_MEMBRO`), na criação e na edição.
- Ninguém é excluído (ADR-006): `DELETE /usuarios/:codigo` só muda o status para Inativo (o corpo traz `motivoSaida`). Quando alguém sai, as participações em projetos são encerradas e o histórico fica.
- **Áreas e cargos por período** (sessão 23a, migração 017): a pessoa pode estar em várias áreas ao mesmo tempo, cada uma com um cargo opcional e um período `[início, fim)` (fim vazio = atual). A pessoa não grava mais área nem cargo; as "áreas atuais" (`areas` na resposta) são os períodos em aberto. Se uma tela antiga ainda mandar `codigoArea` ou `codigoCargo` no `PUT /usuarios/:codigo`, os campos são ignorados.
  - A gestão lança, corrige e exclui períodos em `/usuarios/:codigo/periodos` (mesma regra de editar a pessoa: `exigirPodeGerirPerfil`; ninguém altera os próprios períodos, exceto o diretor). Todos os logados leem.
  - Regras (400 com código): nenhuma data no futuro (`INICIO_NO_FUTURO`, `FIM_NO_FUTURO`); fim depois do início (`FIM_NAO_DEPOIS_DO_INICIO`); dois períodos da mesma pessoa na mesma área não se sobrepõem (`PERIODO_SOBREPOSTO`, garantido também pelo banco em gravações simultâneas); só área e cargo ativos ao escolher (`AREA_INATIVA`, `CARGO_INATIVO`; corrigir só as datas de um período antigo com área desativada continua permitido); período em aberto só para quem está na EJ (`PESSOA_FORA_DA_EJ`); fim não passa da saída da pessoa (`FIM_DEPOIS_DA_SAIDA`).
  - Quem sai da EJ (Inativo) tem os períodos em aberto **sempre** encerrados na data de saída, mesmo quando a gestão escolhe manter as participações nos projetos. Quem volta a Ativo não reabre nada: a gestão lança um período novo.
- Cada pessoa edita no próprio perfil só contato e apresentação: nome de exibição, telefone, e-mail pessoal, LinkedIn, GitHub, link do calendário, curso, ingresso na faculdade e bio (`PUT /auth/perfil`). E troca a própria senha e a própria foto.
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
- Todos veem **todos** os projetos na lista: completo ou só o **cartão** (sessão 27a). Vê completo (`acessoAoProjeto` = `completo`) quem tem `projetos.verTodos` (diretor e gerente) ou participa **ou participou** da equipe (quem saiu continua vendo o histórico), e o líder da área no projeto geral. Os demais veem o cartão (`cartao: true`): `codigo`, `nome`, `tipo`, `area` (só de projeto interno), `status`, `lider`, `membros` (equipe atual: código, nome e foto; sem função nem ex-membros; sessão 27b), `sigiloso` e `geralDaArea`. O projeto só tem **líder** (o campo responsável saiu na 27b, migração 025); o líder pode ser escolhido já na criação (`codigoLider`: ativo na EJ, não trainee; entra na equipe junto e conta como equipe para o sigiloso).
- A gestão cria e edita, muda a situação (Em andamento, Atenção, Bloqueado, Concluído, Arquivado), monta a equipe (função, alocação, entrada e saída) e escolhe o líder (`projetos.editar`). Um líder por projeto, escolhido na equipe.
- O sistema avisa quando a alocação de alguém passa de 100%.
- **Projeto sigiloso (sessões 20 e 27a).** Quem cria (`projetos.editar`) pode marcar `sigiloso: true`. A lista de acesso (`projeto_acesso`, `PUT /projetos/:codigo/acesso`, campo `acesso`) acabou; a migração 024 apagou a tabela. Regra única em `acessoAoProjeto` (`visibilidadeProjetos.ts`), com dois resultados, `completo` ou `cartao`:
  - **Vê completo:** diretor (`projetos.verSigilosos`) e a **equipe atual**. Quem saiu da equipe **perde** o acesso (no projeto normal, ex-membro continua vendo). Quem criou o projeto e não está na equipe **não** vê.
  - **Cartão:** todos os demais, gerente inclusive, em `GET /projetos` e `GET /projetos/:codigo` (200). Demais rotas do projeto (equipe, colunas, status, edição): 403 `PROJETO_SEM_ACESSO`. Na lista, filtro por pessoa descarta os cartões; filtro por líder (`codigoLider`) os mantém (o líder está no cartão); filtro de área só mantém cartões de projeto interno (o cartão de cliente não mostra área; decisão do Claude, 20/11); a busca do cartão é só pelo nome.
  - **Quem marca o sigilo:** marcar e desmarcar `sigiloso` (`POST` e `PUT /projetos/:codigo`) é de quem edita o projeto (`projetos.editar` + acesso completo). Quem não é diretor só marca se ficar na equipe atual (depois da gravação, no PUT); senão 400 `SIGILOSO_SEM_VOCE`.
  - **Tarefas:** sem acesso completo, ninguém tem papel no projeto, nem a gestão (`papelNoProjeto`, `regrasTarefa.ts`). Tarefa, comentários e anexos de projeto que a pessoa não vê completo respondem o mesmo 404 da tarefa inexistente ("Tarefa não encontrada."), em projeto normal ou sigiloso, para todos os papéis (a gestão vê o normal completo; o gerente fora de sigiloso recebe 404). Quem saiu do projeto e segue como responsável continua vendo a própria tarefa conforme `regrasTarefa.ts`.
  - **Ocupação:** o cartão não revela tarefas. Todos veem uma linha com o nome do projeto e as horas (sessão 27b). **Perfil:** todos veem os projetos da pessoa; os que quem lê não vê completo saem `restrito` (sem referência nem função); a passagem antiga por projeto restrito só aparece à gestão e à própria pessoa.
  - **Biblioteca, perfil e avisos:** itens, projetos do perfil e avisos ligados a projeto que a pessoa não vê completo seguem ocultos como antes; ninguém liga item a ele (`regrasBiblioteca.ts`).
- Só o diretor exclui projeto (`projetos.excluir`); excluir leva junto os itens da Biblioteca com sigilo "Equipe do projeto" (e os anexos deles); os itens de sigilo Todos ou Só gestão só perdem a ligação com o projeto. O recomendado é Arquivar.
- Ativos = Em andamento, Atenção e Bloqueado.
- **Projeto interno (sessão 23b).** `tipo` é `cliente` (padrão) ou `interno`; outro valor é 400 `TIPO_PROJETO_INVALIDO`. Interno sempre tem área (400 `AREA_OBRIGATORIA_INTERNO`). `GET /projetos?tipo=interno|cliente` filtra.
- **Projeto geral da área.** Um por área (`geralDaArea`), nome "Área geral", interno, nunca sigiloso. Criado pelo sistema (migração 018 para as áreas existentes e `SalvarArea` para as novas); renomear a área renomeia o geral, inativar arquiva e reativar volta a Em andamento. A equipe e a liderança não são gravadas: vêm dos períodos da área e da `liderancaArea`. Editar, excluir, mudar status, acesso, equipe e líder do geral é 400 `PROJETO_GERAL_FIXO`; só `PUT /projetos/:codigo/colunas` segue valendo. As tarefas que eram avulsas moram nele.

### Tarefas (`/tarefas`)
Toda tarefa tem **projeto** (sessão 23b). A tarefa avulsa (sem projeto, com categoria) acabou: a migração 018 levou as avulsas para o **projeto geral da área** da categoria, e `POST /tarefas` sem `codigoProjeto` responde 400 `PROJETO_OBRIGATORIO` para todos (antes da checagem de permissão); `categoria` no corpo ou na consulta é ignorada. Tarefas antigas ligadas a iniciativas perderam essa ligação (a migração 012 removeu a coluna).

**Projeto geral da área (sessão 23b).** Cada área tem um projeto interno geral. A equipe dele não é montada à mão: vem dos períodos na área (período aberto = equipe atual; encerrado = ex-participante). Quem tem cargo que lidera a área (`lideresDaArea`, regra de `liderancaArea.ts`) conta como **líder** do geral, mesmo com papel membro: vê tudo (`acessoAoProjeto` = `completo`), cria tarefa para qualquer pessoa da equipe, edita, move, exclui e organiza o quadro. Como não está na equipe, não entra como responsável (400 `RESPONSAVEL_FORA_DO_PROJETO`). O geral nunca é sigiloso.

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

Lista (`GET /tarefas`): a gestão recebe todas; o membro recebe as dos projetos de que participa ou participou (no geral, pelos períodos na área ou por liderar a área) e as que tem como responsável.

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
- **Visão Estratégica** (`estrategia.ver`): gestão. Não tem rota na API; o controle é o item de menu.
- **Simular precificação** (`precificacao.simular`): gestão. O cálculo fica no navegador (`src/lib/precificacao.js`) e nada é gravado. As regras ficam no banco (`regras_precificacao`, migração 027, uma linha em JSONB; sem linha, o padrão de `RegrasPrecificacao.ts`): `GET /config/precificacao` exige `precificacao.simular` (membro: 403); `PUT /config/precificacao` exige `configuracoes.editar` (só diretor), com todos os campos obrigatórios e faixas fixas (400 `REGRA_PRECIFICACAO_INVALIDA`, dizendo o campo; margem mínima não passa da padrão). O desconto acima do teto ou sem justificativa só barra o PDF na tela.

## 3. Matriz papel × o que vê e o que faz

Legenda: ✅ pode · ❌ não pode · texto = pode, com a condição. "Código" aponta a ação do catálogo (`catalogoPermissoes.ts`) ou a regra em `source/shared/seguranca/` que decide.

Trainee (status `Trainee`, papel sempre membro) segue a coluna **Membro** em todas as tabelas, com as exceções da tabela "Trainee" abaixo. Projetos sigilosos têm a tabela própria "Projeto sigiloso".

### Pessoas e configurações
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver lista de pessoas e perfis | ✅ | ✅ | ✅ | só login (`UsuarioRoutes`) |
| Ver projetos no perfil de outra pessoa | todos | todos | só os em comum | `projetos.verTodos` + `participaOuParticipou` |
| Editar o próprio contato e trocar a própria senha (regra de senha forte) | ✅ | ✅ | ✅ | só login (`/auth/perfil`, `/auth/senha`) |
| Enviar, trocar e remover a própria foto | ✅ | ✅ | ✅ | só login (`/auth/foto`) |
| Ver a foto de qualquer pessoa | ✅ (endereço público) | ✅ | ✅ | `GET /fotos/:arquivo`, sem login |
| Cadastrar, editar, mudar status e reenviar o link de senha (convite ou redefinição) de membro ou gerente | ✅ | ✅ | ❌ | `pessoas.gerir` (`exigirPodeGerirPerfil`) |
| Ver ou definir a senha de outra pessoa | ❌ | ❌ | ❌ | não existe rota; a senha só é criada pela própria pessoa, pelo link do e-mail |
| Pedir "Esqueci a senha" e usar o link de convite/redefinição | qualquer pessoa, sem login | | | `/auth/esqueci-senha`, `/auth/link-senha/:token` (públicas, com limites) |
| O mesmo para diretores (ou promover a diretor) | ✅ | ❌ | ❌ | `pessoas.gerirDiretores` |
| Alterar o próprio papel ou status | ❌ | ❌ | ❌ | `UsuarioRoutes` (checagem explícita) |
| Editar o fim do trainee de outra pessoa | ✅ | ✅ | ❌ | `PUT /usuarios/:codigo` (`exigirPodeGerirPerfil`) |
| Editar o próprio e-mail pessoal, telefone, curso e ingresso | ✅ | ✅ | ✅ | `PUT /auth/perfil` |
| Ver os períodos nas áreas de qualquer pessoa | ✅ | ✅ | ✅ | só login (`GET /usuarios/:codigo/periodos`) |
| Lançar, corrigir e excluir períodos de membro ou gerente | ✅ | ✅ | ❌ | `pessoas.gerir` (`exigirPodeGerirPerfil`) |
| O mesmo nos períodos de diretores | ✅ | ❌ | ❌ | `pessoas.gerirDiretores` |
| Alterar os próprios períodos | ✅ | ❌ | ❌ | `exigirPodeGerirPeriodosDe` (403 `PERIODO.PROPRIO`) |
| Criar e editar áreas, cargos, senioridades | ✅ | ❌ | ❌ | `configuracoes.editar` |
| Ligar ou desligar o projeto geral da área (opção "Projeto geral") | ✅ | ❌ | ❌ | `configuracoes.editar` / `SalvarArea` (`temGeral`) |

### Projetos
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver a ficha completa (projeto normal) | todos | todos | os que participa ou participou | `projetos.verTodos` / `acessoAoProjeto` |
| Ver o cartão (nome, tipo, área do interno, situação, líder, equipe atual, selo) de qualquer projeto | ✅ | ✅ | ✅ (os que não vê completo; demais rotas: 403 `PROJETO_SEM_ACESSO`) | `cartaoProjeto.ts` / `GET /projetos` |
| Criar, editar, mudar situação, montar equipe, escolher líder | ✅ | ✅ | ❌ | `projetos.editar` |
| Excluir projeto | ✅ | ❌ | ❌ | `projetos.excluir` |

### Projeto sigiloso
| Ação | Diretor | Gerente | Membro / trainee | Código |
|---|---|---|---|---|
| Ver completo (ficha, tarefas, equipe, Biblioteca) | todos | se está na equipe atual | se está na equipe atual (ex-membro e quem só criou: não) | `projetos.verSigilosos` / `acessoAoProjeto` |
| Ver só o cartão (nome, tipo, área do interno, situação, líder, selo) | — (vê completo) | se está fora (demais rotas: 403 `PROJETO_SEM_ACESSO`) | se está fora (idem) | `acessoAoProjeto` = `cartao` / `cartaoProjeto.ts` |
| Criar projeto sigiloso ou marcar o sigilo na edição | ✅ | se fica na equipe atual (senão 400 `SIGILOSO_SEM_VOCE`) | ❌ | `projetos.editar` (`POST` e `PUT /projetos/:codigo`) |
| Desmarcar sigiloso (edição) | todos | se edita o projeto (acesso completo) | ❌ | `projetos.editar` (`PUT /projetos/:codigo`) |
| Ver item da Biblioteca ligado ao sigiloso | só se vê completo | só se vê completo | trainee: sem Biblioteca; membro: só se vê completo | `regrasBiblioteca.ts` (sigiloso oculto) |
| Tarefa do sigiloso (ver, editar, status, comentários) | ✅ | se vê completo (fora: 404 igual ao da tarefa inexistente) | se vê completo (fora: 404) | `regrasTarefa.ts` / `TarefaRoutes.carregar` |
| Anexos de tarefa do sigiloso | ✅ | se vê completo (fora: 404) | se vê completo (fora: 404) | `regrasTarefa().ver` / `GerirAnexos.acesso` |

A lista de acesso deixou de existir na sessão 27a (decisão do usuário, 20/11): a regra é só equipe atual e diretor. Gerente fora de sigiloso recebe 404 em tarefa e anexo, mesmo regra do membro, porque o cartão já mostra o projeto e esconde o resto.

### Trainee
| Ação | Trainee | Código |
|---|---|---|
| Entrar no sistema | ✅ (papel membro) | `exigirTraineeMembro` (`dadosPessoa.ts`) |
| Ver projetos da equipe (inclusive o geral da área) e as tarefas deles, o próprio perfil, a lista de pessoas, capacitações e o Dashboard | ✅ (como membro) | `participaOuParticipou`, `regrasTarefa()`; menu em `registro.ts` |
| Biblioteca (menu, itens, anexos de item) | ❌ (403, sem item no menu) | `semTrainee` (`registro.ts`), `exigirNaoTrainee` (`BibliotecaRoutes`, `GerirAnexos`) |
| Ser líder de projeto | ❌ (400 `TRAINEE_NAO_LIDERA`) | `PUT /projetos/:codigo/lider` |
| Voltar a ser trainee depois de mudar de status | ❌ (400 `STATUS_TRAINEE_SO_NA_ENTRADA`) | `AlterarStatusPessoa` |

### Tarefas
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver tarefas de projeto | todas dos projetos normais (sigiloso: só se vê completo) | todas dos projetos normais (sigiloso: só se vê completo) | dos seus projetos (atuais e anteriores; no geral, se tem ou teve período na área ou lidera a área) e as que é responsável | `projetos.verTodos` + `regrasTarefa().ver` (`acessoAoProjeto`) |
| Criar tarefa (sempre num projeto; sem projeto: 400 `PROJETO_OBRIGATORIO`) | ✅ | ✅ | se é da equipe atual (fica responsável); se é líder, para qualquer pessoa da equipe | `tarefas.gerirTodas` / `papelNoProjeto` |
| Editar, atribuir, excluir tarefa de projeto | ✅ | ✅ | se é líder do projeto (no geral: se tem cargo que lidera a área) | `regrasTarefa().organizar` / `Projeto.ehLider` |
| Editar e excluir a tarefa que criou (sem trocar responsáveis nem situação) | ✅ | ✅ | se é da equipe atual e criou a tarefa | `regrasTarefa().editar` |
| Corrigir a data de conclusão de tarefa concluída (não futura, não antes do início; quem concluiu não muda) | ✅ | ✅ | se é líder, ou participante e responsável, ou participante que criou a tarefa | `PATCH /tarefas/:codigo/conclusao` / `regrasTarefa().mudarStatus` ou `editar` |
| Marcar item do checklist (grava na hora; qualquer item da tarefa) | ✅ | ✅ | se é líder, ou participante e responsável, ou participante que criou a tarefa | `PATCH /tarefas/:codigo/checklist/:item` / `regrasTarefa().mudarStatus` ou `editar` |
| Concluir ou reabrir tarefa de projeto | ✅ | ✅ | se é líder, ou participante e responsável | `regrasTarefa().mudarStatus` |
| Mover tarefa de projeto entre as colunas | ✅ | ✅ | se é líder, ou participante e responsável (mesma regra de concluir e reabrir) | `PATCH /tarefas/:codigo/coluna` / `regrasTarefa().mudarStatus` |
| Editar as colunas do quadro do projeto (criar, renomear, reordenar, cor, papel, excluir) | ✅ | ✅ | se é líder do projeto (no geral: se lidera a área) | `PUT /projetos/:codigo/colunas` / `papelNoProjeto` = `gestao` ou `lider` (sem ação nova no catálogo) |
| Ver as colunas do projeto | todas | todas (sigiloso fora: 403 `PROJETO_SEM_ACESSO`) | dos projetos que vê por completo | acesso completo (`acessoAoProjeto`) |
| Comentar em tarefa de projeto | ✅ | ✅ | se é da equipe atual (no geral: período aberto na área) ou líder | `regrasTarefa().comentar` |
| Ver e baixar anexo de tarefa | ✅ | ✅ | se vê a tarefa (senão 404) | `regrasTarefa().ver` / `GerirAnexos.acesso` |
| Anexar arquivo na tarefa | ✅ | ✅ | se é da equipe atual ou líder | `regrasTarefa().comentar` / `GerirAnexos.acesso` |
| Excluir anexo de tarefa | ✅ | ✅ | o que enviou, ou se é líder | autor ou `regrasTarefa().organizar` / `GerirAnexos.acesso` |
| Apagar comentário | qualquer | qualquer | os próprios (líder: qualquer do projeto) | `TarefaRoutes` + `regrasTarefa().organizar` |
| Ver a ocupação semanal de todos (horas, teto, %) | ✅ | ✅ | ✅ (trainee também) | `GET /ocupacao` (todo logado; só totais, sem tarefas) |
| Ver o detalhe da ocupação de uma pessoa | ✅ | ✅ | ✅ (trainee também) | `GET /ocupacao/:codigoUsuario` / `ConsultarOcupacao.dePessoa` (`acessoAoProjeto` por tarefa) |
| Receber aviso de ocupação acima de 100% ao salvar tarefa | quem salva | quem salva | quem salva | `avisosOcupacao` em POST/PUT `/tarefas`, PATCH status e coluna (não bloqueia) |

Sessão 24a (ocupação): o total de cada pessoa é visível a todo logado, porque soma todas as tarefas abertas com dificuldade (inclusive as de projetos que quem pede não vê). O detalhe mostra cada tarefa pelo acesso de quem pede ao projeto dela: `completo` = linha da tarefa (título, projeto e horas); `cartao` com gestão (sessão 27a) = uma linha por projeto com o nome e as horas somadas, sem títulos; `cartao` com membro ou trainee (fora do projeto, ex-membro de sigiloso, inclusive a própria pessoa) = tudo numa linha "Outras tarefas", sem título, código nem projeto. O aviso ao salvar só traz nome e números dos responsáveis.

Sessão 23b: a tarefa avulsa acabou e a ação `tarefas.atribuir` saiu do catálogo (a gestão organiza qualquer tarefa com `tarefas.gerirTodas`). No projeto geral da área, quem tem período aberto é a equipe atual, quem teve é ex-participante e quem tem cargo que lidera a área é líder, mesmo com papel membro (organiza, mas não é responsável).

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

Os avisos só falam de tarefas de projetos com acesso **completo**: quem saiu da equipe de um projeto sigiloso, mesmo seguindo como responsável, deixa de receber os avisos dessa tarefa (omitidos na leitura, não apagados). O aviso de tarefa excluída some. A lista traz no máximo 30; `naoLidos` conta só os visíveis; lidos há mais de 30 dias são apagados ao consultar. Marcar como lido só vale para os avisos da própria pessoa.

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
