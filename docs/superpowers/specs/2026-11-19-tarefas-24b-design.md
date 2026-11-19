# Sessão 24b: ajustes de tarefas (design)

Data: 19/11/2026. Aprovado pelo usuário na conversa de 19/11. O certificado de horas, que estava junto na 24b, virou a **sessão 24c** (decisão do usuário, 19/11): depende da data de conclusão definida aqui e tem quatro perguntas próprias.

## 1. Por quê

Pedidos de 19/11, levantados no uso do quadro de tarefas (seção 3 do `.konvex/acompanhamento.md`). Hoje o membro não consegue mexer nem na tarefa que ele mesmo criou, a data de conclusão é sempre o dia em que se clicou, a criação de tarefa é um formulário curto (sem descrição, checklist e anexos), o checklist não deixa editar o texto nem dividir os itens entre as pessoas, e fechar a janela perde as alterações sem perguntar.

## 2. Objetivos

1. **Quem criou edita a própria tarefa** (decisão do usuário, 19/11, opção A: soma, não substitui).
2. **Data de conclusão escolhida**, corrigível depois.
3. **Filtro "Atrasadas" no quadro do projeto** (`Projeto.jsx`), igual ao da tela Tarefas (decidido em 19/11: filtro, não coluna).
4. **Nova tarefa completa:** descrição, checklist e anexos já na criação.
5. **Checklist:** editar o texto do item; responsável por item; responsáveis da tarefa marcam os itens.
6. **Aviso ao fechar** a tarefa com alterações não salvas.
7. **Filtros de Tarefas guardados** enquanto a pessoa estiver logada.
8. **Projeto geral opcional por área e nome sem bolinha** (pedido do usuário, 19/11, encaixado na 24b): "Inovação geral" no lugar de "Inovação · geral"; opção "Tem projeto geral" na área, para excluir o geral da Presidência Executiva.

"Prioridade editável" (pedido de 19/11) é coberto pelo item 1: a prioridade já é editável por gestão e líder; faltava o membro que criou.

## 3. Fora de escopo / anti-objetivos

- Certificado de horas (24c). Horas trabalhadas.
- Item do checklist **não** entra na ocupação (24a); só a tarefa conta.
- Nada guardado no navegador (`localStorage`/`sessionStorage`): regra da sessão 18.
- Não pedir a data a cada conclusão (arrastar no quadro tem que continuar rápido).
- Não mudar quem cria tarefa nem quem é responsável (participante segue criando só para si).

## 4. Regras

### 4.1 Edição pelo criador (backend: `regrasTarefa.ts`)
- `RegrasTarefa` ganha `editar`: `organizar || (papel === "participante" && tarefa.criadaPor?.codigo === usuario.codigo)`.
  - Criador precisa estar na **equipe atual** (papel participante). Quem saiu perde a edição. Sigiloso sem acesso completo: nada (já é assim).
  - Tarefa antiga sem `criadaPor` (antes da 8b): só gestão e líder.
- `PUT /tarefas/:codigo` e `DELETE /tarefas/:codigo` passam a exigir `editar` (não mais `organizar`).
  - Quando quem edita não organiza (criador), a API **mantém os responsáveis atuais** e ignora `codigosResponsaveis` do corpo (o front já manda o corpo inteiro; o comentário de `corpoTarefa` já prevê isso).
  - Criador sem `mudarStatus` (criou e deixou de ser responsável): o PUT **ignora** `status`, `codigoColuna` e `dataConclusao` do corpo e mantém os atuais. Assim o PUT não vira uma porta para concluir/mover fora da regra de `mudarStatus`. Na tela, esses campos ficam travados para ele. (Decisão do Claude.)
