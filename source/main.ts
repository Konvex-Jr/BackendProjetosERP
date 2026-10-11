import { config } from "dotenv";

import PostgreSQLConnection from "./infra/database/PostgreSQLConnection";
import ExpressHttp from "./infra/http/ExpressHttp";
import Router from "./infra/http/Router";
import DatabaseRepositoryFactory from "./infra/repository/DatabaseRepositoryFactory";
import ExpressAuth from "./infra/http/Middleware/AuthExpress";

config();

const connection = new PostgreSQLConnection({
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DATABASE ?? '',
    host: process.env.DB_HOST ?? '',
    port: process.env.DB_PORT ?? ''
});

const repositoryFactory = new DatabaseRepositoryFactory(connection);
const auth = new ExpressAuth(repositoryFactory);
const http = new ExpressHttp(auth);
const router = new Router(http, repositoryFactory);

router.init();
http.listen(5001);
console.log('Running...');