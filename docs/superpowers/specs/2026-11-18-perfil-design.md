# Sessão 22: perfil (foto, links com logo) e saída das tecnologias

Data: 18/11/2026. Repositórios: backend e frontend (um PR em cada). Migração: 016.

## Por que

O perfil hoje é só texto: avatar com iniciais, links do LinkedIn, GitHub e calendário como texto puro. A sessão dá cara de perfil de verdade (foto em todo lugar onde a pessoa aparece, links como cartões com logo). A sessão 27 (board tático, campinhos com peças de futebol de botão) vai usar a mesma foto.

## Objetivos

1. **Foto de perfil**, enviada pela própria pessoa, com recorte quadrado, e mostrada em **todo lugar onde hoje aparecem as iniciais** (decisão do usuário, 18/11).
2. **GitHub, LinkedIn e calendário como cartões com logo** no perfil (só links; nada de integração).
3. **Tirar tecnologias e habilidades do sistema inteiro, com os dados** (decisão do usuário, 18/11: "vai gerar só mais problema").

## Fora do escopo

- Logos de tecnologias (saem junto com as tecnologias).
- Integração real com GitHub, LinkedIn ou Google Agenda.
- Gestão trocar a foto de outra pessoa (a decisão de 14/11 tirou a edição do perfil alheio pela gestão).
- Áreas múltiplas, tarefas da área e **trajetória com data no passado**: sessão 23. A trajetória foi para lá (usuário, 18/11) porque a pessoa pode estar em áreas paralelas (ex.: Projetos e Inovação, gerente de Inovação): os períodos correm em paralelo, e o desenho depende do modelo de várias áreas.

## Anti-objetivos

- Foto que demora a aparecer ou pisca em listas grandes (equipe, cartões de tarefa): o motivo da escolha abaixo é justamente o cache do navegador.
- Endereço de foto que dê para adivinhar a partir do código da pessoa.
- Arquivo enviado pelo usuário servido como algo que não seja imagem.
- Quebrar a conferência dos anexos (`conferirAnexos` tem que seguir saindo com código 0 depois da publicação).

## Abordagens consideradas (para servir a foto)

1. **Endereço público com nome aleatório (escolhida pelo usuário, 18/11).** `GET /fotos/<uuid>.webp` sem login, cache longo e imutável; cada troca gera um nome novo. Rápida e simples para usar em todas as telas. Custo aceito: quem tiver o link vê a foto sem login (o link só aparece para quem está logado; o site é `noindex`).
2. Foto só para logado: o front baixa cada foto com o token e guarda na memória da aba (como os anexos). Nada público, mas uma requisição por pessoa, esqueleto em cada avatar e mais código. Descartada pela lentidão e complexidade.
3. Miniatura em base64 nos dados das pessoas: lista de pessoas maior em todas as telas. Descartada.

## Decisões

### Foto

- **Quem troca:** só a própria pessoa, para si (todos os papéis, trainee inclusive). Ações: enviar/trocar e remover a própria foto.
- **Recorte e tamanho no navegador:** a pessoa escolhe o arquivo (JPEG, PNG ou WebP, até 5 MB), vê o recorte quadrado (arrastar e zoom) e confirma. O front gera **256×256 WebP** num `canvas` e envia só esse resultado. (Chamada do Claude: canvas apaga metadados como EXIF/GPS.)
- **Backend confere** que o corpo é WebP de verdade (assinatura `RIFF....WEBP`) e tem no máximo 300 KB; senão 400 com mensagem dizendo o que está errado. Sem biblioteca de imagem no backend (chamada do Claude: o front já reencoda; a proteção no back é a assinatura, o tamanho e os cabeçalhos ao servir).
- **Banco:** a migração 016 apaga a coluna `usuarios.avatar_url` (o front nunca gravou nela; só aceitava texto livre via API, o que deixava qualquer URL externa virar avatar) e cria `usuarios.foto TEXT NULL` com o nome do arquivo (`<uuid>.webp`, com CHECK no formato).
- **Disco:** `ANEXOS_DIR/fotos/<uuid>.webp` (na VPS, dentro de `anexos/`: entra no `tar` do backup sem mexer no compose). A `conferirAnexos` precisa ignorar a subpasta `fotos/` (ou conferi-la à parte); nunca apagá-la.
- **Troca:** grava o arquivo novo, atualiza o banco, depois apaga o antigo. Remover: limpa o banco e apaga o arquivo. Ninguém é excluído do sistema: o `DELETE /usuarios/:codigo` só inativa (ADR-006), e o registro fica, com a foto (usuário, 18/11).
- **Servir:** `GET /fotos/:arquivo` sem login. Nome fora do formato `<uuid>.webp` ou inexistente: 404. Cabeçalhos: `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`, `Cross-Origin-Resource-Policy: same-site` (em dev o front e a API ficam em portas diferentes; em produção é o mesmo domínio). Fica fora do `compression` (WebP já é comprimido).
- **API das pessoas:** onde hoje sai `avatarUrl`, passa a sair `foto` (nome do arquivo ou `null`): lista de pessoas, `/auth/me`, perfil, autor de comentário. O front monta o endereço com a base da API.
- **Front, onde aparece:** o componente `Av` (`components/Ui.jsx`: equipes em Projetos e Projeto, responsáveis no `CartaoTarefa`), o avatar do topo (`components/Layout.jsx`), o avatar grande do perfil (`Perfil.jsx`) e qualquer outro lugar que mostre iniciais. Sem foto, ou se a imagem falhar ao carregar: iniciais, como hoje. Imagem com `alt` = nome, `loading="lazy"` nas listas.
- **Depois de trocar a foto:** a tela atualiza na hora para a própria pessoa (topo, perfil e listas), sem recarregar a página.