- `organizar` continua valendo para o resto (apagar comentário de outro, colunas etc.).
- Front: `papelNasTarefas` ganha `podeEditar(t)` com a mesma regra; a `TaskModal` usa `podeEditar(t)` no lugar de `organiza` para destravar os campos, e o campo Responsáveis fica travado quando `!organiza`.
- A tarefa no JSON precisa trazer o **código** de quem criou (hoje o front mostra o nome em `criadaPor`). Conferir o `toJSON` e o `apiMappers`; se só vier o nome, acrescentar o código sem quebrar o nome.
- Atualizar a seção 3 do `docs/sistema/06_documento_do_sistema.md` (matriz) no mesmo PR.

### 4.2 Data de conclusão
- Concluir (botão, arrasto para a coluna concluída, PATCH de status ou de coluna) continua gravando **hoje** e quem concluiu. Nada muda nesses caminhos.
- Rota nova `PATCH /tarefas/:codigo/conclusao` com `{ dataConclusao }`:
  - Permissão: `mudarStatus` (gestão, líder, responsável participante) **ou** `editar`.
  - Só para tarefa concluída: senão 400 `TAREFA_NAO_CONCLUIDA`.
  - Data lida com `lerData` normalizada no dia (lição da 24a: a tela manda meio-dia local `...T15:00:00Z`).
  - Não pode ser depois de hoje (400 `DATA_CONCLUSAO_FUTURA`) nem antes de `dataInicio` (400 `DATA_CONCLUSAO_ANTES_DO_INICIO`). Mensagens em `mensagensDeErro.ts` dizendo o campo.
  - Não muda `concluidaPor`.
  - Validação só nessa rota (e ao editar), **nunca** no `validar` que roda ao carregar do banco (bug da sessão 20).
- Tela: na `TaskModal`, tarefa concluída mostra o campo de data **"Concluída em"** para quem pode; ao salvar, se só a data mudou, chama o PATCH; se mudou junto com outros campos, o PUT leva `dataConclusao` (o `EditarTarefa` aplica as mesmas regras quando a tarefa segue concluída; se a edição reabre a tarefa, a data é ignorada).
- Efeito esperado: burndown, indicadores e (na 24c) o certificado passam a usar a data corrigida. Nenhuma mudança neles.

### 4.3 Filtro "Atrasadas" no quadro do projeto
- Reaproveitar `noPrazo` (hoje em `Tarefas.jsx`): mover para `src/lib` com teste se ainda não estiver lá.
- `Projeto.jsx`: seletor "Prazo: todos / Atrasadas / Vencem esta semana" acima do quadro e da lista. Filtro só na tela, sem API.

### 4.4 Nova tarefa completa
- "Nova tarefa" (em Tarefas e no Projeto) deixa o `FormModal` e abre a **`TaskModal` em modo criação** (tarefa sem `id`): projeto (só em Tarefas, com os grupos de hoje), título, descrição, checklist, prioridade, dificuldade, início, fim, responsáveis (regra de hoje: participante = ele mesmo), etapa, e anexos.
- Anexos na criação: a pessoa escolhe os arquivos (`ZonaEnvio`); ficam na tela até salvar. Ordem: `POST /tarefas` (com descrição e checklist no corpo) → envia cada anexo para a tarefa criada.
  - Falha de um anexo: a tarefa já existe; avisar quais arquivos não subiram (`alerts.error` com os nomes) e abrir a tarefa criada para reenviar. Não apagar a tarefa.
- Backend: `CriarTarefaInput` e `POST /tarefas` aceitam `checklist` (mesmo formato do PUT, com `codigoResponsavel` por item).
- Criar já na etapa concluída grava hoje como data de conclusão (como já faz o `nasceConcluida`); o campo "Concluída em" não aparece na criação, a correção é depois. (Decisão do Claude.)
- Sem comentários nem "Excluir" no modo criação. Botão "Criar tarefa".
- Avisos de ocupação (24a) continuam na criação.

