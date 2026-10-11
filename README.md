# BackendProjetosERP

## Requisitos
- Node.js 20+
- PostgreSQL com o schema de `source/infra/database/schema.sql` aplicado

## Configuração e execução
1. Copie `.env.example` para `.env` e configure as credenciais do PostgreSQL.
2. Instale as dependências: `npm install`.
3. Inicie API e compilação: `npm start` (ou `npm run main`).
4. A API ficará disponível em `http://localhost:5001` por padrão.

O script `npm start` compila o TypeScript, gera as chaves JWT locais caso estejam ausentes e inicia o servidor. Para usar outra porta, configure `PORT`. Se o Swagger for acessado por outro host, defina `SWAGGER_SERVER_URL` com a URL pública da API.

## Swagger
- Interface: `http://localhost:5001/api-docs`
- Especificação JSON: `http://localhost:5001/api-docs.json`

A documentação é servida pelo próprio backend; não existe um comando separado para iniciar o Swagger. Se a página não abrir, confirme que `npm start` terminou sem erro e que a porta indicada por `PORT` está livre.

## Testes
- `npm test`: testes automatizados do backend.
- `npm run build`: validação/compilação TypeScript.
