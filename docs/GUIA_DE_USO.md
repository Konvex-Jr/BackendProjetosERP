# Guia rápido de uso do ERP da Konvex

Endereço: https://erp.konvexjr.com.br. Entre com o e-mail da Konvex e a senha que você criou pelo link do convite (seção **Primeiro acesso e senha**). Troque a senha em **Meu perfil**.

O que cada pessoa vê depende do papel: **diretor**, **gerente** ou **membro**. Trainees fazem login com o acesso de membro, sem a Biblioteca (seção **Trainee**).

No celular, a barra de baixo mostra Dashboard, Tarefas, Projetos e Capacitações; o botão **Mais** abre o resto do menu.

## Como acessar

O sistema **não aparece no Google**, e é de propósito: ele é só para membros. Para entrar, digite o endereço **erp.konvexjr.com.br** no navegador. Para não precisar digitar toda vez:

- **No computador, salve nos favoritos**: com o sistema aberto, aperte **Ctrl+D** (no Mac, **Cmd+D**) ou clique na estrela da barra de endereço.
- **No celular, adicione à tela inicial**: o sistema ganha um ícone com o símbolo da Konvex, como um aplicativo.
  - **Android (Chrome)**: menu **⋮** → **Adicionar à tela inicial** (ou **Instalar app**).
  - **iPhone (Safari)**: botão **Compartilhar** → **Adicionar à Tela de Início**.

**Errou a senha várias vezes?** Depois de 5 tentativas erradas seguidas, o login daquele e-mail fica bloqueado **por 15 minutos** naquele aparelho e rede. É uma proteção contra quem tenta adivinhar senhas. Espere o tempo indicado na mensagem ou use **Esqueci a senha** (veja abaixo).

## Primeiro acesso e senha

- **Cadastro por convite**: a gestão cadastra só o nome e o e-mail da Konvex (o e-mail tem de terminar em `@konvexjr.com.br`). A pessoa recebe um e-mail de `nao-responda@` com um link para **criar a senha**. O link vale **72 horas** e só funciona **uma vez**. Se vencer ou não chegar (olhe o spam), a gestão reenvia o link pelo menu da pessoa em **Pessoas**.
- **Regra da senha**: pelo menos 8 caracteres, com uma letra maiúscula, um número e um caractere especial (como `@`, `!` ou `#`). Vale ao criar e ao trocar a senha. Quem já tinha senha antiga continua entrando com ela.
- **Esqueci a senha**: na tela de login, clique em **Esqueci a senha**, digite o e-mail e confirme. O sistema responde a mesma mensagem exista ou não o e-mail, e quem tem cadastro recebe um link que vale **1 hora**, de uso único. Ao criar a nova senha, todas as sessões abertas são encerradas.
- **Manter conectado**: marque a opção no login para ficar entrando sozinho por **15 dias** (contados do login, sem renovar). Ele guarda um cookie seguro só naquele navegador; use apenas em aparelho seu. **Sair** apaga o cookie. Ao trocar a senha, os outros aparelhos pedem login de novo.
- **Ninguém vê nem define a senha de outra pessoa**, nem a gestão: o link só chega ao e-mail da própria pessoa.

---

## Membro

**Dashboard**: suas tarefas abertas e atrasadas, o andamento delas (burndown) e as capacitações em que você se inscreveu.

**Avisos**: a API de avisos (`GET /avisos`, `PATCH /avisos/lidos`) traz, para quem está logado, os avisos gravados (tarefa que você recebeu e capacitação nova; no máximo 30, com o número de não lidos) e a situação do momento: tarefas atrasadas, tarefas que vencem hoje ou amanhã e capacitações de hoje ou amanhã. Só entram tarefas de projetos que você pode ver por inteiro. Diretor e gerente recebem também a lista de pessoas acima de 100% de ocupação na semana. Avisos lidos somem depois de 30 dias.

