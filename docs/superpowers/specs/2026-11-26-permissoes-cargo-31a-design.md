# Sessão 31a: permissões por cargo e acesso aos projetos pela área

Data: 26/11/2026. Origem: reunião com as lideranças (26/11, decisão 1 da seção 4 do `.konvex/acompanhamento.md`) e conversa com o usuário no mesmo dia.

## 1. Por que

A Konvex quer que cada pessoa veja e faça no ERP o que o cargo dela permite, e que a gestão ajuste isso sem pedir código. Hoje tudo depende de um **perfil fixo** (diretor, gerente, membro), separado do **cargo** que a pessoa tem na área. Os dois podem discordar (cargo "Gerente de inovação" com perfil "membro"), e o perfil não sabe de área: gerente abre todos os projetos, inclusive os de Inovação.

O que muda:

- O perfil fixo **deixa de existir**. As permissões vêm do cargo do período aberto da pessoa.
- Uma **tela de permissões** (grade cargo × permissão) deixa a gestão mudar tudo, respeitando a hierarquia: cada um só mexe nos cargos abaixo do seu; o presidente mexe em tudo.
- Abrir um projeto passa a depender da equipe e do cargo, inclusive da **área** do cargo. Inovação (subárea de Projetos) só abre para quem tem acesso à Inovação; o gerente de projetos não abre os projetos de Inovação, e o gerente de inovação não abre os de Projetos. Diretores e presidente abrem todos.
- O **projeto sigiloso acaba**: todo projeto passa a ser fechado a quem não é da equipe nem tem a permissão. Os demais veem o cartão (sessão 27a/27b).

Sucesso: a diretoria confere na grade quem pode o quê, ajusta sem chamar ninguém, e um gerente de inovação, entrando, vê completos só os projetos de Inovação (e os da equipe dele).

## 2. Objetivos, não objetivos e anti-objetivos

**Objetivos**
- Permissões por cargo, gravadas no banco, editáveis por tela.
- Posição do cargo na hierarquia; regra "só mexe abaixo de você".
- Três permissões novas: abrir os projetos da área, abrir todos os projetos, ver dados do cliente e contratos (esta última só é **gravada e exibida** na grade nesta sessão; quem a usa é a 31b).
- Conjunto "Sem cargo" para quem não tem cargo (membro comum, trainee).
- Fim do perfil fixo e do sigilo de projeto, com migração que não deixa ninguém sem acesso sem aviso prévio.

**Não objetivos (31b ou depois)**
- Vários clientes por projeto, telefone e e-mail do cliente, contrato na Biblioteca com sigilo "Só diretoria", classe do projeto obrigatória, % de progresso no cartão: **sessão 31b**.
- Permissões por área para outras telas (Biblioteca da área, Capacitações da área). Só "abrir projetos" tem escopo de área nesta sessão.
- Mudar as **regras de vínculo** (o autor edita o próprio item, o líder organiza as tarefas do projeto dele, o responsável marca a própria tarefa, a equipe abre o projeto, o instrutor faz a chamada da própria capacitação, a área e a liderança criam no projeto geral): dizem respeito à relação da pessoa com o item, não ao cargo, e continuam fixas no código (usuário, 26/11).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Alguém conseguir se promover: dar a si ou a outro um cargo do mesmo nível ou acima do seu, ou uma permissão que não tem.
- O sistema ficar sem ninguém capaz de mexer nas permissões.
- Diretor atual perder acesso no dia da publicação sem a gestão saber antes.
- Quem saiu da equipe de um projeto perder o acesso a ele (decisão do usuário: continua abrindo).

## 3. Decisões do usuário (26/11)