### 4.5 Checklist
- **Migração 020:** `tarefa_checklist_itens.responsavel_codigo UUID NULL REFERENCES usuarios(codigo) ON DELETE SET NULL` (conferir o tipo da chave de `usuarios`).
- `ItemChecklistTarefa` ganha `responsavel: Usuario | null` (ou código; seguir o padrão dos repositórios).
- Regra (só ao criar e editar, nunca ao carregar): responsável do item tem que ser um dos responsáveis da tarefa, senão 400 `RESPONSAVEL_ITEM_FORA_DA_TAREFA`.
  - Ao tirar alguém dos responsáveis da tarefa, os itens dele **ficam sem responsável** (a API limpa; não dá erro).
- **Editar texto:** quem edita a tarefa (4.1) clica no texto e edita no lugar (Enter ou sair do campo confirma; Esc desfaz). Vai pelo PUT como hoje.
- **Marcar item grava na hora, para todos** (decisão do Claude): clicar na caixa chama o PATCH abaixo, também para quem edita. A marcação fica fora do rascunho, do aviso ao fechar e do "Salvar".
  - No PUT, o `feito` de itens que já existem **vem do banco** (o corpo é ignorado nesse campo); item novo nasce não feito. Assim um PUT com a janela aberta há tempo não desfaz a marcação feita por outra pessoa pelo PATCH. O repositório hoje apaga e regrava o checklist: o `EditarTarefa` copia o `feito` atual antes de gravar.
  - No modo criação (sem tarefa ainda), a caixa marca só no rascunho e vai no `POST`.
- **Marcar item:** rota nova `PATCH /tarefas/:codigo/checklist/:item` com `{ feito }`.
  - Permissão: `mudarStatus` **ou** `editar` (responsáveis participantes marcam qualquer item da tarefa; não só os seus, para não travar quem cobre o colega).
  - Item que não é da tarefa: 404.
  - Na tela, quem só marca vê as caixas habilitadas e o resto travado; a marcação grava na hora (como a etapa para quem só conclui), sem precisar de "Salvar".
- Responsável do item na tela: `Avatar` pequeno ao lado do texto; para quem edita, um seletor com os responsáveis da tarefa (e "Ninguém").
- Ordem dos itens (migração 011) mantida.

### 4.6 Aviso ao fechar
- `TaskModal` compara o rascunho com a tarefa original (mesma comparação de `soMudouStatus`, campo a campo).
- Se mudou: X, Esc, clique fora e "Cancelar" pedem `alerts.confirm({ title: 'Descartar alterações?', confirmText: 'Descartar', danger: true })`.
- No modo criação, conta como alteração qualquer campo preenchido ou anexo escolhido.
- Quem não edita nada (só vê) fecha direto.

### 4.7 Filtros de Tarefas guardados
- Filtros da tela Tarefas (pessoa, origem, status, prazo, visão kanban/lista) ficam numa memória do módulo, **por pessoa e só na aba**, no padrão de `src/lib/memoria.js`.
- Limpos no logout e na troca de pessoa: registrar em `src/lib/memoriasDaAba.js` (o que já limpa as outras memórias).
- O atalho do Dashboard (`consumir('tarefas')`) continua vencendo o filtro guardado.
- F5 volta ao padrão (memória da aba some ao recarregar, como na 18).

### 4.8 Projeto geral opcional e nome sem bolinha
- Nome do geral: `<Área> geral` (sem " · "). `nomeDoGeral` muda; a migração 020 renomeia os gerais existentes (`UPDATE projetos SET nome = a.nome || ' geral' ... WHERE geral_da_area`).
- Migração 020: `areas.tem_geral BOOLEAN NOT NULL DEFAULT TRUE`.
- `Area` ganha `temGeral` (padrão true). `SalvarArea` aceita `temGeral`:
  - true: `sincronizarGeral` como hoje (cria se faltar).
  - false: se a área tem geral com tarefas → 409 `GERAL_COM_TAREFAS` ("O projeto geral desta área tem N tarefas. Mova ou exclua as tarefas antes."); sem tarefas → exclui o geral (mesmo caminho do `ExcluirProjeto`, que limpa colunas, anexos e ligações da Biblioteca) e não recria.
  - Toda a gravação da área + exclusão do geral numa ação só (se a exclusão falhar, a área não fica com `temGeral` false e geral sobrando).
