# Sessão 23: áreas múltiplas e projetos internos (design)

Data: 18/11/2026. Dividida em duas entregas, cada uma com seu par de PRs (back e front):

- **23a**: várias áreas por pessoa, trajetória por períodos com datas editáveis, cargo que lidera e regra de liderança pela hierarquia das áreas.
- **23b**: projetos internos, projeto geral por área, fim da tarefa avulsa e filtros.

## 1. Por que

A Konvex é organizada em áreas: o sistema é focado na área de Projetos, que tem subáreas, entre elas Inovação (tarefas próprias), Execução (quase todos os membros; executa coisas de projetos e o que surge para a EJ) e Capacitação (sai de Projetos em 2027). Hoje o sistema não representa isso:

- cada pessoa tem **uma** área e **um** cargo (`usuarios.area_codigo`, `usuarios.cargo_codigo`), mas há quem esteja em duas ao mesmo tempo (o usuário é gerente de Inovação e está em Projetos);
- a trajetória guarda trocas (`historico_areas`, `historico_cargos`), sem períodos paralelos e sem corrigir datas;
- a tarefa avulsa tem uma categoria fixa no código (Inovação, Capacitação, Execução) sem ligação com o cadastro de áreas; só a gestão cria e só o responsável vê;
- a Inovação tem vários projetos internos (alguns produtos da Konvex vieram deles) e tarefas de pesquisa que ainda não são projeto (validar se vale seguir com uma ideia).

Sucesso: a liderança de cada área distribui e acompanha as tarefas da área; a equipe da área vê o que está acontecendo; o histórico de áreas e cargos de cada pessoa pode ser lançado com as datas reais; projetos internos aparecem e contam como projetos.

## 2. Objetivos, não objetivos, antiobjetivos

Objetivos:
- Pessoa em várias áreas em paralelo, cada uma com seu cargo e período.
- Gestão lança e corrige o histórico (datas no passado).
- Quem lidera uma área gere as tarefas dela e das áreas abaixo (regra provisória, num lugar só).
- Toda tarefa pertence a um projeto; o que não é projeto fica no projeto geral da área.

Não objetivos:
- Permissões definitivas por área: o usuário vai discutir com as lideranças da EJ. A regra fica isolada para trocar depois.
- Mudar a matriz de papéis do sistema (diretor, gerente, membro) além do descrito aqui.
- Converter o histórico antigo de trocas (decisão do usuário: um membro vai normalizar à mão).

Antiobjetivos (falha mesmo se funcionar):
- Membro passar a ver tarefas de área em que não está, ou de projeto de que não participa.
- Projeto interno sumir de indicadores ou do perfil: ele é projeto de verdade.
- Duas fontes de verdade para "quem está na área" (equipe do projeto geral não é cadastrada; vem dos períodos).

## 3. Abordagens consideradas

Para a ligação tarefa ↔ área:
- **A. Tarefa avulsa aponta para uma área do cadastro**, com a tela Tarefas filtrando por área. Mantém dois tipos de tarefa.
- **B. Categoria fixa mapeada para uma área em Configurações.** Menos banco, mas área nova exige código novo; descartada.
- **C. Área como projeto interno.** Reaproveita quadro, etapas, comentários e anexos.

O usuário pediu um misto de A e C e depois chegou ao modelo escolhido: **projetos internos de verdade (vários por área) + um projeto geral por área para o que ainda não é projeto; a tarefa avulsa deixa de existir** ("1" na conversa de 18/11). A alternativa "tarefa avulsa da área com quadro próprio ao lado dos internos" foi descartada: dois tipos de tarefa, duas regras de acesso e uma cópia do quadro do projeto.

## 4. Decisões do usuário (18/11)

1. Criar e distribuir as tarefas de uma área: o líder da área (gerente/diretor da área) e os superiores dele. Pode mudar depois da conversa com as lideranças.
2. "Superior" é pela **hierarquia das áreas** (área pai, avó…), e o papel **diretor** do sistema gere tudo. (Opção 1 da conversa.)
3. Membro da área **vê e comenta** as tarefas da área que não são dele; concluir, mover e anexar ficam com o responsável e a liderança (mesma lógica da tarefa de projeto).
4. Trajetória: **recomeçar do estado atual** (cada pessoa ganha um período aberto com a área e o cargo de hoje); o histórico de trocas antigo é apagado; a gestão lança o passado à mão, então tudo precisa ser editável.
5. Projetos internos contam como projetos em tudo (indicadores, perfil, Estratégia), com filtro cliente/interno para separar. Uma área pode ter vários.
6. Tarefas que não são de projeto (pesquisa, validação, coisas para a EJ) ficam no **projeto geral** da área.
7. Dividir em 23a e 23b.

## 5. Parte 23a: áreas, períodos e liderança

### 5.1 Dados (migração 017)

