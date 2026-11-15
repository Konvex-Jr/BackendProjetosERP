# Sessão 19: Biblioteca e anexos (desenho)

Data: 15/11/2026. Repositórios: backend e frontend, branch `feat/biblioteca-anexos` nos dois. Migração: **013**.

## Por quê

São melhorias pedidas desde as sessões 12a e 12c (seção 3 do `.konvex/acompanhamento.md`) que ficaram para depois da Biblioteca (sessão 17). Hoje a busca falha quando a pessoa digita sem acento ("reuniao" não acha "reunião"), não dá para ver no perfil o que alguém cadastrou, não dá para saber pela lista que um item tem arquivo, todo arquivo é baixado (até um PDF que a pessoa só queria ler), envia-se um arquivo por vez e as tarefas não têm onde guardar a entrega.

## Objetivos

1. **Busca sem diferenciar acentos** na Biblioteca (título, texto e tags), mantendo "sem diferenciar maiúsculas".
2. **Itens cadastrados no perfil:** seção "Itens na Biblioteca" no perfil (o próprio e o de outra pessoa), com os itens que a pessoa cadastrou.
3. **Clipe nas listas:** ícone de clipe com a quantidade de arquivos nas listas da Biblioteca e no cartão da tarefa no Kanban.
4. **Ver no navegador:** PDF e imagens abrem numa janela do sistema, com botão para baixar.
5. **Vários arquivos de uma vez, com arrastar e soltar:** na ficha e no formulário da Biblioteca e na tarefa.
6. **Anexos nas tarefas** (de projeto e avulsas).

## Não objetivos

- Pré-visualizar Word, Excel, PowerPoint, OpenDocument, CSV, TXT, MD ou ZIP: continuam só com download.
- Anexo em comentário de tarefa: o anexo é da tarefa.
- Busca dentro do conteúdo dos arquivos.
- Mudar limite (20 MB) ou tipos aceitos.
- Anexos em projetos.

## Anti-objetivos (falharia mesmo funcionando)

- Qualquer caminho que mostre arquivo, quantidade de arquivos ou item a quem não podia ver o dono (sigilo da Biblioteca, tarefa que a pessoa não vê). Quem não vê o dono continua recebendo 404.
- Arquivo enviado aberto pelo navegador como página do sistema (XSS por upload). A API continua respondendo `Content-Disposition: attachment` e `nosniff`.
- Busca sem acento que quebre a busca literal de `%` e `_` (o escape de hoje continua).
- Anexo que sobra no disco ou no banco quando a tarefa ou o projeto é excluído.

## Restrições

- Padrão da sessão (roteiro): regra no backend, testes HTTP, integração com PostgreSQL (há migração), CI com `TZ=America/Sao_Paulo`; erro de entrada responde 400, nunca 500; telas responsivas, Halo, claro e escuro; `npm run e2e` (3 papéis, desktop e 375 px).
- Publicação com **backup do banco e da pasta `anexos/` antes** (migração 013).
- A sessão 18 guarda dados das telas na memória da aba: depois de anexar ou excluir, a tela precisa atualizar o dado guardado (mesmo caminho do `aoMudar`/recarregar de hoje).
- O PostgreSQL de produção e de dev é `postgres:17-alpine`, que traz o `unaccent` (contrib); o usuário do banco é o do `POSTGRES_USER`, que cria extensões (a 001 já cria `pgcrypto`).

## Abordagens consideradas (busca sem acento)

1. **`unaccent` do PostgreSQL** (escolhida pelo usuário). A migração 013 cria a extensão; a consulta compara o texto sem acento dos dois lados. Barata, porque a 013 já existe por causa das tarefas; a busca continua no banco.
2. Coluna com cópia sem acento do título, texto e tags: sem extensão, mas duplica dados e exige preencher os itens existentes.
3. Busca no Node depois de carregar tudo: sem mexer no banco, mas a busca vive em dois lugares e cresce mal.

## Decisões

