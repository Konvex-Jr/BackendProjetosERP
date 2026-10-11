import * as fs from "fs";
import * as path from "path";
import swaggerSpecification from "../source/infra/http/swagger";

describe("Contrato OpenAPI", () => {
    const routesDirectory = path.join(__dirname, "../source/infra/http/Routes");
    const routeFiles = fs.readdirSync(routesDirectory).filter((file) => file.endsWith("Routes.ts"));

    it("documenta todas as rotas HTTP declaradas no backend", () => {
        const declaredRoutes: Array<{ method: string; path: string }> = [];
        for (const file of routeFiles) {
            const source = fs.readFileSync(path.join(routesDirectory, file), "utf8");
            const expression = /http\.route\(\s*"(get|post|put|patch|delete)"\s*,\s*"([^"]+)"/g;
            for (const match of source.matchAll(expression)) {
                declaredRoutes.push({
                    method: match[1],
                    path: match[2].replace(/:([A-Za-z0-9_]+)/g, "{$1}"),
                });
            }
        }

        const paths = (swaggerSpecification as any).paths;
        const undocumented = declaredRoutes.filter(({ method, path: routePath }) =>
            !paths[routePath] || !paths[routePath][method],
        );
        expect(undocumented).toEqual([]);
    });

    it("expõe a autenticação por access-token e a URL de documentação", () => {
        const specification = swaggerSpecification as any;
        expect(specification.openapi).toBe("3.0.3");
        expect(specification.components.securitySchemes.AccessToken.name).toBe("access-token");
        expect(specification.paths["/senioridades"].get).toBeDefined();
    });
});