**Tarefas**: abre em "Minhas tarefas" (de projetos, inclusive o geral da sua área). Alterne para "Tudo o que vejo" para ver as tarefas dos seus projetos.
- **Nova tarefa**: só em projeto do qual você faz parte. Você fica como responsável; o líder organiza depois. A janela de criação é a mesma da tarefa e já aceita **descrição**, **checklist** (cada item pode ter um responsável, escolhido entre os responsáveis da tarefa) e **anexos** (os arquivos escolhidos sobem depois que a tarefa é criada; se algum falhar, o aviso diz quais e a tarefa fica criada para você reenviar).
- **Editar e excluir o que você criou**: se você criou a tarefa e ainda está na equipe do projeto, edita e exclui a tarefa. Você não troca os responsáveis nem a situação dela (isso segue com o líder e com os responsáveis). Quem saiu da equipe perde essa edição.
- **Checklist**: marque os itens direto na tarefa; a marcação grava na hora, sem precisar de **Salvar**. Marcam os responsáveis da tarefa, o líder e a gestão (qualquer item, não só os seus). Quem edita a tarefa também muda o texto e o responsável de cada item. Se alguém sai dos responsáveis da tarefa, os itens dele ficam sem responsável.
- **Concluída em**: tarefa concluída mostra a data de conclusão, que o responsável, o líder, a gestão (ou quem criou a tarefa e está na equipe) pode corrigir. A data não pode ser futura nem anterior ao início da tarefa, e quem concluiu não muda. Os indicadores e o burndown passam a usar a data corrigida.
- **Aviso ao fechar**: se você mexeu na tarefa e fecha a janela (X, Esc, clicar fora ou Cancelar), o sistema pergunta se quer descartar as alterações.
- **Filtros guardados**: os filtros da tela Tarefas (pessoa, origem, situação, prazo e visão) ficam guardados enquanto a aba estiver aberta, só para você; somem ao sair, trocar de conta ou recarregar a página.
- **Atrasadas no projeto**: acima do quadro e da lista do projeto, o seletor **Prazo** mostra todas, só as atrasadas ou as que vencem esta semana.
- Na tela Tarefas o quadro é por **semana**: cada cartão mostra um selo com a **etapa** da tarefa (A fazer, Fazendo...). Arraste o cartão para a coluna **Concluído** (ou use Concluir/Reabrir no modal) para concluir ou reabrir as tarefas **em que você é responsável**.
- **Dificuldade**: cada tarefa tem uma dificuldade (Rápida, Fácil, Média ou Difícil; ao lado de cada opção aparecem as horas, por exemplo "Média (4 h)"). É ela que mede a carga da tarefa: as horas se espalham pelos dias de trabalho (segunda a sexta) entre a data de início e a de entrega. Tarefa sem dificuldade não entra na conta. Ao escolher os responsáveis, cada nome mostra a **ocupação** da semana da entrega; se a tarefa deixar alguém acima de 100% numa semana, o sistema **avisa** depois de salvar (é um aviso, não bloqueia).
- Comente em qualquer tarefa dos seus projetos. Você apaga só os seus comentários.
- **Anexos na tarefa**: no modal, a seção **Anexos** (acima dos comentários) guarda a entrega da tarefa. Quem vê a tarefa vê e baixa os arquivos; quem é da equipe atual do projeto anexa (no projeto geral da área, só o responsável); o **líder do projeto** anexa e exclui qualquer anexo das tarefas do projeto; os demais excluem só o que enviaram. Tarefa nova só aceita anexo depois de salva. Nos cartões do Kanban e nas listas, um **clipe** com um número mostra quantos arquivos a tarefa tem.

**Projetos**: só os projetos de que você participa ou participou, mais o **projeto geral** de cada área em que você tem ou teve período. Dentro do projeto: Tarefas (kanban por etapa e cronograma), Visão geral e Equipe.
- **Kanban por etapa**: as colunas são as etapas do trabalho daquele projeto (por padrão, A fazer, Fazendo, Revisando e Concluído). Cada cartão mostra o prazo, mas o prazo não depende da coluna.
- **Mover uma tarefa**: arraste o cartão para outra coluna, ou use **Mover para...** no menu do cartão (no celular, o menu é o caminho). Você move as tarefas em que é responsável; o líder move qualquer uma. No modal da tarefa, o campo **Etapa** faz o mesmo. Entrar na coluna marcada como concluída conta a tarefa como concluída; sair dela a reabre.
- **Projeto interno e projeto geral da área**: projeto **interno** é da própria EJ (não é de cliente) e sempre pertence a uma área; na lista dá para filtrar por tipo. Cada área tem um **projeto geral** ("Área geral"), criado pelo sistema, onde ficam as tarefas que antes eram avulsas. Nele a equipe é quem tem período na área (você não monta a equipe), quem lidera a área organiza o quadro e as tarefas, e ele não pode ser editado, excluído, arquivado à mão nem ficar sigiloso (só as colunas do quadro mudam). Ele é arquivado quando a área é inativada e volta quando ela é reativada.
- **Editar colunas** (botão acima do quadro, só para o líder e a gestão): crie, renomeie, mude a cor, reordene com os botões subir e descer, e exclua colunas, de 2 a 12 por projeto. Marque qual coluna é a de **entrada** (onde caem as tarefas novas) e qual é a **concluída**; cada uma existe uma só vez. Ao excluir uma coluna que tem tarefas, o sistema pergunta para qual coluna elas vão. Ao trocar a coluna concluída, o sistema avisa quantas tarefas passam a contar como concluídas e quantas voltam a abertas.

