# Sessão 17: Biblioteca (enxugar Gestão, Base de Inteligência e Iniciativas)

> Desenho aprovado antes do plano. Data: 14/11/2026. Repositórios: backend e frontend (um PR em cada).

## 1. Intenção

A gestão quer **simplificar**. Hoje existem três módulos que guardam "material da Konvex" com anexos e ligação a projetos, cada um com regras de acesso diferentes (seção 4 de `docs/sistema/06_documento_do_sistema.md`):

- **Gestão**: pastas e documentos (link ou arquivo) com sigilo; só a gestão cria.
- **Base de Inteligência**: itens de texto abertos a todos; qualquer um cria.
- **Iniciativas**: inovação com status, responsável e tarefas; criam a gestão e a área Inovação.

Os três viram **um módulo só, a Biblioteca**: um item com título, texto e/ou links, anexos, tags, projeto opcional e sigilo. Uma regra de acesso, uma tela, um item de menu.

## 2. Objetivos, não objetivos e anti-objetivos

**Objetivos**
- Um item de menu ("Biblioteca") no lugar de três (Base de Inteligência, Iniciativas, Gestão).
- Uma tabela principal no lugar de sete; uma regra de leitura e uma de escrita.
- Membro pode guardar material (inclusive restrito à equipe de um projeto); a gestão pode guardar material só dela.

**Não objetivos**
- Pastas, categorias, tipos, status, responsável, frente, resultado, aprendizados: saem. Tags e busca fazem o papel das pastas e categorias.
- Acompanhamento de inovação: passa a ser feito com **tarefas avulsas de categoria Inovação**, que já existem. Nada novo nelas além de perder a ligação com iniciativa.
- **A área Inovação perde o direito especial de criar** (decisão do usuário, 14/11): tarefa avulsa continua só da gestão (`tarefas.atribuir`); quem é da área registra ideias como itens da Biblioteca (sugestão: tag `inovacao`). `ehDaAreaDeInovacao` sai; o 06 registra a perda explicitamente.
- Migrar dados antigos: **decisão do usuário (14/11): começar do zero.**

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Um membro conseguir ler item "Só gestão" ou de equipe de projeto de que nunca participou, por qualquer rota (lista, ficha, anexo, aba do projeto).
- Sobrar código, rota, permissão ou item de menu morto dos três módulos antigos.
- Arquivos órfãos no disco da VPS depois da migração.

## 3. Restrições

- **Dados (irreversível):** o usuário decidiu em 14/11/2026 descartar tudo dos três módulos: pastas, documentos, itens da Base, iniciativas, ligações e os anexos deles (linhas e arquivos no disco). **Backup do banco e da pasta de anexos na VPS antes de publicar** (procedimento em "Produção (VPS)" do `CLAUDE.md`). Anexos de **capacitações** ficam intactos.
- Arquitetura atual (entidade, repositório banco + memória, caso de uso, rota, `registro.ts`, catálogo de permissões) é mantida; a Biblioteca segue o mesmo padrão dos módulos existentes.
- Testes com banco real (PostgreSQL 5433, `konvex_teste`) e em memória, como hoje.
- Mudou permissão: atualizar as seções 2, 3 e 4 do `docs/sistema/06_documento_do_sistema.md` no mesmo PR.

## 4. Abordagens consideradas

| | Abordagem | Troca | Escolha |
|---|---|---|---|
| A | **Biblioteca simples**: item com título, texto/links, anexos, tags, projeto opcional, sigilo. Sem pastas, tipos nem campos de iniciativa. | Iniciativas perdem status e responsável próprios (vão para tarefas de Inovação). | ✅ **Escolhida pelo usuário** (mais enxuta) |
| B | A + status e responsável opcionais (item com status = iniciativa, com tarefas ligadas). | Mais um filtro e formulário maior. | Recusada |
| C | Tudo em pastas (Gestão atual; Base e Iniciativas viram pastas com "membros podem adicionar"). | Continua a navegação por pastas; menos simplificação para quem usa. | Recusada |

## 5. O que foi decidido

### 5.1 O item da Biblioteca

| Campo | Regra |
|---|---|
| `titulo` | Obrigatório, até 160 caracteres. |
| `conteudo` | Texto em Markdown simples (o mesmo renderizador da Base hoje). Opcional. |
| `links` | Lista de URLs `http(s)://` (mesma validação da Base). Opcional. |
| Anexos | Até 20 MB cada, mesmos tipos de hoje (`TIPOS_ANEXO`), dono `biblioteca`. |
| `tags` | Lista normalizada (minúsculas, sem `#`, sem repetição), como a Base. |
| `projeto` | Opcional, um projeto. |
| `sigilo` | `todos` (padrão), `gestao` ou `projeto`. `projeto` exige projeto. |
| `autor` | Quem cadastrou (`ON DELETE SET NULL`). |
| `criado_em`, `atualizado_em` | Automáticos. A lista ordena por `atualizado_em` desc. |