- `cargos.lidera_area BOOLEAN NOT NULL DEFAULT FALSE`. Na migração, marcar como `TRUE` os cargos cujo nome começa com "Gerente" ou "Diretor" (sem diferenciar maiúsculas e acentos); a gestão confere em Configurações.
- Tabela `periodos_area`:
  - `codigo UUID PK`, `usuario_codigo` (FK usuarios, RESTRICT), `area_codigo` (FK areas, RESTRICT), `cargo_codigo` (FK cargos, RESTRICT, **nulo permitido**: pessoa na área sem cargo definido), `inicio DATE NOT NULL`, `fim DATE NULL`, `registrado_por`, `registrado_em`.
  - `CHECK (fim IS NULL OR fim >= inicio)`.
  - `fim` é o dia em que a pessoa **saiu** da área (intervalo `[inicio, fim)`): trocar de cargo na mesma área = encerrar o período no dia X e abrir outro começando em X (**chamada minha**).
  - Sem sobreposição de períodos da **mesma pessoa na mesma área**: `EXCLUDE USING gist (usuario_codigo WITH =, area_codigo WITH =, daterange(inicio, fim, '[)') WITH &&)` (extensão `btree_gist`). O código confere antes e devolve 400 legível; a constraint é a rede de segurança para gravações simultâneas.
- Carga inicial: para cada pessoa com `area_codigo`, um período aberto com a área e o `cargo_codigo` atuais; início = `data_entrada`, ou a data de criação da conta se não houver. Pessoa fora da EJ (status Alumni ou Inativo, `STATUS_DE_SAIDA`) com área: período fechado em `data_saida`; sem `data_saida`, fechado no próprio início (período de um dia, para a gestão corrigir) (**chamada minha**).
- Pessoa com cargo e sem área: não há período possível; o cargo se perde. A publicação lista essas pessoas **antes** do deploy (seção 7).
- Saem: `usuarios.area_codigo`, `usuarios.cargo_codigo`, `historico_areas`, `historico_cargos`.

### 5.2 Regras

- Datas nunca no futuro (`inicio` e `fim` ≤ hoje, fuso `America/Sao_Paulo`). Encerrar = gravar `fim`.
- Período de área inativa: não se abre período novo nem se reabre; os existentes ficam.
- Cargo inativo: não pode ser escolhido em período novo ou editado para ele; os existentes ficam.
- Mesma pessoa pode ter vários períodos abertos, desde que em áreas diferentes.
- **Áreas atuais** da pessoa = períodos com `fim` nulo.
- Pessoa sai da EJ (Alumni ou Inativo): os períodos abertos são **sempre** encerrados na data de saída (ou hoje), independentemente da opção `encerrarParticipacoes`, que segue valendo só para projetos (**chamada minha**: período aberto de quem saiu faria a pessoa contar como equipe e liderança da área).
- Pessoa volta (status de volta a Ativo): os períodos não reabrem; a gestão abre novos à mão (**chamada minha**).
- Só pessoa na EJ (`STATUS_NA_EJ`) pode ter período **aberto**; para quem saiu, só períodos encerrados até a data de saída (`PESSOA_FORA_DA_EJ`, `FIM_DEPOIS_DA_SAIDA`). O início pode ser anterior à data de entrada (a data de entrada também pode estar errada e ser corrigida depois) (**chamada minha**).
- `lideraArea` e "áreas atuais" também exigem a pessoa na EJ (defesa contra dado incoerente).
- Trainee: pode ter períodos como qualquer pessoa.
- Só a gestão (`pessoas.editar`) cria, edita, encerra e exclui períodos. Erros 400 dizem o campo: `INICIO_NO_FUTURO`, `FIM_NO_FUTURO`, `FIM_ANTES_DO_INICIO`, `PERIODO_SOBREPOSTO` (com o período em conflito), `AREA_INATIVA`, `CARGO_INATIVO`.
- Quem lê a trajetória: o mesmo de hoje para o histórico no perfil (`ObterPerfilPessoa`).

### 5.3 Liderança (regra provisória, isolada)

Arquivo `source/shared/seguranca/liderancaArea.ts`:
- `lideraArea(usuario, codigoArea, areas, periodosAbertosDoUsuario)`: verdadeiro se a pessoa tem o papel **diretor** do sistema, ou tem período aberto com cargo `lidera_area` **nesta área ou em alguma área acima** (subindo por `area_pai_codigo`, com proteção contra ciclo).
- `areasLideradas(...)`: a área e todas as abaixo dela, para cada período de liderança.
- Na 23a a regra é criada e testada; quem a usa é a 23b (projeto geral e projetos internos). Comentário no arquivo: "regra provisória; as lideranças da EJ vão decidir a definitiva (18/11/2026)".

### 5.4 API

