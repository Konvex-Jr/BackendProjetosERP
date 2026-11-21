# Sessão 26a: central de avisos e ocupação no Dashboard

Data: 20/11/2026. Back e front, um PR por repositório. Migração 023.

## 1. Por que

Hoje a pessoa só descobre que recebeu uma tarefa, que algo está vencendo ou que saiu uma capacitação nova se abrir a tela certa. A gestão só vê quem está sobrecarregado entrando em Pessoas. A 26a coloca isso num lugar só: um sininho no topo, para todos, e um cartão de ocupação no Dashboard, para a gestão.

## 2. Escopo

**Entra (26a):**
- Central de avisos (sininho na barra do topo, `Layout.jsx`).
- Cartão "Ocupação da semana" no Dashboard, só para a gestão: "Mais ocupados" (top 5), "Livres" e aviso de quem passa de 100%.
- Aviso de sobrecarga na central para diretor e gerentes.

**Não entra:**
- E-mail (decisão do usuário em 20/11: "por enquanto só dentro do ERP, depois vemos se é útil"). Vai para os Opcionais do acompanhamento.
- Aniversários, comunicados com versão do sistema: 26b. A tabela da 26a já precisa aceitar esses tipos depois sem migração destrutiva (o tipo é texto com CHECK, que a 26b amplia).
- Preferências (desligar avisos): sem e-mail, não há o que desligar. A central fica sempre ligada.
- Agendador na API (cron): o desenho dispensa.

**Anti-objetivos:** a central não pode vazar projeto sigiloso (título de tarefa de projeto que a pessoa não vê); o sininho não pode virar um número que nunca zera.

## 3. Abordagem escolhida

Consideradas:
- **A. Tudo gravado:** cada aviso vira linha por destinatário. Exige agendador diário para "vence amanhã" e "sobrecarga", que não são ações de ninguém.
- **B. Tudo calculado na leitura:** sem tabela e sem agendador, mas "você recebeu uma tarefa" não tem data (o sistema não guarda quando a pessoa virou responsável) e não há "lido" por aviso.
- **C. Misto (escolhida pelo usuário em 20/11):** ação de alguém é **gravada** (tarefa recebida, capacitação nova; na 26b, comunicado e aniversário); situação é **calculada na leitura** (a vencer, atrasada, capacitação próxima, sobrecarga). Sem agendador; "lido" nos gravados; os calculados somem sozinhos quando a situação acaba.

## 4. Avisos gravados

Tabela nova `avisos` (migração 023):

| coluna | tipo | nota |
| --- | --- | --- |
| `codigo` | UUID PK | |
| `usuario_codigo` | UUID FK usuarios ON DELETE CASCADE | destinatário |
| `tipo` | VARCHAR com CHECK (`tarefa_recebida`, `capacitacao_nova`) | 26b amplia o CHECK |
| `tarefa_codigo` | UUID NULL FK tarefas ON DELETE CASCADE | |
| `capacitacao_codigo` | UUID NULL FK capacitacoes ON DELETE CASCADE | |
| `autor_codigo` | UUID NULL FK usuarios ON DELETE SET NULL | quem fez a ação |
| `criado_em` | TIMESTAMPTZ default now() | |
| `lido_em` | TIMESTAMPTZ NULL | |

Índice em `(usuario_codigo, criado_em DESC)`. O aviso não guarda título: título e projeto são lidos na hora (sempre atuais e sujeitos ao sigilo do momento).

**Quando grava:**
- `tarefa_recebida`: em criar tarefa, editar tarefa (responsáveis mudaram), para cada responsável **novo** (estava fora, entrou), exceto quem fez a ação. Mesma transação da gravação da tarefa: o caso de uso passa a rodar em `factory.emTransacao` (hoje a transação é aberta dentro do repositório; `PgConexao.transacao` reaproveita a transação aberta). O mesmo vale para a capacitação. Tarefa já tinha aviso não lido para a pessoa: não duplica.
- `capacitacao_nova`: ao criar capacitação (não ao editar), para todas as pessoas com login e status na EJ (`STATUS_NA_EJ`), inclusive trainee, exceto quem criou.

**Ao ler (sigilo):** `tarefa_recebida` só aparece se `acessoAoProjeto(pessoa, projeto) === "completo"` e a pessoa ainda é responsável; senão é omitido da resposta (não apagado). Tarefa ou capacitação excluída: o aviso cai junto (CASCADE).

**Contagem:** `naoLidos` conta só os avisos visíveis (o filtro de sigilo roda antes da contagem e do corte dos 30), para o número sempre bater com a lista.

**Limpeza:** ao ler, apagar os avisos lidos da pessoa com mais de 30 dias. Lista devolve no máximo os 30 mais recentes.

## 5. Avisos calculados (na leitura, para quem pede)

Datas no fuso de São Paulo (`shared/datas`, `hoje()`), prazo pelo dia (como a 24a).