### Busca sem acento
- Migração 013: `CREATE EXTENSION IF NOT EXISTS unaccent;`.
- `BibliotecaRepositoryDatabase.listar`: `unaccent(b.titulo) ILIKE unaccent($p)` (idem conteúdo e cada tag). O escape de `%`, `_` e `\` continua.
- `BibliotecaRepositoryMemory`: mesma regra, normalizando com `normalize("NFD")` e removendo as marcas combinantes (`\p{M}`), nos dois lados. O comentário "com acentos" muda.
- Sem índice: a Biblioteca é pequena (decisão do construtor se medir o contrário).

### Itens no perfil
- Frontend: `GET /biblioteca?autor=<codigo>` (filtro que já existe; a API aplica o sigilo de quem olha).
- Seção "Itens na Biblioteca" no `Perfil.jsx`, no próprio perfil e no de outra pessoa. Lista curta (título, tags, clipe, data); clique abre a ficha do item. Vazia: texto curto, sem seção grande.

### Clipe nas listas
- A lista da Biblioteca já traz `anexos` por item: o clipe usa `anexos.length`, sem mudança na API.
- Tarefas: a resposta da tarefa (lista e detalhe) ganha **`quantidadeAnexos`**, contada numa consulta só para todas as tarefas da lista (sem uma consulta por tarefa). O cartão do Kanban mostra o clipe junto dos outros indicadores (`bd`), com `title` "N arquivos" e rótulo acessível.

### Ver no navegador
- Só frontend. A tela já baixa o arquivo com a sessão (`baixar` em `services/api.js`, token no cabeçalho). Para PDF e imagens (`pdf`, `png`, `jpg`, `jpeg`, `webp`, `gif`), o clique no nome abre uma **janela do sistema** (modal) com o arquivo de um `URL.createObjectURL(blob)`: imagem em `<img>`, PDF em `<iframe>`/`<object>`; botão "Baixar" e fechar (Esc). O URL é revogado ao fechar.
- O tipo usado no `Blob` vem da extensão (lista fixa), não da resposta, para nunca exibir algo que não seja PDF ou imagem.
- No celular (375 px), PDF dentro de modal costuma não renderizar: lá, abrir/baixar o arquivo como hoje (decisão do construtor sobre como detectar; o e2e de 375 px precisa passar).
- A API não muda: continua `attachment` + `nosniff` + `no-store`.

### Vários arquivos e arrastar e soltar
- Componente único de envio (evolução do `BotaoAnexar`): aceita vários arquivos pelo seletor (`multiple`) e por **arrastar e soltar** numa área marcada (com estado visual ao arrastar por cima e alternativa de teclado: o próprio botão).
- Envio **um arquivo por vez, em sequência**; cada arquivo é conferido antes (tipo, tamanho) e tem o próprio resultado. Ao fim: aviso de sucesso com a quantidade, ou um alerta listando quais falharam e por quê. Os que deram certo ficam.
- API sem mudança: continua um arquivo por requisição.
- Usado na ficha da Biblioteca, no formulário da Biblioteca (o campo `arquivos` já é `multiple`; ganha arrastar e soltar), na tarefa e nas **Capacitações** (decisão do usuário: o componente `Anexos.jsx` é o mesmo, então ver PDF/imagem e vários arquivos com arrastar e soltar valem em todo lugar; entram nos testes, no e2e e no `GUIA_DE_USO`).

### Anexos nas tarefas
- Novo dono `DonoAnexo.TAREFA = "tarefa"`. Migração 013 troca a restrição: `CHECK (dono_tipo IN ('biblioteca', 'capacitacao', 'tarefa'))`. `TABELA_DO_DONO` do `conferenciaAnexos` ganha `tarefa: "tarefas"`.
- Rota `POST /tarefas/:codigo/anexos` (mesmo formato: bytes no corpo, nome em `X-Nome-Arquivo`). Download e exclusão pelas rotas que já existem (`GET`/`DELETE /anexos/:codigo`).
- **Regras (decisão do usuário: seguir os comentários), via `regrasTarefa`:**
  - ver e baixar: `regras.ver`;
  - anexar: `regras.comentar` (equipe atual do projeto; na avulsa, responsável e gestão);
  - excluir: quem enviou o anexo **ou** `regras.organizar` (líder e gestão; na avulsa, gestão). Quem enviou e saiu da equipe ainda pode excluir o próprio? Decisão: **sim, se ainda vê a tarefa** (mesma regra de apagar comentário, que só confere autor).
  - Quem não vê a tarefa: 404 em todas as rotas de anexo.
- Mensagens de erro no padrão das rotas de comentário ("Só a equipe atual do projeto anexa arquivos nas tarefas." / "Só os responsáveis e a gestão anexam arquivos nesta tarefa.").
- `GerirAnexos.acesso` ganha o ramo da tarefa (usa a mesma carga de tarefa + projeto das rotas de tarefa; extrair essa carga para um lugar comum se preciso). `podeAlterar` por anexo passa a depender de quem enviou: o retorno de `acesso` precisa saber o anexo na exclusão.
- Listagem dos anexos da tarefa: `GET /tarefas/:codigo/anexos` (como os comentários, carregada ao abrir a tarefa), com `podeExcluir` por anexo.
- **Exclusão em cascata:** `ExcluirTarefa` e `ExcluirProjeto` (que apaga as tarefas do projeto) apagam os anexos e arquivos das tarefas antes (`excluirDosDonos(DonoAnexo.TAREFA, códigos)`).
- Frontend: seção "Anexos" no `TaskModal`, acima dos comentários, com o mesmo componente da Biblioteca (lista, ver, baixar, excluir, enviar com arrastar e soltar). Tarefa nova (ainda sem código): a seção aparece depois de salvar.

### Migração 013
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER TABLE anexos DROP CONSTRAINT IF EXISTS anexos_dono_valido;
ALTER TABLE anexos ADD CONSTRAINT anexos_dono_valido CHECK (dono_tipo IN ('biblioteca', 'capacitacao', 'tarefa'));
```
Sem perda de dados; reversão: voltar a restrição (só se não houver anexo de tarefa) e `DROP EXTENSION unaccent`.

