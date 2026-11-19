# Sessão 24a: dificuldade das tarefas e ocupação semanal (desenho)

Data: 19/11/2026. Pedido de 18/11 (roteiro, sessão 24), conversado com o usuário em 19/11.
A sessão 24 foi dividida: **24a** (este documento) e **24b** (certificado de horas por projeto, conversa própria depois da 24a publicada).

## 1. Intenção

A gestão precisa saber **o quão ocupado está cada membro** para distribuir tarefas sem sobrecarregar ninguém.
Hoje existe uma "alocação" em % digitada à mão na equipe de cada projeto (`participacoes.alocacao`, migração 002); o usuário acha confusa e ela não reflete o trabalho real.

Ideia do usuário: ao atribuir uma tarefa, quem atribui escolhe uma **classificação de dificuldade**; cada nível vale um número de horas; as horas das tarefas da pessoa se acumulam e viram a **% de ocupação da semana**, comparada a um teto semanal.

A Konvex tem cerca de 30 pessoas: tudo é calculado na hora da leitura.

## 2. Objetivos

1. Tarefa ganha **dificuldade**: Rápida, Fácil, Média, Difícil (sem "Muito difícil", decisão do usuário). Opcional.
2. Cada nível vale horas: Rápida 1 h, Fácil 2 h, Média 4 h, Difícil 8 h (padrão). A diretoria muda esses valores em Configurações.
3. **Teto semanal** pelo cargo: assessor e gerente 10 h; diretor e acima 20 h. Sem cargo: 10 h.
4. **Ocupação da semana** = horas da pessoa na semana ÷ teto, em %. Pode passar de 100%.
5. **Aviso** ao atribuir quando algum responsável passa de 100% na semana ("Fulano fica com 120% nesta semana (12 h de 10 h)"). Não bloqueia.
6. A ocupação aparece no **perfil**, na **equipe do projeto** e em **Pessoas**, com navegação entre semanas.
7. A % manual da equipe do projeto **sai** (coluna, API e telas).
8. Regra nova de cargo: **no máximo um período de área com cargo ao mesmo tempo**.

## 3. Não objetivos

- Certificado de horas, horas trabalhadas, confirmar horas ao concluir: **24b**.
- Notificação ao diretor e aos gerentes de projetos quando alguém passa de 100%: **sessão 26** (e-mail e avisos). Anotar lá.
- Feriados: não descontados (dias de semana = segunda a sexta). Se pedirem, vira opcional.
- Capacitações não entram na ocupação.

## 4. Anti-objetivos

- Bloquear atribuição acima do teto (o teto é limite de referência, não trava).
- Mostrar detalhes de tarefa de projeto que a pessoa não vê (sigilo, sessão 20) por meio da ocupação.
- Conta diferente entre telas (uma só fonte: o backend).

## 5. Regras de cálculo

### 5.1 Quais tarefas contam
- Tarefas **não concluídas** (`status` diferente de `concluida`) com **dificuldade** definida.
- De projetos que **não** estão `concluido` nem `arquivado` (inclui o geral da área e projetos em planejamento).
- Cada **responsável** recebe as horas **inteiras** do nível (decisão do usuário: a dificuldade mede o esforço de cada um).

### 5.2 Como as horas se espalham
- Dias de trabalho: **segunda a sexta** (decisão do usuário), fuso `America/Sao_Paulo`.
- As horas do nível se dividem igualmente pelos dias de semana entre `dataInicio` e `dataFim` (inclusive).
  Ex.: Difícil (8 h), segunda da semana 1 até sexta da semana 2 = 10 dias, 0,8 h/dia, 4 h em cada semana.
- Se o intervalo não tiver dia de semana (começa e termina no fim de semana): todas as horas na **sexta anterior**.
- **Tarefa atrasada** (aberta e `dataFim` antes de hoje): **todas** as horas do nível contam na **semana atual** e em nenhuma outra (ninguém confirmou que parte foi feita). Tarefa em dia que já começou mantém o espalhamento normal.
- Semanas passadas: navegação permitida, mostram o espalhamento das tarefas ainda abertas (não é histórico; tarefa concluída sai da conta). Avisar na tela com uma linha ("Mostra só tarefas abertas").
- Números com uma casa decimal na tela (ex.: 4,8 h); % arredondada para inteiro.