| Aviso | Regra | Quem |
| --- | --- | --- |
| Tarefas atrasadas | responsável, não concluída, prazo antes de hoje | todos |
| Tarefas a vencer | responsável, não concluída, prazo hoje ou amanhã | todos |
| Capacitação próxima | inscrito, capacitação hoje ou amanhã | todos |
| Sobrecarga | pessoas acima de 100% na semana atual (`ConsultarOcupacao.todas`) | diretor (ADMIN) e gerente (MANAGER), por papel (decisão do usuário, 20/11) |

Tarefas de projeto concluído ou arquivado não contam (mesma regra da ocupação). Tarefas só de projetos com acesso completo. Responsável pode ficar sem acesso (saiu da equipe de um sigiloso, mas segue em `tarefa_responsaveis`): nesse caso deixa de receber os avisos dessa tarefa, de propósito (o sigilo vale mais). Atrasadas e a vencer saem agrupadas ("3 tarefas atrasadas"), com a lista das tarefas ao abrir o grupo; sobrecarga lista nome e percentual (o total já é público a todo logado desde a 24a).

## 6. API

- `GET /avisos` → `{ naoLidos: number, gravados: [...], situacao: [...] }`. Cada item com `tipo`, dados para exibir (título, projeto, data, autor) e destino do clique (código da tarefa/capacitação).
- `PATCH /avisos/lidos` com `{ codigos?: string[] }`: sem `codigos`, marca todos da pessoa; com `codigos`, só esses e só se forem dela (de outra pessoa = ignorado, sem erro).
- Os dois exigem login; nenhuma permissão nova no catálogo; não é módulo de menu.

## 7. Tela

**Sininho** (barra do topo, à esquerda do avatar, `Layout.jsx`):
- Número vermelho = só os **gravados não lidos**. Calculados não entram no número (senão nunca zera); se houver atrasada ou sobrecarga, um ponto discreto aparece mesmo sem número.
- Abre um painel (dropdown; em 375 px, folha em tela cheia): seção "Novos" (gravados, não lidos em destaque) e "Agora" (calculados). Botão "Marcar tudo como lido".
- Clicar num aviso marca como lido e leva ao destino: tarefa → tela Tarefas com `?tarefa=<codigo>` na URL, que abre a `TaskModal` dessa tarefa a partir da lista já carregada (sem rota nova no back; tarefa fora da lista = aviso "Tarefa não encontrada"); capacitação → Capacitações; sobrecarga → perfil da pessoa.
- Atualiza ao abrir o painel, ao trocar de tela e a cada 2 minutos com a aba visível. Memória por pessoa (`useCarregar` com `{ chave }`); troca de conta na mesma aba não mostra avisos da conta anterior.
- Visual Halo, claro e escuro, `responsive.css`.

**Cartão no Dashboard** (só se `papel` for ADMIN ou MANAGER):
- "Ocupação da semana", com `GET /ocupacao` (já existe):
  - Aviso no topo quando alguém passa de 100% ("2 pessoas acima de 100%").
  - "Mais ocupados": 5 maiores percentuais, nome + % + barra.
  - "Livres": até 5 com menor percentual abaixo de 50%, do menor para o maior.
- Nome leva ao perfil.

```
 Ocupação da semana                      ⚠ 2 acima de 100%
 Mais ocupados                 Livres
 Ana Souza      130% ████▌     Davi    0%
 Bruno Lima     105% ███▋      Eva    20%
 ...                           ...
```

## 8. Testes e documentação

- Back: domínio puro para os calculados (função que recebe tarefas, inscrições, hoje), caso de uso com repositório em memória, integração para a 023, gravação na transação da tarefa e sigilo (pessoa sai da equipe de sigiloso → aviso some).
- Front: `src/lib/avisos.js` (agrupar, contar, destino) com teste; e2e `e2e/avisos-26a.mjs` (gestor dá tarefa a membro pela tela; membro vê no sininho; marca lido; troca de conta na mesma aba; 375 px escuro) e levantamento de 52 telas.
- Doc 06 (seção de regras) e `docs/GUIA_DE_USO.md`: seção "Avisos".

## 9. Decisões do Claude (o usuário pode mudar)

- Sem agendador; limpeza de lidos com mais de 30 dias feita na leitura.
- Número do sininho só conta gravados não lidos.
- "A vencer" = hoje ou amanhã; "Livres" = abaixo de 50%.
- Capacitação nova avisa todo mundo na EJ com login, inclusive trainee.
- Atualização a cada 2 minutos, sem WebSocket.
- `naoLidos` só conta o que a pessoa vê; responsável sem acesso ao projeto não recebe avisos da tarefa.
- Tarefa abre pela tela Tarefas com `?tarefa=`; casos de uso de tarefa e capacitação passam a usar `emTransacao`.

## 10. Fica para quem constrói

Nomes de arquivos e classes (seguindo ADR-010: um caso de uso `ConsultarAvisos`/`GerirAvisos`), forma exata do JSON, ícone do sininho, animação do painel, como a gravação entra nos casos de uso de tarefa e capacitação (função auxiliar chamada dentro da transação).