### Links com logo

- No perfil (o próprio e o de outra pessoa), GitHub, LinkedIn e calendário viram cartões: logo, nome do serviço e o link encurtado; abrem em nova aba (`rel="noreferrer"`). Sem link, o cartão não aparece; sem nenhum, a seção some (no próprio perfil, um convite para preencher).
- Logos **fiéis aos oficiais, nas cores da marca** (usuário, 18/11): GitHub (Invertocat, conforme o tema claro/escuro), LinkedIn (o "in" no quadrado azul `#0A66C2`) e Google Agenda (ícone colorido do produto) se o link é do Google (`calendar.google.com`, `calendar.app.google`); outro link de calendário: ícone de calendário genérico. SVGs tirados dos kits de marca oficiais (GitHub logos, LinkedIn brand, Google Workspace), embutidos no front (sem CDN), sem alterar proporções nem cores.
- Edição dos links segue no formulário do perfil, como hoje.

### Saída das tecnologias e habilidades

- **Migração 016:** apaga `usuario_habilidades`, `habilidades` e o tipo `tipo_habilidade`. Os dados só voltam restaurando o backup feito antes do deploy (o usuário aceitou, 18/11).
- **Backend:** saem a rota `/habilidades`, o campo `tecnologias` do `PUT /auth/perfil` (se vier, é ignorado: front e back sobem juntos, mas uma aba antiga não deve dar erro), `habilidades` da pessoa, entidade `Habilidade`, enum `TipoHabilidade`, repositórios (memória e banco) e métodos das factories, trechos dos carregadores, swagger, dados fictícios.
- **Frontend:** saem a seção Tecnologias do perfil, a coluna "Tecnologias" de Pessoas, `tecnologias` e `tecnologiasDe` em `services/pessoas.js`.

## Permissões (doc 06, seção 3, no mesmo PR)

| Ação | Diretor | Gerente | Membro | Trainee |
|---|---|---|---|---|
| Enviar, trocar e remover a própria foto | ✅ | ✅ | ✅ | ✅ |
| Ver a foto de qualquer pessoa | ✅ (endereço público) | ✅ | ✅ | ✅ |

Sem ação nova no catálogo de permissões (a própria foto só exige login).

## Documentos a atualizar

`docs/sistema/06_documento_do_sistema.md` (seções 2 a 4: foto, links, saída das tecnologias), `docs/GUIA_DE_USO.md` (Meu perfil, Pessoas), `docs/PUBLICACAO.md` ("Publicação da sessão 22": backup, deploy back e front juntos, conferir "016" no log, `conferirAnexos` com código 0, teste de foto de fora: `curl -I` numa foto dá 200 sem login e um nome inválido dá 404).

## Testes esperados

- Back, unidade: assinatura WebP, limite de 300 KB, nome de arquivo inválido, troca apaga a antiga, remover.
- Back, integração: migração 016 (tabelas somem, coluna `foto` com CHECK), `GET /fotos` com cabeçalhos certos e 404, perfil sem `habilidades`.
- Front: helper de recorte (cálculo do quadrado), escolha do logo do calendário, `Av` com e sem foto (cai nas iniciais se a imagem falhar).
- E2E: enviar foto pela tela, ver no topo e numa equipe; trocar de conta na mesma aba e conferir que o topo mostra a foto da pessoa nova.

## Deixado para quem constrói

- Como recortar (biblioteca pequena tipo `react-easy-crop` ou recorte próprio com canvas); deve funcionar com toque no celular (375 px).
- Nome e lugar dos casos de uso (provável `GerirFotoPerfil` em `useCases/pessoas/`) e da interface de armazenamento (reaproveitar o padrão de `ArmazenamentoAnexosDisco`).
- Formato exato do envio (corpo cru `image/webp`, como os anexos, ou outro).