1. Papel pelo **cargo**, não por perfil fixo; o perfil some (caminho "só o cargo").
2. **Todos os diretores e o presidente** abrem todos os projetos (hoje só existe a área Projetos).
3. Gerente de projetos e gerente de inovação estão no **mesmo nível**; só o diretor está acima dos dois. O de inovação não abre os projetos de Projetos, e o de projetos não abre os de Inovação.
4. Quem lidera a área de Projetos é o diretor; a de Inovação, o gerente. A configuração deve ser **personalizável**.
5. Líder de projeto **não é cargo**: é quem lidera aquele projeto (como hoje).
6. Contratos e dados do cliente só para diretores (presidente também); contrato fica na documentação do projeto (Biblioteca). Implementação na 31b.
7. Não precisa mais de projeto sigiloso: todos funcionam como fechados.
8. Tela onde **tudo** pode ser alterado, respeitando a hierarquia: só mexe nas permissões abaixo de você; o presidente pode tudo.
9. Quem sai da equipe **não perde** o acesso ao projeto.
10. Caminho de implementação: permissões gravadas no próprio cargo (não grupos à parte, não cargo apontando para perfil fixo).
11. Só o presidente mexe nos diretores (confirmado). Projeto geral aberto a todos (confirmado).
12. **Tudo o que é regra geral de "quem pode" vira permissão na grade**, inclusive as regras do trainee; as regras de vínculo ficam fixas (5.8).
13. **Cargos separados por área** ("Gerente de projetos", "Gerente de inovação", "Diretor de projetos"...), não um "Gerente" genérico em várias áreas. O gerente de inovação lidera a Inovação e reporta ao diretor; `lideraArea` continua no cargo, e quem lidera Projetos lidera também a subárea Inovação (regra atual de `lideresDaArea`, mantida).

## 4. Abordagens consideradas

| Abordagem | Como | Troca | Escolha |
| --- | --- | --- | --- |
| 1. Permissões no cargo | Cada cargo guarda a lista de permissões e a posição; lidas a cada requisição com a pessoa | Uma coisa só para cuidar; mudança vale no próximo clique | **Escolhida** (usuário, 26/11) |
| 2. Grupos de permissão | Grupos nomeados com permissões; cargo aponta para um grupo | Mais flexível com muitos cargos iguais, mas volta a ter duas coisas (cargo e grupo) | Descartada |
| 3. Cargo escolhe perfil fixo | Cargo diz "diretor/gerente/membro"; permissões no código | Mais rápida, mas sem a tela "tudo alterável" | Descartada |

## 5. Desenho

### 5.1 Modelo

- **Cargo** ganha:
  - `posicao` (inteiro ≥ 1; **menor = mais alto**). Vários cargos podem ter a mesma posição (gerentes lado a lado).
  - `permissoes` (lista de ações do catálogo).
  - Continua com `lideraArea` e `tetoSemanalHoras`.
- **Presidência:** exatamente um cargo tem `posicao = 1` e é o cargo do presidente. Esse cargo **sempre tem todas as permissões** (a tela mostra tudo marcado e travado) e não pode mudar de posição nem ser desativado. Garante que alguém sempre consiga mexer nas permissões.
- **Sem cargo:** um conjunto de permissões guardado à parte (não é um cargo), editável na grade como uma coluna "Sem cargo", com posição implícita abaixo de todos os cargos. Padrão na migração: vazio (equivale ao membro de hoje).
- **Catálogo** (`catalogoPermissoes.ts`): continua sendo a lista fechada de ações, com nome legível e grupo para a tela. Entram:
  - `projetos.abrirDaArea`: abre completos os projetos cuja área é a área do período aberto da pessoa (**só a própria área, sem descer para subáreas**).
  - `projetos.abrirTodos`: abre completos todos os projetos (substitui `projetos.verTodos` no papel de abrir).
  - `clientes.ver`: dados do cliente e contratos (usada na 31b).
  - `permissoes.gerir`: ver e alterar a grade e as posições dos cargos (substitui o "só diretor" atual de configurar cargos).
  - Saem: `projetos.verSigilosos` (não há mais sigilo) e `pessoas.gerirDiretores` (vira a regra de hierarquia, 5.3).
  - `projetos.verTodos` hoje também decide coisas além de abrir (sobrecarga nos avisos, ocupação de todos, Alocação/Campinho, filtros). O builder decide caso a caso se cada uso vira `projetos.abrirTodos` ou continua numa permissão de "visão da gestão"; a regra é não mudar quem vê o quê fora do "abrir projeto" sem registrar no doc 06.