Regra de conteúdo mínimo: o item deve ter **conteúdo, link ou anexo**. Como o anexo só é enviado depois de o item existir, a API exige só o título; quem confere o mínimo é o **formulário** (conteúdo, link ou arquivo escolhido), que cria o item e envia o anexo em seguida (ver 6). *Decisão do Claude, no plano: a versão anterior exigia conteúdo ou link na API, o que impedia o "só arquivo".*

### 5.2 Quem vê

Mesma regra das pastas de hoje (`podeVerPasta`), agora por item:
- Gestão (`biblioteca.verTodos`): vê tudo.
- Demais: itens `todos`; itens `projeto` de projetos de que participa **ou participou**.
- Item invisível responde **404** (lista, ficha, anexos, aba do projeto).

### 5.3 Quem cria, edita e exclui

- **Criar:** qualquer pessoa logada.
  - `sigilo = gestao`: só quem tem `biblioteca.gerir`.
  - **Projeto ligado (qualquer sigilo):** a gestão liga qualquer projeto; o membro só liga projeto de que participa **ou participou** (a mesma regra de leitura; uma regra só). O seletor do formulário lista só esses projetos (para o membro, é a lista que `GET /projetos` já devolve). *Decisão do Claude.*
- **Editar e excluir:** o autor ou a gestão (`biblioteca.gerir`). As regras de sigilo e projeto acima só são conferidas quando `sigilo` ou `projeto` **mudam** no salvar; assim o autor que saiu da equipe continua editando, anexando e excluindo o próprio item. *Decisão do Claude.*
- **Anexos:** seguem o dono (`GerirAnexos.acesso`): baixa quem vê o item; envia e exclui quem edita o item.

### 5.4 Permissões (catálogo)

- Saem: `documentos.verTodas`, `documentos.gerir`, `conhecimento.gerir`, `iniciativas.gerir`, e a regra da área Inovação (`podeCriarIniciativa`).
- Entram: `biblioteca.verTodos` e `biblioteca.gerir`, dadas a **diretor e gerente** (os mesmos papéis que hoje têm `documentos.*`).

### 5.5 Projeto e exclusão de projeto

- Ficha do projeto: a aba **Base** vira aba **Biblioteca**, mostrando os itens daquele projeto que a pessoa pode ver.
- Excluir projeto (só diretor): itens com `sigilo = projeto` daquele projeto são **excluídos** junto com os anexos (como as pastas da equipe hoje); itens `todos`/`gestao` só perdem a ligação (`projeto = NULL`).

### 5.6 Banco (migração `012_biblioteca.sql`)

1. Cria `biblioteca_itens` (campos de 5.1; `CHECK (sigilo IN ('todos','gestao','projeto'))`; `CHECK (sigilo <> 'projeto' OR projeto_codigo IS NOT NULL)`; `projeto_codigo` com `ON DELETE SET NULL`, a exclusão de itens `projeto` é feita pela aplicação, por causa dos arquivos; índices em `atualizado_em`, `projeto_codigo` e GIN em `tags`).
2. Remove `tarefas.iniciativa_codigo` (e o índice).
3. Apaga de `anexos` as linhas com `dono_tipo IN ('documento','conhecimento','iniciativa')`; troca o `CHECK` para `dono_tipo IN ('biblioteca','capacitacao')`.
4. `DROP TABLE` de `iniciativa_conhecimentos`, `iniciativa_projetos`, `iniciativas`, `conhecimento_projetos`, `conhecimentos`, `documentos`, `pastas`.

Os **arquivos no disco** dos anexos apagados não saem pela migração SQL: um script (`source/scripts/`, no padrão de `conferirAnexos.ts`) remove os arquivos sem linha correspondente em `anexos`, rodado na VPS depois da migração e do backup. Antes, `TABELA_DO_DONO` em `source/infra/arquivos/conferenciaAnexos.ts` passa a mapear só `biblioteca` → `biblioteca_itens` e `capacitacao` → `capacitacoes`; senão `conferirAnexos.ts` quebra.

### 5.6.1 Dependências cruzadas no backend (também mudam)

