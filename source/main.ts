import { config } from "dotenv";
import { stringConexao } from "./infra/database/stringConexao";
import PgConexao from "./infra/database/PgConexao";
import ExpressHttp from "./infra/http/ExpressHttp";
import Router from "./infra/http/Router";
import DatabaseRepositoryFactory from "./infra/repository/DatabaseRepositoryFactory";
import ExpressAuth from "./infra/http/middleware/AuthExpress";

// Ponto de entrada da API em produção e no desenvolvimento. As migrações não rodam aqui:
// o Dockerfile executa scripts/migrar.js antes deste arquivo.
config();

// Montagem das camadas, de dentro para fora: banco -> repositórios -> autenticação -> HTTP -> rotas.
// Os testes montam a mesma coisa com MemoryRepositoryFactory (ver test/http/servidorTeste.ts).
const connection = PgConexao.criar(stringConexao());
const repositoryFactory = new DatabaseRepositoryFactory(connection);
const auth = new ExpressAuth(repositoryFactory);
const http = new ExpressHttp(auth);
const router = new Router(http, repositoryFactory);

router.init();
http.listen(Number(process.env.PORT ?? 5001));
console.log(`API disponível na porta ${process.env.PORT ?? 5001}`);