- **Pessoa:** sai `usuarios.perfil` (tipo e coluna) do banco, da API e das telas. As permissões efetivas = permissões do cargo do período aberto da pessoa (um por vez desde a 24a; `PERIODO_CARGO_SIMULTANEO`), ou o conjunto "Sem cargo". Fora da EJ (inativo etc.) = nada, como hoje. Trainee segue com as restrições por status (sem Biblioteca, não lidera), por cima das permissões.

### 5.2 Leitura a cada requisição

O middleware já carrega a pessoa do banco a cada chamada (`AuthExpress`; perfil e status não vêm do token). Passa a carregar também o cargo aberto com posição, permissões e área, e o `UsuarioAutenticado` ganha `permissoes`, `posicaoCargo` e `areaDoCargo` no lugar de `perfil`. `areaDoCargo` = área do **período com cargo** (decisão do Claude); os períodos sem cargo não contam para `abrirDaArea`, e `abrirDaArea` no conjunto "Sem cargo" não abre nada (sem cargo, sem área). `temPermissao` lê a lista da pessoa, não um mapa fixo. Mudança na grade vale no próximo clique.

`GET /auth/permissoes` devolve as permissões efetivas e o cargo (nome, posição, área) no lugar de `perfil`; o menu (`registro.ts`) segue decidindo por permissão.

### 5.3 Hierarquia (quem mexe em quê)

Valem para quem tem `permissoes.gerir` (grade e cargos) ou `pessoas.gerir` (pessoas e períodos). "Abaixo" = posição numericamente maior que a da pessoa; sem cargo = abaixo de todos. O presidente (posição 1) passa em todas.

- **Grade:** só altera cargos abaixo do seu, e o "Sem cargo". Só liga uma permissão que ela mesma tem. Pode desligar qualquer uma desses cargos.
- **Cargos:** cria cargo só com posição abaixo da sua; não muda um cargo para posição igual ou acima da sua; não desativa cargo do seu nível ou acima.
- **Pessoas e períodos:** só gere pessoas cujo cargo atual está abaixo do seu (ou sem cargo); só dá períodos com cargo abaixo do seu. Substitui `pessoas.gerirDiretores` e `exigirPodeGerirPerfil`.
- **Diretores entre si (confirmado pelo usuário, 26/11):** com todos os diretores na mesma posição, só o presidente altera um diretor, dá o cargo de diretor ou mexe na coluna dos diretores na grade. Hoje qualquer diretor faz isso (`pessoas.gerirDiretores`).
- **Cargo do presidente nunca fica vago:** não se encerra o último período aberto no cargo de posição 1 (400 com mensagem); a migração falha se esse cargo não tiver ocupante.
- **Os próprios períodos:** ninguém altera o próprio cargo, exceto o presidente (hoje: só diretor altera os próprios períodos, `PERIODO.PROPRIO`).
- Violação = 403 com mensagem que diz o porquê (ex.: "Você só altera cargos abaixo do seu."). Entrada inválida (posição não inteira, permissão fora do catálogo) = 400.

### 5.4 Abrir um projeto

`acessoAoProjeto` (`visibilidadeProjetos.ts`) passa a ser:

- **completo** se: projeto geral da área (todo logado, decisão de 25/11); ou a pessoa está ou esteve na equipe (decisão 9); ou é líder da área do geral (`lideresDaArea`, como hoje); ou tem `projetos.abrirTodos`; ou tem `projetos.abrirDaArea` e a área do projeto é igual à área do seu período aberto.
- **cartao** nos demais casos. O cartão é o da 27b (nome, tipo, área, status, líder, equipe).

Sai `projetos.sigiloso` (coluna, campo da API, selo, campo "Visibilidade" no formulário, `exigirNaoSeTrancar`, `SIGILOSO_SEM_VOCE`, `MENSAGENS.PROJETO.SEM_ACESSO(sigiloso)` vira uma mensagem só). Tarefas, anexos, comentários, Biblioteca ligada a projeto, perfil e ocupação continuam usando `acessoAoProjeto`, então herdam a regra nova sem regra própria.

Projeto de cliente **sem área**: hoje a área só é obrigatória no interno. Quem tem só `abrirDaArea` não abre projeto sem área. A consulta prévia (5.6) lista esses projetos para a gestão pôr a área antes do deploy; o builder avalia se a área passa a ser obrigatória ao criar (recomendado: sim, mas só conferida quando o campo muda, para não travar dados antigos; lição da 24b).