- `GET /usuarios/:codigo/periodos`: lista (abertos primeiro, depois por início decrescente), com área e cargo.
- `POST /usuarios/:codigo/periodos` `{ codigoArea, codigoCargo?, inicio, fim? }`.
- `PUT /usuarios/:codigo/periodos/:codigoPeriodo` (mesmo corpo; edita datas, área e cargo).
- `DELETE /usuarios/:codigo/periodos/:codigoPeriodo` (lançamento errado).
- Criar e editar pessoa deixam de receber `codigoArea` e `codigoCargo` (campo enviado é ignorado; **chamada minha**, para não quebrar tela antiga em cache durante a publicação). A resposta da pessoa traz `areas: [{ area, cargo, inicio }]` (atuais) no lugar de `area` e `cargo`.
- Perfil: `historico` vira `periodos` (todos).
- Configurações: cargo ganha `liderarArea` no corpo e na resposta.
- Repositório novo `PeriodoAreaRepository` (interface + memória + banco + factories).

### 5.5 Frontend

- **Pessoas**: o formulário perde Área e Cargo; a lista mostra as áreas atuais como selos ("Inovação · Gerente"); filtro por área passa a olhar as áreas atuais.
- **Ficha/perfil da pessoa**: seção "Áreas e cargos" substitui "Histórico de cargo e área": períodos atuais em cima, anteriores embaixo, com início e fim. Para a gestão: "Adicionar período", lápis na linha (janela com área, cargo, início, fim), "Encerrar" (pede a data, padrão hoje) e excluir (com `alerts.confirm`). Datas futuras bloqueadas no campo.
- **Cabeçalho do perfil**: em vez de "cargo · área", as áreas atuais.
- **Configurações › Cargos**: caixa "Lidera a área".
- Responsivo, Halo, claro e escuro.

### 5.6 Deixado ao construtor (chamadas minhas, conferir)

- Ordem e texto exatos dos selos; nome da seção.
- Se o filtro de Pessoas por área inclui as áreas abaixo (proposta: não, só a própria).

## 6. Parte 23b: projetos internos e projeto geral

Desenhada aqui no nível das decisões; o plano da 23b detalha depois da 23a.

- `projetos.tipo` (`cliente` | `interno`, padrão `cliente`). Interno exige área. O campo `area_codigo` do projeto já existe.
- **Projeto geral da área**: um por área ativa, criado automaticamente (migração para as existentes; ao criar área nova). Marcado (`geral_da_area`), nome "<Área> · geral". Não pode ser excluído, arquivado nem ficar sigiloso; o nome acompanha a área. Área inativada: o geral é arquivado.
  - **Equipe** = pessoas com período aberto na área (calculada, não gravada em participações). Quem saiu da área vira "ex-participante" (lê, não comenta), pelo período encerrado.
  - **Liderança** = `lideraArea` (5.3): cria, distribui, edita, move e exclui qualquer tarefa; edita as etapas do quadro.
  - Membro da área: vê, comenta; cria tarefa só para si (como participante de projeto); conclui, move e anexa nas suas.
- Outros projetos internos: projetos normais (equipe e líder cadastrados), com `tipo = interno` e área.
- **Fim da tarefa avulsa**: toda tarefa tem projeto. A migração move cada avulsa para o geral da área correspondente à categoria (Inovação → área "Inovação", Execução → "Execução", Capacitação → "Capacitação", pelo nome sem acento e sem maiúsculas; área ausente é criada abaixo da área "Projetos", ou na raiz se "Projetos" não existir). As tarefas ganham a coluna de entrada ou concluída conforme o status. Saem `tarefas.categoria`, o enum e `tarefas.atribuir` como regra de avulsa.
- **Filtros**: Projetos ganha cliente/interno (e área); Tarefas filtra por projeto, com os internos agrupados pela área. Indicadores, Estratégia e perfil contam todos, com o filtro para separar.
- A gestão (`tarefas.gerirTodas`) continua gerindo qualquer projeto, inclusive os gerais (**chamada minha**: hoje o gerente gere todas as tarefas; tirar isso é decisão das lideranças).

## 7. Publicação da 23a

1. Antes do deploy: listar pessoas com cargo e sem área, e os cargos que a migração vai marcar como "lidera" (consulta pronta no `docs/PUBLICACAO.md`).
2. Backup do banco e dos anexos.
3. Deploy back e front juntos (a 017 roda ao iniciar). Conferir "017" no log.
4. A gestão confere os cargos que lideram e lança os períodos antigos.

Voltar = restaurar o `pg_dump` e voltar os dois.

## 8. Testes

- Domínio: período (datas, futuro, fim antes do início), sobreposição, área/cargo inativos, liderança pela hierarquia (pai, avó, ciclo, diretor, cargo sem `lidera_area`, período encerrado não lidera).
- HTTP: rotas de período com 400/403/404; criar/editar pessoa sem área.
- Integração (PostgreSQL): migração 017 com dados no formato antigo; constraint de sobreposição com duas gravações simultâneas.
- Frontend: lib de períodos (ordenar, validar datas), telas; e2e pela tela: gestão lança período passado, edita, encerra; membro vê sem botões.
- Revisor final: "troca de conta na mesma aba" e "dá para fazer pela tela?".