## Testes

- Repositório da Biblioteca (memória e PostgreSQL): "reuniao" acha "Reunião"; "REUNIÃO" acha "reuniao"; tag com acento; `%` e `_` literais continuam.
- Anexos de tarefa (HTTP): equipe anexa; ex-participante vê e baixa mas não anexa (403); quem não vê a tarefa recebe 404 ao enviar, baixar e excluir; quem enviou exclui o próprio; outro membro não exclui o de outro (403); líder e gestão excluem; avulsa: responsável anexa, outro membro 404.
- Cascata: excluir tarefa e excluir projeto apagam registros e arquivos dos anexos das tarefas.
- `quantidadeAnexos` na lista de tarefas; `conferirAnexos` reconhece dono `tarefa`.
- Frontend: envio de vários arquivos com um falhando (os outros ficam); janela de visualização só para PDF/imagem; seção no perfil respeita o que a API devolve; e2e nos 3 papéis, desktop e 375 px.

## Documentação

- Doc 06 (matriz papel × o que vê e faz): linhas de anexo na tarefa.
- `docs/GUIA_DE_USO.md`: anexos na tarefa, ver PDF/imagem, arrastar arquivos, itens no perfil.
- `CLAUDE.md`, roteiro (a 19 **tem** migração) e acompanhamento.

## Publicação

1. Merge dos dois PRs. 2. Backup do banco e da pasta `anexos/`. 3. Deploy (migração 013). 4. `conferirAnexos` sem flag, código 0. O compose não muda.

## Decisões tomadas na revisão do desenho (chamadas do Claude, o usuário pode corrigir)

- **"Quem enviou exclui" vale só para a tarefa.** Biblioteca e Capacitação continuam com "quem pode alterar o dono"; `podeExcluir` por anexo só na lista de anexos da tarefa.
- **404 só nos anexos da tarefa.** As rotas de comentário continuam como estão (403 para tarefa de projeto que a pessoa não vê); extrair a carga comum sem mudar esse comportamento.
- Não existe `GET /tarefas/:codigo`: `quantidadeAnexos` vai na lista e nas respostas de criar, editar e mudar status.
- A tela calcula quem pode anexar pelo `papel`, como faz com os comentários.
- O filtro exato `?tag=` continua sem ignorar acentos (não é a busca).

## Deixado ao construtor

- Nome e forma do componente de envio e da janela de visualização; como detectar o celular para o PDF.
- Onde extrair a carga tarefa + projeto + regras compartilhada entre `TarefaRoutes` e `GerirAnexos`.
- Ordem e tamanho da lista no perfil (sugestão: mais recentes primeiro, todos).
