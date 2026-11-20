# Sessão 25: conta e pessoas

Data: 19 e 20/11/2026. Repositórios: backend e frontend. Dividida em **25a (senha e e-mail)** e **25b (pessoas)**, cada uma com um PR por repositório. Migrações: 021 (25a) e 022 (25b).

## 1. Por que

Hoje a gestão cria a conta digitando uma senha e a passa à pessoa por fora; nada obriga a trocá-la, e quem esquece a senha depende da gestão. A sessão some ao fechar o navegador, o que irrita quem usa o sistema todo dia. E o cadastro de pessoas tem lacunas que a gestão pediu em 19/11: contato depois da saída da EJ, período de trainee, cursos padronizados, contatos fáceis de copiar e um bug na equipe do projeto.

Decisões do usuário (19 e 20/11):
- Boas-vindas e tutoriais por tela **saíram desta sessão**: as telas ainda mudam até a 29, então vão para a 29b. Na publicação da 29b, todos (inclusive quem já usa) veem o onboarding e trocam a senha uma vez.
- O "Esqueci a senha" e o envio de e-mail **vieram da 26 para a 25a**. A 26 reaproveita o envio para os avisos.

## 2. Objetivos

### 25a: senha e e-mail
1. **Convite por e-mail.** Ao criar a pessoa, a gestão não digita senha: o sistema manda ao e-mail da Konvex dela um link de primeiro acesso.
2. **Criar senha** pelo link (convite ou "Esqueci a senha"): só senha nova e confirmação, com regra mínima e medidor fraca/média/forte.
3. **Esqueci a senha** no login: a pessoa informa o e-mail e recebe o link.
4. **Manter conectado por 15 dias**, em cookie `HttpOnly`.
5. **Aviso de senha alterada** por e-mail.

### 25b: pessoas
6. **E-mail pessoal**, visível para todos, com botão de copiar.
7. **Telefone** com botão de copiar no perfil e máscara no cadastro.
8. **Saída da EJ com um status só**: Ativo ou Inativo (Alumni deixa de existir), com descrição do motivo pedida só na saída.
9. **Período de trainee** no cartão de períodos do perfil.
10. **Cursos**: só Ciência da Computação, Engenharia Mecânica e Engenharia Elétrica.
11. **Bug**: participante que some ao ser adicionado na equipe do projeto.

## 3. Fora do escopo
- Boas-vindas, tutoriais e troca obrigatória para quem já tem conta (29b).
- Avisos por e-mail de tarefas e afins (26).
- E-mail pessoal para login, avisos ou recuperação: tudo vai ao e-mail da Konvex enquanto a pessoa estiver ativa.
- Confirmar o e-mail pessoal.

## 4. Anti-objetivos
- O link aparecer no sistema (nem a gestão o vê; só existe no e-mail).
- O "Esqueci a senha" revelar se um e-mail está cadastrado.
- Token de 15 dias legível pelo JavaScript.
- Pessoa deslogada por abrir várias abas ao mesmo tempo (o refresh token gira a cada uso e reapresentar um token velho derruba todas as sessões, ver `RenovarSessao`).
- Enviar e-mail de verdade a partir do computador de desenvolvimento ou dos testes.

## 5. Abordagens consideradas

### Primeiro acesso
- **Senha temporária no e-mail**: a pessoa copia, entra e troca. A senha fica na caixa de entrada para sempre.
- **Link de primeiro acesso (escolhido, 20/11)**: uso único, expira, mesmo mecanismo do "Esqueci a senha" (um código só para os dois fluxos).

### Envio de e-mail
O domínio usa Google Workspace (MX `smtp.google.com`, conferido em 20/11).
- **Serviço de redirecionamento SMTP do Workspace** (`smtp-relay.gmail.com`, autorizado pelo IP da VPS), remetente `nao-responda@konvexjr.com.br` como alias de uma conta existente. Sem senha no `.env`. **Escolhido.**
- Senha de app de uma conta com verificação em duas etapas (`smtp.gmail.com`): plano B se o administrador não liberar o relay.
- Serviço transacional (Resend, Brevo): exige DNS novo; desnecessário para ~30 pessoas.
- Em todos, o código usa `nodemailer` atrás de uma interface; trocar de provedor é só configuração.

### Manter conectado
- Refresh token de 15 dias no `localStorage`: simples, mas roubável por XSS.
- **Cookie `HttpOnly` (escolhido, 19/11)**, 15 dias (o usuário reduziu de 30).

### Saída da EJ
- Manter Alumni e Inativo com motivo, ou um status só. **Escolhido: Ativo ou Inativo, com descrição do motivo na saída.**

## 6. Como fica: 25a