### 5.5 Telas

- **Configurações → Permissões** (nova aba; só com `permissoes.gerir`): grade com os cargos ativos em colunas (ordenados pela posição, presidente primeiro) mais "Sem cargo", e as permissões em linhas agrupadas (Pessoas, Projetos, Tarefas, Capacitações, Biblioteca, Gestão, Configurações), com o nome legível e uma linha de explicação. Colunas que a pessoa não pode alterar ficam só leitura. Gravar por cargo (um botão por coluna ou gravação ao marcar: escolha do builder, com confirmação ao desligar algo da própria pessoa não se aplica, pois ela não mexe no próprio cargo). No celular (375 px): um cargo por vez (seletor de cargo + lista de permissões).
- **Configurações → Cargos:** ganha "Posição" (número; ajuda: "1 = presidente; menor = mais alto"). "Lidera a área" e o teto continuam.
- **Pessoas:** sai o campo/coluna "Perfil"; a coluna passa a mostrar o cargo atual (já existe nos selos de área). Convite de pessoa nova não pede perfil: entra sem cargo e a gestão dá o período.
- **Projetos:** sai o selo "sigiloso" e o campo Visibilidade; o resto da 27a/27b fica.
- O frontend troca todo uso de `perfil` por permissões (`pode(...)`) ou pelo cargo; nada de decidir por nome de cargo.

### 5.6 Migração e publicação

Migração 030 (nome sugerido `030_permissoes_cargo.sql`):

1. `cargos.posicao` e tabela de permissões por cargo; conjunto "Sem cargo".
2. Permissões iniciais de cada cargo = as do perfil **mais baixo** entre as pessoas que o ocupam hoje (menor privilégio; diretor > gerente > membro, pelo mapa atual `PERMISSOES_POR_PAPEL`). Cargo sem ninguém: vazio. **Ajustes do Claude:** onde o mapa antigo daria `projetos.verTodos` a um gerente, o cargo recebe `projetos.abrirDaArea` (não `abrirTodos`), para a decisão 3 valer no dia do deploy; diretor recebe `abrirTodos`. `permissoes.gerir` e `clientes.ver` só para cargos com ocupante diretor e para o presidente. Posição inicial: 2 se algum ocupante é diretor, 3 se gerente, 4 nos demais.
3. Cargo do presidente: o cargo ativo cujo nome começa por "Presid" recebe posição 1. Se não houver exatamente um, ou se ele não tiver ninguém com período aberto, a migração **falha** com mensagem clara (a gestão acerta o nome antes).
4. Apaga `usuarios.perfil`, o tipo do perfil e `projetos.sigiloso`.

Antes do deploy, **consulta prévia** (no `docs/PUBLICACAO.md`, "Publicação da sessão 31a"), só leitura, listando:
- pessoas cujo acesso cai (perfil atual maior que o perfil mínimo do cargo), principalmente diretores e gerentes **sem período com cargo aberto** (perdem tudo);
- cargos com ocupantes de perfis diferentes;
- o cargo que vira presidente;
- projetos de cliente sem área.

A gestão acerta pela tela (períodos, área dos projetos, nome do cargo do presidente) **antes** do deploy; depois, ajusta a grade. Backup, back e front juntos, `Migração aplicada: 030_permissoes_cargo.sql` no log. Voltar = restaurar o `pg_dump` (a coluna `perfil` é apagada).

`seedAdmin` e os dados fictícios: o administrador inicial passa a receber um período aberto no cargo do presidente (cria o cargo "Presidente" se não houver), senão o primeiro acesso fica sem permissões.

### 5.8 Regras fixas que viram permissão

Levantamento do código em 26/11 (`ehTrainee`, `exigirNaoTrainee`, comparações com `PerfilUsuario`, itens do menu sem permissão). A grade ganha a coluna **"Trainee"**: quem tem status Trainee recebe esse conjunto no lugar do "Sem cargo" (trainee não tem cargo). Padrões da migração = comportamento de hoje.