**Capacitações**: veja as próximas em lista ou no **calendário** do mês (no celular, em forma de agenda). Abra uma para ver a descrição, baixar ou abrir o material (PDF e imagem abrem numa janela do sistema) e **se inscrever**; dá para cancelar até a hora de início. Depois da capacitação, se a gestão marcou sua presença, a ficha mostra **Avaliar** (nota de 1 a 5 e dois comentários). A gestão lê sua avaliação com seu nome; quem ministrou lê sem o nome; os demais veem só a média. As horas das capacitações em que você esteve presente aparecem no seu perfil.

**Biblioteca** (no celular, fica no **Mais**): o material da Konvex num lugar só (pesquisas, decisões, aprendizados, documentos, ideias). Cada item tem título, texto, links, anexos, tags, um projeto (se quiser) e um **sigilo**.
- Você lê os itens de sigilo **Todos** e os de **Equipe de um projeto** dos projetos de que participa ou participou. Itens **Só gestão** são só da gestão.
- Procure por texto (título, conteúdo e tags): a busca **não diferencia maiúsculas nem acentos** ("reuniao" acha "Reunião"). O filtro por tag, ao contrário, pede a tag exata. Filtre também por projeto, sigilo e autor.
- **Novo item**: título, projeto e sigilo (o formulário mostra só os que você pode usar), texto, links, tags e arquivos. Preencha texto, link ou arquivo. No campo de arquivos, escolher ou soltar de novo **substitui** a seleção anterior: para mandar vários, escolha todos de uma vez (a lista **Escolhidos** abaixo do campo mostra o que vai). Você fica como autor. Só dá para ligar um projeto de que você participa ou participou.
- O texto aceita Markdown simples: `## Título`, `- item de lista`, `**negrito**`, `*itálico*` e links `[texto](https://...)`.
- Você edita e exclui só os itens que cadastrou. Quem sai da equipe de um projeto continua editando os próprios itens.
- **Anexos**: na ficha dos seus itens, use **Anexar arquivos** (até 20 MB cada; PDF, Word, Excel, PowerPoint, OpenDocument, CSV, TXT, imagens ou ZIP). Quem lê o item baixa; quem edita o item exclui.
- **Vários arquivos de uma vez:** escolha vários no seletor ou **arraste e solte** na área de envio (na ficha e no formulário do item, na tarefa e nas capacitações). Os arquivos sobem um de cada vez; se algum falhar (tipo ou tamanho), o aviso diz quais e os demais ficam anexados.
- **Ver sem baixar:** clique no nome de um PDF ou de uma imagem (PNG, JPG, WEBP, GIF) para abri-lo numa janela do sistema, com o botão **Baixar**; Esc fecha. Word, Excel, PowerPoint, OpenDocument, CSV, TXT, MD e ZIP só baixam. No celular, o PDF é baixado em vez de abrir na janela.
- **Ver e baixar mais rápido:** ao passar o mouse, focar ou tocar no nome de um PDF ou imagem de até 5 MB, o sistema já começa a buscar o arquivo. Os arquivos ficam guardados só na memória da aba por 10 minutos (até 50 MB no total): nada vai para o disco do seu aparelho, e tudo some ao sair ou trocar de conta. Arquivos maiores que 1 MB mostram uma barra de progresso.
- **Clipe:** nas listas da Biblioteca e nos cartões de tarefa, o clipe com número mostra quantos arquivos o item tem.
- **No perfil:** em **Meu perfil** e no perfil de outras pessoas, a seção **Itens na Biblioteca** lista o que a pessoa cadastrou (só o que você pode ler); clique para abrir a ficha.
- Na ficha de cada projeto, a aba **Biblioteca** mostra os itens ligados a ele que você pode ver.
- Ideia de inovação? Cadastre como item da Biblioteca (sugestão: tag `inovacao`). Quem acompanha o trabalho é a gestão, com tarefas no projeto geral de Inovação.