### 6.1 Envio de e-mail
- Interface `EnvioEmail` com `enviar({ para, assunto, texto, html })`. Duas versões: SMTP (`nodemailer`) e **log** (escreve o e-mail no console, sem enviar). Escolha pelo `.env`: sem `SMTP_HOST`, usa o log. Testes usam uma versão em memória que guarda os e-mails enviados.
- `.env`: `SMTP_HOST`, `SMTP_PORTA`, `SMTP_USUARIO` e `SMTP_SENHA` (opcionais no relay por IP), `EMAIL_REMETENTE`, `APP_URL` (base dos links, ex.: `https://erp.konvexjr.com.br`).
- Texto simples e HTML curto com o visual da Konvex (sem imagens externas). Textos em português, sem cara de texto gerado (a 27 revisa).
- Falha no envio não pode desfazer a criação da pessoa: a pessoa é criada, a tela avisa que o convite não saiu e oferece "Reenviar convite". Registrar a falha no log sem o link.

### 6.2 Link de senha (convite e "Esqueci a senha")
- Tabela `links_senha`: código, pessoa, `tipo` (`convite` | `redefinir`), hash SHA-256 do token (como os refresh tokens), `expira_em`, `usado_em`, `criado_em`.
- Token aleatório longo (`randomBytes`), só no e-mail. Link: `APP_URL/#/senha/<token>` (o front usa `HashRouter`).
- Validade: convite 72 horas; "Esqueci a senha" 1 hora (decisão do Claude, ajustável).
- Um link novo do mesmo tipo invalida os anteriores da pessoa. Usar o link invalida todos os links da pessoa.
- `GET /auth/link-senha/:token` (público): diz se o link vale e o tipo, sem dados da pessoa além do primeiro nome. Link inválido, usado ou vencido: 400 com código próprio e a tela explica e oferece "Esqueci a senha".
- `POST /auth/link-senha/:token` (público) com `{ senha, confirmacao }`: confere a regra da senha, grava, marca o link usado, revoga todas as sessões da pessoa, manda o e-mail "Sua senha foi alterada" e **já devolve uma sessão** (a pessoa entra direto).
- Só pessoa com acesso (`STATUS_COM_ACESSO`) usa o link; senão, a mesma resposta de link inválido.
- Limite de tentativas nas rotas públicas, como o login (429).

### 6.3 Convite na criação
- Criar pessoa deixa de pedir senha: a conta nasce sem senha utilizável (hash impossível de casar ou coluna nula; o builder escolhe e garante que o login nunca aceita) e com convite pendente. Só para status com acesso (Ativo ou Trainee).
- Pessoas mostra **"Convite pendente"** enquanto a pessoa não criou a senha, e a gestão (quem pode gerir a pessoa) tem **"Reenviar convite"** (`POST /usuarios/:codigo/convite`), que gera link novo.
- A rota de a gestão definir a senha de outra pessoa (`PUT /usuarios/:codigo/senha`) **sai**: no lugar, "Enviar link de redefinição" para a pessoa. Trainees criados na 20 com senha continuam valendo.
- **Ninguém vê nem define a senha de outra pessoa** (usuário, 20/11): a gestão só manda o link ao e-mail da própria pessoa; o banco guarda só o hash bcrypt; o link não aparece no sistema. Registrar na seção 3 do doc 06.
- Pessoas já cadastradas não recebem convite nem são afetadas.
- **Domínio obrigatório (usuário, 20/11):** todas as pessoas têm e-mail da Konvex. Criar pessoa ou mudar o e-mail exige o domínio configurado em `EMAIL_DOMINIO` (produção: o domínio da Konvex; dev e testes: o dos dados fictícios). Fora dele: 400 dizendo o campo. Contas já gravadas fora do domínio continuam valendo até alguém mudar o e-mail. O relay do Workspace fica restrito ao domínio.
- **"Convite pendente" é calculado** (decisão do Claude): pessoa com acesso e sem senha. Pessoa sem senha que volta a ter acesso (reativada) aparece como pendente e a gestão usa "Reenviar convite"; nada é enviado sozinho ao mudar o status.

### 6.4 Esqueci a senha
- Link "Esqueci a senha" no login abre a tela com o campo e-mail. `POST /auth/esqueci-senha` com `{ email }` responde **sempre** a mesma mensagem ("Se o e-mail estiver cadastrado, você vai receber um link"), em tempo parecido nos dois casos. Envia só se o e-mail é de pessoa com acesso.
- Pessoa com convite pendente que pede "Esqueci a senha" recebe um link normal (vale como convite).

### 6.5 Regra da senha e medidor
- Regra mínima (back e front): pelo menos 8 caracteres, uma maiúscula, um número e um caractere especial. Vale no link e na troca de senha do perfil (`PUT /auth/senha`, que continua pedindo a senha atual). Erro 400 dizendo o que falta.
- Medidor ao lado do campo: **fraca** (não cumpre a regra), **média** (cumpre), **forte** (cumpre e tem 12 ou mais caracteres, ou minúscula e maiúscula e mais de um especial; o builder fecha a conta em `src/lib`, com teste). Lista da regra com cada item marcado conforme a pessoa digita.
- Confirmação diferente: a tela avisa antes de enviar; o back também confere.

