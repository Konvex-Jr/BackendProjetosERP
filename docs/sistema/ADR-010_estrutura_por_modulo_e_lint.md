# ADR-010: casos de uso agrupados por módulo, pastas em minúsculas e lint

**Status:** aceita (sessão extra 2, 12/11/2026). **Detalhes:** [revisão de arquitetura](05_revisao_arquitetura.md).

## Contexto
O backend cresceu em duas fases. Na primeira, cada operação ganhou uma pasta própria em `source/useCases/` (`CriarProjeto/`, `ExcluirPasta/`…). Na segunda, cada módulo novo ganhou um caso de uso só (`SalvarConhecimento`, `GerirCapacitacoes`). Resultado: 31 pastas no mesmo nível, sem dizer a que módulo pertencem. As pastas do domínio e da infra misturavam `PascalCase` (`Entity`, `Routes`) com minúsculas (`seguranca`, `erros`). Nenhum dos dois repositórios tinha lint ou formatação automática.

## Decisão
1. Casos de uso ficam em `source/useCases/<módulo>/`, com os nomes dos módulos do registro e dos escopos de commit (`auth`, `pessoas`, `config`, `projetos`, `tarefas`, `documentos`, `conhecimento`, `iniciativas`, `anexos`, `capacitacoes`). As classes existentes não são fundidas.
2. Toda pasta em minúsculas: `domain/entity`, `domain/enum`, `domain/interfaces`, `domain/service`, `infra/http/routes`, `infra/http/middleware`. Arquivos de classe continuam em `PascalCase`.
3. ESLint (com `typescript-eslint` no backend e regras de React/hooks no frontend) e Prettier configurado para o estilo que o código já usa. Os dois rodam no CI. O commit de formatação entra no `.git-blame-ignore-revs`.

## Consequências
- Para achar o código de um módulo: `useCases/<módulo>/` e `infra/http/routes/<Módulo>Routes.ts`.
- Renomear só a caixa de uma pasta pode confundir sistemas de arquivos que não diferenciam maiúsculas (Windows, macOS). Quem tiver um clone antigo nesses sistemas deve clonar de novo se o `git pull` reclamar.
- `git blame` continua útil: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