### 5.3 Teto
- `cargos.teto_semanal_horas` (inteiro, 1 a 40), editável em Configurações por quem tem `configuracoes.editar`.
- Migração define: nome que começa com diretor, presidente ou vice (sem acento, minúsculas) = 20; demais = 10. A gestão confere em Configurações.
- O teto da pessoa vem do cargo do seu período **aberto** com cargo (no máximo um, pela regra 5.4). Sem período com cargo: 10 h (constante no domínio).
- Para semanas futuras ou passadas, usar o cargo do período vigente naquela semana (segunda); se nenhum, 10 h. (Chamada do Claude; mais simples aceitável: cargo atual.)

### 5.4 Um cargo por vez
- Ao salvar um período (`GerirPeriodosArea`), se ele tiver cargo e houver outro período da mesma pessoa **com cargo** cujo intervalo se sobreponha: 400 `PERIODO_CARGO_SIMULTANEO`, mensagem com a área do período que conflita.
- Períodos sem cargo podem se sobrepor livremente (estar em Inovação e Projetos).
- A regra só barra a gravação que **cria ou aumenta** o conflito (cargo novo, troca de cargo, início antes ou fim depois do que estava). Só dar fim ou encurtar um período nunca é barrado (a saída da EJ encerra todos os períodos e não pode falhar). Comparar com a versão anterior do período.
- A migração **não** corrige dados: na publicação, consulta prévia na VPS lista quem tem dois cargos sobrepostos para a gestão corrigir à mão (bloco no `docs/PUBLICACAO.md`). Dados existentes que violam continuam carregando; só a próxima gravação daquele período é barrada.
- Teto com dados ainda inválidos (dois cargos abertos): usar o maior teto.

## 6. Dados (migração 019)

- `tarefas.dificuldade` texto nulo, CHECK em (`rapida`, `facil`, `media`, `dificil`).
- Tabela `horas_dificuldade` (`dificuldade` PK com o mesmo CHECK, `horas` NUMERIC(4,1) entre 0,5 e 40), preenchida com 1, 2, 4, 8. Chamada do Claude: tabela pequena em vez de colunas soltas, para caber no padrão de Configurações.
- `cargos.teto_semanal_horas` SMALLINT NOT NULL DEFAULT 10, CHECK 1 a 40, mais o UPDATE de 5.3.
- `participacoes.alocacao`: **DROP COLUMN** (decisão: a % manual sai). Voltar o back exige restaurar o `pg_dump`, como nas anteriores.

## 7. Backend

- Domínio: `domain/service/ocupacao.ts` (função pura: tarefas + horas por nível + tetos + semana + hoje → por pessoa `{ horas, teto, percentual, tarefas: [...] }`), substitui `alocacao.ts`. Testes de unidade cobrindo: espalhamento em 2 semanas, fim de semana, atrasada, vários responsáveis, sem dificuldade, projeto arquivado, teto sem cargo.
- Dificuldade em `Tarefa` (enum `DificuldadeTarefa`), entrada `dificuldade` em criar e editar (`null` limpa). Valor inválido = 400 dizendo o campo.
- Quem pode definir a dificuldade: quem pode criar ou editar a tarefa (sem permissão nova).
- **Rota de ocupação:** `GET /ocupacao?semana=AAAA-MM-DD` (qualquer data da semana; padrão hoje) → lista das pessoas com status `ativo` (inclui trainee) com `horas`, `teto`, `percentual`. Todo logado lê (total de todos; o pedido é a gestão saber quem está ocupado, e o membro precisa ver ao atribuir). Detalhe por tarefa: `GET /ocupacao/:codigoUsuario?semana=` traz as tarefas que somam, **só as que quem pede pode ver** pela regra `acessoAoProjeto`; por nível de acesso: `completo` = linha por tarefa (título, projeto, horas); `resumo` (ex.: gerente fora de sigiloso) = linha por projeto com o nome e as horas somadas, sem títulos (decisão da sessão 20: o nome do sigiloso pode aparecer, os detalhes não); `nada` = tudo somado numa linha "Outras tarefas", sem título nem projeto.
- **Aviso ao salvar:** criar e editar tarefa devolvem `avisosOcupacao: [{ codigoUsuario, nome, horas, teto, percentual }]` para cada responsável que fica acima de 100% em alguma semana tocada pela tarefa (a semana com maior % de cada um). Calculado depois de gravar, só quando a gravação mexe na conta (dificuldade, datas, responsáveis, status ou coluna). Vale também para `PATCH /tarefas/:codigo/coluna` (arrastar pode reabrir a tarefa) e `PATCH` de status. A tela mostra o aviso.
- Configurações: `GET/PUT /config/horas-dificuldade` (escrita: `configuracoes.editar`) e `tetoSemanalHoras` no `SalvarCargo`.
- Perfil (`ObterPerfilPessoa`): troca `alocacao` por `ocupacao` da semana atual (resumo + tarefas visíveis).
- Equipe: sai `alocacao` de `Participacao`, rotas, `resumoProjeto`, carregadores, `Equipe.ts` (deixa de devolver o alerta de alocação).
- `docs/sistema/06_documento_do_sistema.md` seção 3 e `docs/GUIA_DE_USO.md`: atualizar no mesmo PR.