### 6.6 Manter conectado (15 dias)
- Login aceita `manterConectado`. Marcado: o refresh token vale 15 dias e vai num cookie `HttpOnly; SameSite=Strict; Path=/api/auth` (com `Secure` em produção). Desmarcado: como hoje (sessionStorage, 7 dias, sem cookie).
- O registro do refresh token guarda se é lembrado; a rotação mantém o prazo de 15 dias contado do login (não renova para sempre) e regrava o cookie.
- `POST /auth/refresh` aceita o token no corpo (como hoje) ou pelo cookie. `POST /auth/logout` revoga e apaga o cookie. Trocar a senha por link revoga tudo.
- Front: aba sem sessão no `sessionStorage` tenta `POST /auth/refresh` com `credentials: 'include'`; essa tentativa e as renovações por cookie ficam em `navigator.locks.request('konvex-sessao', ...)` para não gastar o mesmo token em duas abas.
- CORS em dev (5173 → 5002) precisa de `credentials`; produção é mesma origem.
- Troca de conta na mesma aba (lição da 18) continua limpa: sair apaga o cookie.
- **Uma conta lembrada por navegador** (decisão do Claude): todo login, marcado ou não, substitui ou apaga o cookie anterior (revogando o token dele); "Sair" apaga o cookie. Abas já abertas de outra conta seguem com a sessão da aba até sair ou vencer.

## 7. Como fica: 25b

### 7.1 E-mail pessoal e telefone
- Coluna `usuarios.email_pessoal VARCHAR(254)` opcional, validada como e-mail (400 dizendo o campo). Visível para todos, como o telefone. Edita: a pessoa e quem pode gerir o perfil.
- Perfil: botão de copiar ao lado do telefone e do e-mail pessoal (`navigator.clipboard`, aviso "Copiado").
- Cadastro e edição: máscara `(00) 00000-0000` (celular) e `(00) 0000-0000` (fixo); o builder confere o formato já gravado e mantém compatível.

### 7.2 Saída: Ativo ou Inativo com motivo
- `StatusPessoa` perde `ALUMNI`. Migração: `alumni` → `inativo` com `motivo_saida = 'Alumni'`.
- Coluna `usuarios.motivo_saida TEXT` (até 500 caracteres), **obrigatória ao mudar para Inativo** (400 `MOTIVO_SAIDA_OBRIGATORIO`) e pedida só nesse momento. Quem já era Inativo fica sem motivo ("Não informado"). Voltar a Ativo apaga o motivo e a data de saída.
- O motivo aparece no perfil da pessoa inativa (mesma visibilidade do status).
- Front: a janela de mudar status pede o motivo quando o destino é Inativo; filtros e selos perdem "Alumni". Atualizar doc 06, swagger, `dados:ficticios` e guia de uso.

### 7.3 Período de trainee
- Coluna `usuarios.fim_trainee DATE`, gravada com a data do dia quando o status muda de Trainee para Ativo. A gestão corrige as datas na edição da pessoa; para quem virou Ativo antes da 25b, preenche à mão (a migração não inventa datas).
- Período mostrado no cartão de períodos (`AreasPessoa.jsx`): de `data_entrada` até `fim_trainee` (ou "até hoje"). Sem `data_entrada`, não mostra. `fim_trainee` não antes da entrada nem no futuro.

### 7.4 Cursos
- Na EJ só há pessoas desses 3 cursos (usuário, 20/11). Campo Curso vira lista com os 3, **obrigatório**. O back aceita só esses 3 (400 dizendo o campo).
- Obrigatório ao criar pessoa. Na edição, a regra só vale quando o campo muda (lição da 24b: regra nova não trava dado antigo): não dá para apagar nem gravar valor fora da lista, mas editar outro campo de quem está sem curso continua funcionando.
- Migração: o builder lista os valores atuais no banco de produção antes (consulta na publicação) e mapeia variações óbvias; o que não casar fica vazio. Perfil e Pessoas mostram "Curso não informado" e a gestão preenche.

### 7.5 Bug da equipe
- Relato do acompanhamento: "nome do participante some depois de adicionar". Reproduzir primeiro (e2e ou na mão, nas telas de equipe do projeto), achar a causa, corrigir com teste. Entra na 25b.

## 8. Testes
- 25a: unidade e integração (link de uso único, expiração, invalidação por link novo, resposta igual no "Esqueci a senha", regra da senha, sessão devolvida, sessões revogadas, cookie no login/refresh/logout, rotação mantendo o prazo, criar pessoa sem senha, falha de envio não desfaz a pessoa). Front: `src/lib` (regra e medidor), e2e pela tela: criar pessoa → ler o link no log → criar senha → entrar; esqueci a senha; manter conectado sobrevive a fechar e reabrir o contexto; troca de conta na mesma aba; levantamento de telas.
- 25b: motivo obrigatório, `fim_trainee` automático, cursos, e-mail pessoal; e2e pela tela e levantamento.

## 9. Publicação
- 25a: administrador do Workspace libera o relay SMTP para o IP da VPS e cria o alias; `.env` da VPS ganha as variáveis do e-mail; backup; back e front juntos; teste de envio real (convite para uma conta de teste).
- 25b: backup; consulta dos cursos antes; back e front juntos.

## 10. Deixado para o builder
- Nomes de rotas, componentes e mensagens (seguindo `mensagensDeErro.ts`).
- Como representar "sem senha" no banco.
- Fórmula exata do medidor.
- Detalhes do cookie e do CORS em dev.
