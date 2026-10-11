import { config } from "dotenv";
import PgConexao from "./infra/database/PgConexao";
import ExpressHttp from "./infra/http/ExpressHttp";
import Router from "./infra/http/Router";
import DatabaseRepositoryFactory from "./infra/repository/DatabaseRepositoryFactory";
import ExpressAuth from "./infra/http/Middleware/AuthExpress";

config();

const connectionString = process.env.DATABASE_URL ?? [
    `postgresql://${encodeURIComponent(process.env.DB_USER ?? "")}`,
    `:${encodeURIComponent(process.env.DB_PASSWORD ?? "")}`,
    `@${process.env.DB_HOST ?? "localhost"}`,
    `:${process.env.DB_PORT ?? "5432"}`,
    `/${process.env.DATABASE ?? "postgres"}`,
].join("");

const connection = PgConexao.criar(connectionString);
const repositoryFactory = new DatabaseRepositoryFactory(connection);
const auth = new ExpressAuth(repositoryFactory);
const http = new ExpressHttp(auth);
const router = new Router(http, repositoryFactory);

router.init();
http.listen(Number(process.env.PORT ?? 5001));
console.log(`API disponível na porta ${process.env.PORT ?? 5001}`);