| Regra de hoje | Onde | Vira | Padrão |
| --- | --- | --- | --- |
| Trainee sem Biblioteca (menu, rotas, anexos da Biblioteca) | `registro.ts` `semTrainee`, `BibliotecaRoutes`, `GerirAnexos` | `biblioteca.usar` | todos os cargos e "Sem cargo": sim; Trainee: não |
| Trainee não lidera projeto | `CriarProjeto`, `Equipe.ts` | `projetos.liderar` (pode ser escolhido como líder) | todos: sim; Trainee: não |
| Diretor lidera todas as áreas | `liderancaArea.ts` (perfil diretor) | `areas.liderarTodas` | cargos com ocupante diretor e presidente |
| Trainee só com perfil membro | `dadosPessoa.ts` | some (não há perfil) | — |
| Membro precisa de senioridade | `Usuario.ts` | builder decide sem perfil; não pode travar edição de dado antigo (lição da 24b) | — |
| Gestor edita o próprio cadastro só se diretor | `UsuarioRoutes.ts` | regra de hierarquia (5.3: só o presidente altera o próprio cargo) | — |
| Qualquer logado cria reunião | `GerirAgenda` | `reunioes.criar` | todos: sim, inclusive Trainee |

**Princípio (usuário, 26/11): quanto mais permissões de uso e de visibilidade, melhor**, para mudanças futuras serem feitas na grade, não no código. Por isso:

- **Cada tela do menu tem uma permissão de ver** (`<modulo>.ver`: Projetos, Tarefas, Agenda, Capacitações, Biblioteca, Pessoas, Relatórios, Precificação, Configurações), com o padrão de hoje. Só o **Dashboard** (tela inicial, chamada "Painel" no registro) e o próprio perfil ficam sempre abertos, para ninguém entrar numa tela vazia. A guarda do front e o menu passam a usar essas permissões.
- **Separar ver de mexer** onde hoje uma permissão faz as duas coisas. Ex.: `pessoas.ver` (lista de Pessoas) × `pessoas.gerir` (convidar, editar, períodos); `capacitacoes.criar` × `capacitacoes.presenca`; `biblioteca.verTodos` × `biblioteca.gerir` (já separadas); `configuracoes.editar` dividida por aba (áreas e cargos, dificuldade, precificação, projeto geral); visões da gestão (Alocação, Campinho, ocupação de todos, sobrecarga) em `gestao.visoes`.
- O builder fecha a lista final no plano, com o padrão de cada uma igual ao comportamento de hoje (ninguém ganha nem perde nada na migração além do que está na seção 5.6), e registra o catálogo completo no doc 06.

Grupo "Gestão" do menu (Relatórios e Simulador de Precificação): padrão só gerentes, diretores e presidente (como hoje). O builder confere, ao implementar, se apareceu outra regra geral fixa e a põe nesta tabela (registrando no doc 06).

### 5.7 Documentação

- `docs/sistema/06_documento_do_sistema.md`, seção 3 (permissões): reescrita para cargo, posição, grade, hierarquia e a regra de abrir projeto.
- `docs/GUIA_DE_USO.md`: aba Permissões e campo Posição.
- `docs/PUBLICACAO.md`: "Publicação da sessão 31a" com a consulta prévia.

## 6. Testes que precisam existir

- Unidade: `acessoAoProjeto` para equipe atual, ex-equipe, `abrirDaArea` na própria área, na subárea (não abre) e na área irmã (não abre), `abrirTodos`, geral; regras de hierarquia (grade, cargos, pessoas, próprio período, presidente).
- Integração: migração com dados nos três perfis (mínimo do cargo, posições, presidente, falha sem presidente); trocar permissão na grade vale na chamada seguinte; gerente tentando ligar permissão que não tem (403); gerente dando cargo de diretor (403).
- e2e pela tela: diretora ajusta a grade de um gerente; gerente de inovação vê completo só Inovação e cartão nos de Projetos; troca de conta na mesma aba (lição da 18); levantamento de telas com os papéis novos; 375 px escuro.

## 7. Deixado ao builder

- Forma da tabela de permissões (linha por par cargo/permissão ou array) e onde fica o "Sem cargo".
- Gravação da grade (por coluna ou ao marcar).
- Destino de cada uso de `projetos.verTodos` fora do abrir projeto (5.1), registrando no doc 06.
- Se a área do projeto de cliente passa a ser obrigatória ao criar (5.4).