- `domain/entity/Tarefa.ts` perde `iniciativa`; `CriarTarefa.ts` (importa `referenciaDaIniciativa` de `SalvarIniciativa`), `EditarTarefa.ts`, `EditarTarefaInput.ts`, `TarefaRoutes.ts` e `TarefaRepositoryDatabase.ts` deixam de tratar iniciativa.
- `ExcluirProjeto.ts` deixa de usar `ExcluirPasta` e passa a aplicar a 5.5.
- `GerirAnexos.ts`, `AnexoRoutes.ts`, `domain/enum/Anexo.ts` (`DonoAnexo`), `ArmazenamentoAnexosDisco.ts`: dono `biblioteca` no lugar de `documento`, `conhecimento` e `iniciativa`.
- `swagger.ts`, `mensagensDeErro.ts`, `MemoryRepositoryFactory.ts`, `DatabaseRepositoryFactory.ts`, `RepositoryFactoryInterface.ts`, `registro.ts`, `catalogoPermissoes.ts`: trocam os três módulos pela Biblioteca.
- Saem `regrasIniciativa.ts` (com `ehDaAreaDeInovacao`), `regrasConhecimento.ts`, `sigiloPastas.ts` (a lógica de projetos do usuário vai para a regra da Biblioteca), as entidades, enums (`SigiloPasta`, `CategoriaConhecimento`, `Iniciativa`), interfaces, repositórios e casos de uso dos três módulos.

### 5.7 API

`/biblioteca`: `GET` (lista com busca `q` em título, conteúdo e tags; filtros `tag`, `projeto`, `sigilo`, `autor`), `GET /:codigo`, `POST`, `PUT /:codigo`, `DELETE /:codigo`, e anexos em `/biblioteca/:codigo/anexos` no padrão atual. Saem as rotas `/pastas`, `/documentos`, `/conhecimento`, `/iniciativas`. `PUT/POST /tarefas` deixam de aceitar `iniciativa`.

### 5.8 Frontend

- Menu: **Biblioteca** no lugar de Base de Inteligência (mesma posição); saem Iniciativas e Gestão.
- Página `Biblioteca.jsx`: lista com busca e filtros (tag, projeto, sigilo), ficha do item (Markdown, links, anexos) e formulário (título, projeto, sigilo, texto, links, tags, anexos). O seletor de sigilo mostra só as opções que a pessoa pode usar.
- Saem `Gestao.jsx`, `Conhecimento.jsx`, `Iniciativas.jsx` e os serviços `documentos.js`, `conhecimento.js`, `iniciativas.js`.
- O campo e as referências de iniciativa saem de: `TaskModal.jsx`, `pages/Tarefas.jsx` (formulário de avulsa e `iniciativas.listar()`), `services/tarefas.js` (`iniciativaDa`), `lib/apiMappers.js`, `lib/utils.js` (`NAV` e `path`), `components/Icon.jsx` (ícones sem uso).
- `Projeto.jsx` importa hoje `ItensDoProjeto` de `Conhecimento.jsx`: a aba passa a usar um componente equivalente da Biblioteca.
- Rotas antigas (`/gestao`, `/conhecimento`, `/iniciativas`) redirecionam para `/biblioteca`, para não quebrar favoritos. Atenção: `Layout.jsx` (~linha 165) manda para `/` qualquer seção fora do menu antes de a rota filha renderizar; os redirecionamentos ficam **fora do `<Layout>`** em `App.jsx` (ou a checagem do Layout passa a reconhecê-los).

### 5.9 Documentação e fim da sessão

- `06_documento_do_sistema.md`: seções 2 e 3 trocam os três módulos pela Biblioteca; seção 4 vira um registro curto da decisão.
- `CLAUDE.md` ("Onde estamos"), `.konvex/acompanhamento.md` e `.konvex/roteiro.md` atualizados, como em toda sessão.

## 6. Deixado para quem constrói

- Nomes internos (entidade `ItemBiblioteca`, casos de uso, repositórios) e a divisão em arquivos, seguindo o padrão do projeto.
- Reaproveitar ou não código da Base (normalização de tags, validação de links, Markdown) e de `sigiloPastas.ts` (projetos do usuário), desde que os antigos sejam removidos.
- Layout da página (lista em tabela ou cartões), seguindo os componentes existentes (`Table`, `FormModal`, `Multi`, `Anexos`).
- Como o formulário trata "só arquivo" (criar e depois enviar o anexo, avisando se o envio falhar).
- Ordem de publicação: backend e frontend juntos; a migração roda no deploy, como as anteriores.