## 8. Frontend

- `TaskModal`: campo **Dificuldade** (select com as horas ao lado, ex.: "Média (4 h)"); ao lado de cada responsável na escolha, a % da semana do prazo (de `GET /ocupacao`); depois de salvar, se vier `avisosOcupacao`, aviso amarelo (não erro): "Fulano fica com 120% na semana de 24/11 (12 h de 10 h)."
- `src/lib/ocupacao.js`: formatação (horas com vírgula, faixa de cor: até 80% normal, 81 a 100% atenção, acima de 100% perigo) e navegação de semana (segunda da semana, anterior, próxima). Com testes. Sem recálculo de horas no front.
- **Perfil:** cartão "Ocupação da semana" no lugar de "Alocação em projetos ativos": % com barra, "12 h de 10 h", setas de semana, lista das tarefas que somam (título, projeto, horas na semana) e a linha "Outras tarefas" quando houver.
- **Pessoas:** coluna "Ocupação" (% da semana atual, ordenável) na `Table`.
- **Equipe do projeto:** coluna "Alocação" vira "Ocupação na semana" (lida de `GET /ocupacao`, sem edição); some o campo de % no formulário da equipe.
- **Configurações:** seção "Horas por dificuldade" (4 campos) e "Teto semanal (h)" no formulário de cargo.
- `Projetos.jsx`: ajustar a dica do filtro de status que fala em alocação.
- Responsivo, Halo, claro e escuro. Memória das telas (`useCarregar` com `{ chave }` incluindo a semana).

## 9. Testes e verificação

- Backend: unidade do `ocupacao.ts`; HTTP das rotas novas (sigilo do detalhe, 400 de dificuldade e de cargo simultâneo); integração com PostgreSQL da migração 019 e da consulta.
- Frontend: testes do `src/lib/ocupacao.js`; e2e novo `e2e/ocupacao.mjs` **pela tela**: gestão cria tarefa Difícil de duas semanas para um assessor já com carga, vê o aviso acima de 100%, abre o perfil e navega a semana; membro vê o perfil de alguém com tarefa de projeto sigiloso e vê "Outras tarefas"; troca de conta na mesma aba; 375 px escuro. Levantamento de 52 telas.
- Dados fictícios: tarefas com dificuldade e um caso acima de 100%.

## 10. Publicação

Migração 019 apaga `participacoes.alocacao`. Antes do deploy: consulta de cargos simultâneos (5.4) e backup do banco e dos anexos; back e front juntos; "019" no log. Voltar = restaurar o `pg_dump` e voltar os dois.

## 11. Abordagens consideradas

1. **Calcular ao ler, no backend** (escolhida): uma só fonte de verdade, sem tabela para manter em dia; com cerca de 30 pessoas, a conta é instantânea.
2. Tabela de ocupação por semana recalculada a cada mudança: leitura mais rápida, mas toda edição de tarefa, período ou configuração teria de lembrar de recalcular; não compensa no porte da Konvex.
3. Calcular no navegador: inviável, o membro não vê todas as tarefas (sigilo), a conta sairia errada.

## 12. Decisões do usuário (19/11)

- Dificuldade em vez de horas digitadas; 4 níveis (sem "Muito difícil").
- Ocupação da **semana**; só dias de semana.
- Pode passar de 100%, com aviso; notificação à gestão fica para o futuro (26).
- Tarefa de duas semanas: horas divididas entre as semanas.
- Vários responsáveis: cada um recebe as horas inteiras.
- Pessoa pode estar em duas áreas, mas não ter dois cargos ao mesmo tempo.
- Certificado na 24b.

## 13. Chamadas do Claude (mudar se o usuário discordar)

- Horas por nível editáveis pela diretoria em Configurações; tarefa sem dificuldade conta 0 h.
- Teto no cargo, editável; migração põe 20 para diretor/presidente/vice.
- Um período com cargo por vez (outros sem cargo), em vez de "mesmo cargo em todos".
- Tarefa só no fim de semana conta na sexta anterior; atrasada joga o restante na semana atual.
- Conta só tarefas de projetos não concluídos nem arquivados.
- Total de ocupação visível a todo logado; detalhe por tarefa respeita o sigilo.
- Aviso calculado pelo backend depois de salvar (não antes).
