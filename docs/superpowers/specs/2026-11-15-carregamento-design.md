# Sessão 18: desempenho do carregamento (desenho)

Desenho base aprovado pelo usuário em 15/11/2026. Quase tudo no frontend (`FrontendProjetosERP`); no backend, só a compressão das respostas (item 11) e este documento.

## Por quê
A VPS fica em Boston: cada ida e volta leva de 130 a 230 ms, enquanto o servidor responde em menos de 25 ms. Hoje, ao recarregar, há 4 esperas em sequência (página, `/auth/me`, dados globais, dados da tela), cerca de 1 s. Ao trocar de tela, os dados da tela são buscados de novo do zero, com "Carregando…".

## Metas
- Recarregar em cerca de 0,3 s a menos de 0,5 s.
- Navegar sem "Carregando…" em tela já vista.

## Fora do escopo
- Mudar a VPS para o Brasil (alternativa registrada, não escolhida).
- Mudanças na API (rotas, formatos, permissões). A compressão (item 11) não muda nenhuma resposta.
- A espera extra quando o token de 15 min venceu antes do F5 (401, renovação e repetição) fica como está.

## Não pode acontecer (anti-metas)
- Dados guardados fora da memória da aba (`localStorage`, `sessionStorage`, IndexedDB).
- Uma pessoa ver dado guardado de outra (troca de conta na mesma aba).
- Dado guardado sobreviver ao logout ou à sessão expirada.
- Dado guardado continuar na tela depois de a API responder 401, 403 ou 404 na atualização.

## Abordagens
1. **Memória própria no `useCarregar` (escolhida).** Chave opcional por tela; mostra o guardado e atualiza por trás. Cerca de 60 linhas, sem dependência nova, segue a decisão de manter a stack.
2. TanStack Query (ou SWR). Padrão de mercado, mas adiciona dependência, aumenta o pacote limitado no CI e muda o jeito de todas as telas carregarem.
3. Mudar a VPS para o Brasil. Resolve a latência na raiz, mas é infraestrutura, fora do pedido.

O padrão usado é o *stale-while-revalidate* (RFC 5861). A API continua conferindo permissão e sigilo em toda chamada; a memória só guarda o que a API já entregou à pessoa.

## Desenho
1. **Início em paralelo** (`src/context/AppContext.jsx`): `/auth/me`, dados globais e `/auth/permissoes` saem num só `Promise.all`. Ao recarregar: página + uma espera.
2. **Layout e menu na hora:** o layout e o menu aparecem assim que as permissões chegam; os dados que faltam aparecem como esqueletos, não como "Carregando…" na página inteira.
3. **Memória das telas** (`src/lib/useCarregar.js` + um módulo novo em `src/lib`):
   - `useCarregar(carregar, deps, { chave })`: com chave, a tela já visitada abre na hora com o dado guardado e busca o novo por trás; sem chave, funciona como hoje.
   - Guardado só em memória (um `Map` no módulo), separado pela pessoa logada.
   - Apagado no logout, na sessão expirada (`sessao.onExpirada`) e na troca de conta.
   - Resposta 401, 403 ou 404 na atualização remove o dado guardado daquela chave e a tela deixa de mostrá-lo.
   - Depois de salvar, `recarregar()` atualiza a memória junto.
   - Atualização sempre por trás ao abrir a tela (sem prazo de validade).
4. **Capacitações sem busca repetida:** a tela usa a lista que já veio nos dados globais (`D.k`) em vez de buscar de novo.
5. **Testes:** um para cada regra de segurança (só memória, por pessoa, logout, troca de conta, 401/403/404) e para o início em paralelo.
6. **Medição antes e depois** com o mesmo método do diagnóstico de 15/11 (recarregar e trocar de tela contra a API com latência real ou simulada).

## Ganhos extras (pedido do usuário em 15/11: "otimizar o máximo possível, sempre mantendo a segurança")
Nenhum deles muda o tempo de vida da sessão nem o que a API confere.

7. **Renovação antecipada do token:** antes de uma chamada autenticada, se o token de acesso já venceu (prazo `exp` lido do próprio token, com 5 s de folga), renova primeiro. Hoje é 401 → renovar → repetir (3 esperas); passa a ser renovar → chamar (2). Não há renovação por relógio em segundo plano, porque isso manteria a sessão viva sem uso.
8. **Chamadas GET iguais em andamento viram uma só** (`/projetos` sai ao mesmo tempo dos dados globais e da tela). Só enquanto a chamada está em andamento, com a chave incluindo o token; nada fica guardado depois da resposta.
9. **Arquivos das telas baixados com antecedência:** depois que o app abre e o navegador fica ocioso, baixa os arquivos JS das telas que estão no menu da pessoa. É só código, igual para todos, sem dado.
10. **Dados da tela buscados na intenção de abrir:** ao passar o mouse, focar ou tocar num item do menu, a busca da tela começa e vai para a memória (mesmas regras da seção 3). Vale para as telas de lista sem parâmetro na rota.
11. **Respostas da API comprimidas (backend):** `compression` no Express, só para respostas compressíveis e **fora de `/auth/*`**. As rotas `/auth/*` devolvem tokens; ficar de fora delas descarta qualquer risco do tipo BREACH, que aqui já é baixo porque a autenticação vai num cabeçalho e não em cookie. Os anexos já são binários e não são comprimidos.

Não incluído: abrir a ficha de um projeto com os dados da lista antes da resposta, porque os formatos da lista e da ficha são diferentes e o ganho só vale na primeira visita.

## Fica com quem implementa
- Nome e formato do módulo de memória e das chaves por tela.
- Quais telas recebem chave (a ideia é todas as que usam `useCarregar`; filtros da Biblioteca podem ficar sem chave).
- Desenho dos esqueletos, no visual Halo, claro e escuro, responsivo.
