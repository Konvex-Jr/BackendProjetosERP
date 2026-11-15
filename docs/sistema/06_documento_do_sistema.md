# Documento do sistema: módulos, regras e quem vê e faz o quê (14/11/2026)

> **Sessão 17 (Biblioteca):** este documento descreve o sistema com a Biblioteca, implementada na branch `feat/biblioteca` e **ainda não publicada**. A produção só muda depois do merge e da publicação.

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

"Gestão" = diretores e gerentes. Trainee é uma pessoa cadastrada (status `Trainee`), entra em projetos, mas **não tem login**. Não há cadastro público: a gestão cria as contas.

### Duas camadas de permissão
1. **Ações do catálogo, por papel.** `source/shared/seguranca/catalogoPermissoes.ts` lista as ações (`projetos.editar`, `tarefas.atribuir`…) e o mapa `PERMISSOES_POR_PAPEL` diz quais cada papel tem. As rotas checam a ação, nunca o papel (`exigirPermissao` e `temPermissao` em `permissoes.ts`).
   - Diretor: todas as ações.
   - Gerente: todas, **menos** `pessoas.gerirDiretores`, `projetos.excluir` e `configuracoes.editar` (lista `DO_GESTOR`).
   - Membro: **nenhuma**. Tudo o que o membro faz vem da camada 2.
2. **Regras por item.** Para o que depende da relação da pessoa com o item (autor, responsável, líder, participante, área, instrutor), há uma regra por módulo em `source/shared/seguranca/`:

| Arquivo | Decide |
|---|---|
| `visibilidadeProjetos.ts` | Quais projetos a pessoa vê (`participaOuParticipou`, `exigirVerProjeto`, `projetosVisiveisPara`) |
| `regrasTarefa.ts` | Ver, organizar, mudar status e comentar em cada tarefa (`papelNoProjeto`, `regrasTarefa`) |
| `regrasBiblioteca.ts` | Quem lê e quem altera um item da Biblioteca, e quem pode usar sigilo e projeto (`podeVerItem`, `podeAlterarItem`, `exigirPodeUsarSigiloEProjeto`) |
| `regrasCapacitacao.ts` | Gestão de capacitações e acesso às avaliações (`podeGerirCapacitacoes`, `acessoAosFeedbacks`) |

### Detalhes que valem para tudo
- O papel é lido do banco **a cada requisição**, não do token: mudar o papel de alguém vale na chamada seguinte (`UsuarioAutenticado` em `permissoes.ts`).
- Papel desconhecido recebe lista vazia (na dúvida, nega: `permissoesDoPapel`).
- 401 sem login, 403 sem permissão. Itens que a pessoa nem pode saber que existem respondem **404**: item da Biblioteca que ela não lê, tarefa avulsa de outra pessoa, anexo de item que ela não lê.
- A API devolve booleanos por item (`podeAlterar`, `podeGerir`, `podeInscrever`…) e a tela obedece. O menu vem de `GET /auth/permissoes`, montado por `menuDoUsuario` em `source/modulos/registro.ts`; o `Layout` do frontend só abre telas que vieram no menu.
- Login: 5 falhas bloqueiam aquele e-mail naquele IP, e 30 falhas bloqueiam o IP inteiro, por 15 minutos (429; `limiteTentativas.ts`, limites em `LoginUsuario.ts`). Sessão: JWT de 15 min + refresh de 7 dias.

## 2. Módulos e regras de negócio

Os módulos estão registrados em `source/modulos/registro.ts` (rotas, ações do catálogo e itens de menu). Ordem do menu: Dashboard, Tarefas, Projetos, Capacitações, Biblioteca, Visão Estratégica, Simular precificação, Pessoas, Configurações, Meu perfil.

### Pessoas (`/usuarios`, `/auth/*`, `/habilidades`)
- A gestão cadastra, edita, muda o status e redefine a senha. Criar, editar ou promover **diretor** exige também `pessoas.gerirDiretores` (`exigirPodeGerirPerfil`).
- Ninguém altera o próprio papel nem o próprio status, nem inativa a própria conta.
- Ninguém é excluído (ADR-006): `DELETE /usuarios/:codigo` só muda o status para Inativo. Quando alguém sai, as participações em projetos são encerradas e o histórico fica.
- Trocar área ou cargo grava histórico (`historico_areas`, `historico_cargos`).
- Cada pessoa edita no próprio perfil só contato e apresentação: nome de exibição, telefone, LinkedIn, GitHub, link do calendário, curso, semestre, bio e tecnologias (`PUT /auth/perfil`). E troca a própria senha.
- Todos os logados consultam a lista de pessoas e os perfis (links e tecnologias visíveis). No perfil de outra pessoa, o membro vê só os projetos que os dois compartilham (`ObterPerfilPessoa`).
- O perfil mostra projetos atuais e anteriores, histórico de área e cargo, capacitações e horas cumpridas (só com presença marcada).

### Configurações (`/areas`, `/cargos`, `/senioridades`)
- Só o diretor cria e edita áreas (hierárquicas, com subáreas), cargos e senioridades (`configuracoes.editar`). Todos os logados leem as listas (servem aos formulários).
- A área **Inovação** não dá mais nenhum direito especial (desde a sessão 17). É só uma área como as outras.
- `valor_hora` da senioridade ainda é 0: a precificação pela API espera a diretoria definir as taxas.