**Meu perfil** (no menu): seus dados de contato e apresentação (telefone, e-mail pessoal, LinkedIn, GitHub, link do calendário, curso, ingresso na faculdade e bio), troca de senha e a sua foto.
- **Ocupação da semana**: percentual de horas da semana em relação ao teto do seu cargo (por padrão 10 h por semana; diretoria, presidência e vice-presidência, 20 h), com a barra (até 80% normal, de 81 a 100% atenção, acima disso alerta) e as setas para ver outras semanas. A lista mostra as tarefas que somam (título, projeto e horas na semana). Tarefa de projeto sigiloso a que você não tem acesso entra na linha **Outras tarefas**, só com as horas. O mesmo cartão aparece no perfil das outras pessoas.
- **Foto**: clique no círculo da foto (ou em **Trocar foto**), escolha uma imagem JPEG, PNG ou WebP de até 5 MB, ajuste o recorte quadrado e salve. **Remover foto** volta às iniciais. A foto aparece no topo, nas listas de pessoas, nas equipes e nos cartões de tarefa.
- **Links**: GitHub, LinkedIn e calendário aparecem como cartões com o logo de cada um; clique para abrir. Não há mais a seção de tecnologias.
- **Áreas e cargos**: suas áreas atuais (você pode estar em mais de uma, cada uma com o seu cargo) e a trajetória anterior, com as datas. Quem lança e corrige é a gestão; no seu perfil a seção é só leitura.

**Projetos**: vê todos. Cria e edita projetos, muda a situação (Em andamento, Atenção, Bloqueado, Concluído, Arquivado), monta a equipe (função, entrada e saída) e escolhe o líder. A equipe mostra a **ocupação na semana** de cada pessoa (calculada das tarefas, sem edição); não existe mais percentual de alocação digitado à mão.

**Tarefas**: vê e organiza todas. Filtra por pessoa, projeto e situação. Toda tarefa fica num projeto: o que era avulso vive no **projeto geral** da área. Anexa arquivos em qualquer tarefa, inclusive as do projeto geral, e exclui qualquer anexo de tarefa.

**Pessoas**: a tabela tem a coluna **Ocupação** (percentual da semana atual, ordenável). Cadastra e edita pessoas (exceto diretores; o curso, entre Ciência da Computação, Engenharia Mecânica e Engenharia Elétrica, é obrigatório no cadastro; o telefone tem 10 ou 11 dígitos; o **fim do trainee** é gravado quando o Trainee vira Ativo e só a gestão o corrige), muda o status (Ativo ou Inativo; Trainee só no cadastro; ao inativar, informe o **motivo da saída**, que fica visível no perfil; quem já era Alumni virou Inativo com o motivo "Alumni") e reenvia o link de senha (convite ou redefinição) de quem tem login (Ativo e Trainee); a gestão nunca vê nem define a senha. Quando alguém sai, as participações são encerradas, mas o histórico fica.
- **Áreas e cargos** ficam no perfil da pessoa, não no formulário: na seção **Áreas e cargos**, adicione um período (área, cargo opcional, início e, se já terminou, o fim), corrija as datas ou exclua um lançamento errado. Nenhuma data pode ser no futuro, e dois períodos na mesma área não podem se sobrepor. Quando a pessoa sai da EJ, as áreas atuais dela são encerradas na data de saída; se ela voltar, lance um período novo.

**Biblioteca**: lê todos os itens, de qualquer sigilo, e usa o sigilo **Só gestão**. Liga um item a qualquer projeto. Edita e exclui qualquer item (por exemplo, para corrigir tags ou tirar algo repetido) e os anexos dele.

**Capacitações**: use **Nova capacitação** (título, quem ministra, data, início, duração em horas, tipo, sala ou local, vagas e descrição). Na ficha: editar, excluir, anexar **material** (slides, apostila; vários arquivos de uma vez, arrastando e soltando), ver e tirar inscritos e **inscrever pessoa** (inclusive depois do início, para quem apareceu sem inscrição). Depois que a capacitação começa, marque quem compareceu e clique em **Salvar presença**: isso libera a avaliação e conta as horas no perfil de cada um. Em **Avaliações individuais** você lê cada avaliação com o nome.

**Visão Estratégica** e **Simular precificação**: disponíveis no menu.

---

## Diretor