- Quem usa `buscarGeralDaArea` precisa aceitar área sem geral (ex.: listas, ocupação, períodos): conferir e tratar `null` sem 500.
- Configurações → Áreas: campo "Projeto geral" Sim/Não no formulário e coluna na tabela. Dica: "Não exclui o projeto geral da área (só se ele não tiver tarefas)."
- Desligar e religar: cria um geral novo e vazio.
- Na publicação, a gestão desliga a opção na Presidência Executiva pela tela.

## 5. Abordagens consideradas

- **Data de conclusão:** (a) campo "Concluída em" na janela da tarefa concluída, editável depois — **escolhida**; (b) perguntar a data a cada conclusão: deixa o arrasto lento e vira um clique a mais em toda tarefa.
- **Criação completa:** (a) `TaskModal` em modo criação — **escolhida** (a janela já tem descrição, checklist e anexos; um lugar só); (b) aumentar o `FormModal`: duplicaria o checklist e os anexos.
- **Filtros guardados:** (a) memória da aba por pessoa — **escolhida**; (b) `localStorage`: quebra a regra da 18; (c) guardar na API: exagero para ~30 pessoas.
- **Geral da Presidência:** (a) opção por área — **escolhida pelo usuário** (19/11); (b) só apagar no banco: o `SalvarArea` recriaria o geral na próxima edição da área.
- **Marcar item:** (a) rota própria para quem só marca — **escolhida**; (b) liberar o PUT inteiro ao responsável: daria edição total sem querer.

## 6. Testes

- Backend unidade + HTTP: `editar` (criador na equipe, criador que saiu, sem `criadaPor`, sigiloso), criador não troca responsáveis, DELETE pelo criador, conclusão (futuro, antes do início, não concluída, data com horário vinda da tela), item com responsável fora (400), tirar responsável limpa itens, PATCH do item (responsável, fora da equipe 403, item de outra tarefa 404, sigiloso 404).
- Integração (PostgreSQL, `TZ=America/Sao_Paulo`): migração 020, gravar e ler o responsável do item, `ON DELETE SET NULL`.
- Front: `src/lib` para `noPrazo`, comparação do rascunho e memória dos filtros (incluindo troca de pessoa).
- e2e `e2e/tarefas-24b.mjs`, tudo pela tela: membro cria tarefa completa com anexo e checklist com responsável; edita a prioridade da própria; responsável marca item; corrige a data de conclusão; filtro "Atrasadas" no projeto; aviso ao fechar; filtros guardados e limpos ao trocar de conta na mesma aba; 375 px escuro. Levantamento das 52 telas.
- Revisor final: troca de conta na mesma aba, "dá para fazer pela tela?", datas com horário vindas da tela.

## 7. Publicação

Migração 020 (acrescenta colunas e renomeia os gerais). Depois do deploy, a gestão desliga "Projeto geral" na Presidência Executiva. Backup do banco e dos anexos, back e front juntos, conferir "020" no log. Seção "Publicação da sessão 24b" no `docs/PUBLICACAO.md`.

## 8. Decisões do Claude (o usuário pode mudar)

- O criador também **exclui** a própria tarefa.
- Responsáveis marcam **qualquer** item da tarefa, não só os seus.
- Data de conclusão: não pode ser futura nem antes do início; `concluidaPor` não muda ao corrigir.
- Anexo que falha na criação não desfaz a tarefa.
- Criador que não é responsável não muda status, etapa nem data de conclusão pelo PUT.
- Caixa do checklist grava na hora para todos; o PUT não mexe no `feito` de itens existentes.
- Na criação não se escolhe a data de conclusão.