### Projetos (`/projetos`)
- A gestão vê todos (`projetos.verTodos`). O membro vê só os projetos de que participa **ou participou**: quem saiu continua vendo o histórico.
- A gestão cria e edita, muda a situação (Em andamento, Atenção, Bloqueado, Concluído, Arquivado), monta a equipe (função, alocação, entrada e saída) e escolhe o líder (`projetos.editar`). Um líder por projeto, escolhido na equipe.
- O sistema avisa quando a alocação de alguém passa de 100%.
- Só o diretor exclui projeto (`projetos.excluir`); excluir leva junto os itens da Biblioteca com sigilo "Equipe do projeto" (e os anexos deles); os itens de sigilo Todos ou Só gestão só perdem a ligação com o projeto. O recomendado é Arquivar.
- Ativos = Em andamento, Atenção e Bloqueado.

### Tarefas (`/tarefas`)
Toda tarefa tem **projeto** ou **categoria** (Inovação, Capacitação, Execução). Sem projeto, ela é "avulsa". Tarefas antigas ligadas a iniciativas perderam essa ligação (a migração 012 removeu a coluna). O acompanhamento de inovação é feito com tarefas avulsas de categoria Inovação, que continuam só da gestão.

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
- Arquivos de itens da Biblioteca e de capacitações. Até 20 MB; PDF, Office, OpenDocument, CSV, TXT, MD, imagens e ZIP. Guardados no disco da VPS.
- **Cada anexo segue as regras do dono** (`GerirAnexos.acesso`): baixa quem lê o dono; envia e exclui quem altera o dono. Excluir o dono apaga os anexos dele. O script `conferirAnexos` acha arquivos órfãos; com `--apagar-sem-registro` apaga os arquivos sem registro, menos os de menos de 10 minutos.

### Painel, Visão Estratégica e Precificação (só no frontend)
- **Dashboard**, para todos: tarefas abertas e atrasadas da pessoa, burndown e capacitações inscritas. A faixa com os **sete indicadores** (projetos ativos, em atenção, concluídos, membros ativos, capacitações próximas, tarefas da semana e atrasadas) aparece só com `projetos.verTodos` (`Dashboard.jsx`).
- **Visão Estratégica** (`estrategia.ver`) e **Simular precificação** (`precificacao.simular`): gestão. Não têm rota na API; o controle é o item de menu. A precificação calcula no navegador.

## 3. Matriz papel × o que vê e o que faz

Legenda: ✅ pode · ❌ não pode · texto = pode, com a condição. "Código" aponta a ação do catálogo (`catalogoPermissoes.ts`) ou a regra em `source/shared/seguranca/` que decide.

### Pessoas e configurações
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver lista de pessoas e perfis | ✅ | ✅ | ✅ | só login (`UsuarioRoutes`) |
| Ver projetos no perfil de outra pessoa | todos | todos | só os em comum | `projetos.verTodos` + `participaOuParticipou` |
| Editar o próprio contato, tecnologias e senha | ✅ | ✅ | ✅ | só login (`/auth/perfil`, `/auth/senha`) |
| Cadastrar, editar, mudar status, redefinir senha de membro ou gerente | ✅ | ✅ | ❌ | `pessoas.gerir` (`exigirPodeGerirPerfil`) |
| O mesmo para diretores (ou promover a diretor) | ✅ | ❌ | ❌ | `pessoas.gerirDiretores` |
| Alterar o próprio papel ou status | ❌ | ❌ | ❌ | `UsuarioRoutes` (checagem explícita) |
| Criar e editar áreas, cargos, senioridades | ✅ | ❌ | ❌ | `configuracoes.editar` |

### Projetos
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver projetos | todos | todos | os que participa ou participou | `projetos.verTodos` / `visibilidadeProjetos.ts` |
| Criar, editar, mudar situação, montar equipe, escolher líder | ✅ | ✅ | ❌ | `projetos.editar` |
| Excluir projeto | ✅ | ❌ | ❌ | `projetos.excluir` |

### Tarefas
| Ação | Diretor | Gerente | Membro | Código |
|---|---|---|---|---|
| Ver tarefas de projeto | todas | todas | dos seus projetos (atuais e anteriores) e as que é responsável | `projetos.verTodos` + `regrasTarefa().ver` |
| Criar tarefa em projeto | ✅ | ✅ | se é da equipe atual (fica responsável) | `tarefas.gerirTodas` / `papelNoProjeto` |
| Editar, atribuir, excluir tarefa de projeto | ✅ | ✅ | se é líder do projeto | `regrasTarefa().organizar` |
| Concluir ou reabrir tarefa de projeto | ✅ | ✅ | se é líder, ou participante e responsável | `regrasTarefa().mudarStatus` |
| Comentar em tarefa de projeto | ✅ | ✅ | se é da equipe atual | `regrasTarefa().comentar` |
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

## 5. O que ainda não existe
Homologação, auditoria (quem mudou o quê), LGPD e retenção, precificação pela API, Google Calendar, e-mails, busca global, Board Tático, CRM. Ver o `.konvex/roteiro.md` (fases 6 e 7).