Tudo o que o gerente faz, mais:
- **Tarefas**: como a gerência, anexa arquivos em qualquer tarefa (inclusive as do projeto geral) e exclui qualquer anexo de tarefa.
- **Pessoas**: cadastra e edita outros diretores.
- **Projetos**: exclui projetos (leva junto os itens da Biblioteca com sigilo Equipe do projeto). Prefira **Arquivar**, que mantém o histórico.
- **Configurações → Áreas**: a opção **Projeto geral** (Sim ou Não) diz se a área tem projeto geral. Desligar exclui o projeto geral da área, mas só se ele não tiver tarefas (senão o sistema avisa quantas são: mova ou exclua antes); ligar de novo cria um projeto geral novo e vazio. Quem já gere áreas em Configurações faz isso.
- **Configurações**: áreas, cargos e senioridades, mais as **Horas por dificuldade** (quantas horas vale cada nível: padrão Rápida 1, Fácil 2, Média 4, Difícil 8) e o **Teto semanal (h)** de cada cargo, de 1 a 40. Mudar as horas ou o teto vale na hora, também para as semanas já passadas. Criar uma área cria o projeto geral dela; renomear a área renomeia o geral, e inativar arquiva. No cargo, marque **Lidera a área** para gerentes e diretores de área: quem tem esse cargo numa área passa a liderá-la, junto com as áreas abaixo dela (regra provisória, que vai ser usada nas próximas versões).

---

## Trainee

Quem entra como trainee faz login como qualquer pessoa, com o acesso de **membro**:
- Vê os projetos de que participa e as tarefas deles, as tarefas do projeto geral da área em que é responsável, o próprio perfil, a lista de pessoas, as capacitações e o Dashboard.
- **Não vê a Biblioteca**: o item não aparece no menu, e abrir o endereço direto mostra erro de acesso.
- **Não pode ser líder** de projeto.
- A gestão cria a pessoa já como Trainee em **Pessoas**, **Nova pessoa**: escolhe o status **Trainee** e recebe o convite por e-mail como as demais pessoas (o perfil fica Membro, sem opção). Se ela perder o acesso, a gestão reenvia o link pelo menu da pessoa.
- Quando ela vira **Ativo**, a Biblioteca aparece ao recarregar a página ou entrar de novo. Trainee é só a etapa de entrada: depois de mudar o status, **não dá para voltar** a Trainee.

---

## Projeto sigiloso

Para projetos que só algumas pessoas devem ver (por exemplo, uma proposta confidencial).

**Como criar (diretor ou gerente):** em **Projetos**, **Novo projeto**, escolha **Visibilidade: Sigiloso** e preencha **Quem mais pode ver o projeto**, além da equipe. A lista aceita só pessoas que têm login. Quem cria o projeto sempre o vê.

**Quem vê o projeto inteiro** (ficha, tarefas, equipe e itens da Biblioteca ligados a ele):
- os diretores;
- quem criou o projeto;
- quem está na lista de acesso;
- a **equipe atual**. Quem sai da equipe perde o acesso (num projeto normal, o histórico continua visível).

**Gerente que não está nessas listas** vê só o **resumo**: nome, situação, datas, quantas tarefas há (e quantas estão concluídas ou atrasadas), a equipe (sem a ocupação). Não vê descrição, tarefas nem Biblioteca, e não edita nada do projeto.

**Membro e trainee fora do projeto** não o veem: ele nem aparece na lista, e abrir o endereço direto mostra "projeto não encontrado".

**Itens da Biblioteca** ligados a um projeto sigiloso somem para quem não vê o projeto inteiro, inclusive para a gestão.

**Marcar ou tirar o sigilo:** quem pode editar o projeto (acesso completo). Na ficha do projeto, clique em **Editar** e mude **Visibilidade**. Quem não está na equipe, nem é diretor, nem está na lista passa a ver só o resumo depois de marcar; o sistema pede confirmação antes.

**Mudar a lista de acesso:** só os diretores e quem criou o projeto. Em **Editar**, mude **Quem mais pode ver o projeto** e salve (por trás, o sistema usa `PUT /projetos/:codigo/acesso`). A aba **Visão geral** mostra a visibilidade e **Quem mais vê**. Quem perdeu o login sai da lista no primeiro salvamento.

---

## Dúvidas comuns
- **Projeto sigiloso sumiu da lista ou diz "não encontrado"**: você não está na equipe atual nem na lista de acesso. Peça a quem criou o projeto ou a um diretor.
- **Sou trainee e não vejo a Biblioteca**: é assim mesmo; ela aparece quando a gestão mudar seu status para Ativo (recarregue a página ou entre de novo).
- **"Você não tem acesso a este projeto"**: você não está (nem esteve) na equipe. Peça à gestão para incluir você.
- **Não consigo concluir uma tarefa**: só o responsável, o líder e a gestão concluem. Peça para ser incluído como responsável.
- **Esqueci a senha**: use **Esqueci a senha** na tela de login. Se o e-mail não chegar em alguns minutos, olhe o spam e peça à gestão para reenviar o link.
- **Algo saiu errado na tela**: recarregue sem cache (Ctrl+Shift+R). Se continuar, avise a gestão com um print.
