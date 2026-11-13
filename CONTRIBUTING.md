# Como contribuir

Vale para os dois repositórios: este (backend) e o [FrontendProjetosERP](https://github.com/Konvex-Jr/FrontendProjetosERP). Para subir o sistema na sua máquina, veja o [README](README.md).

## Fluxo
1. Parta da `main` atualizada: `git switch main && git pull --ff-only && git switch -c feat/<assunto>`.
2. Faça a mudança com os testes junto. Uma branch = um assunto.
3. Antes de commitar, rode nos repositórios que mudou: `npm run lint && npm run format:check && npm test` (no backend, também `npm run build`).
4. Abra um PR para a `main`. O CI precisa ficar verde; sem push direto nem force-push na `main`.
5. Mudou backend e frontend juntos? Um PR em cada repositório, citando um ao outro.
6. Depois do merge, a publicação é manual (`docs/PUBLICACAO.md`). Nunca publique antes do merge.

## Commits
[Conventional Commits](https://www.conventionalcommits.org/pt-br/) em português: `tipo(escopo): descrição no imperativo`, até 72 caracteres, sem ponto final. O corpo explica o porquê.

- **Tipos:** `feat`, `fix`, `refactor`, `test`, `docs`, `db`, `build`, `ci`, `chore`, `perf`. Formatação pura é `chore`.
- **Escopos:** `auth`, `pessoas`, `projetos`, `config`, `tarefas`, `capacitacoes`, `documentos`, `conhecimento`, `iniciativas`, `anexos`, `permissoes`, `modulos`, `infra`, `ui`.
- Exemplo: `feat(tarefas): permitir anexos nas tarefas`.

## Checklist do PR
- [ ] Testes cobrindo a mudança (regra nova = teste novo).
- [ ] Erros de entrada dão 400 e dizem qual campo está errado; nunca 500.
- [ ] Permissão nova está no catálogo (`source/shared/seguranca/catalogoPermissoes.ts`) e a tela obedece aos `pode*` vindos da API.
- [ ] Mudou o banco? Migração nova numerada em `migrations/` e `docs/sistema/04_modelo_de_dados.md` atualizado.
- [ ] Tela nova? Item em `source/modulos/registro.ts`, rota com `lazy()` no `App.jsx`, `NAV`, ícone e seção no `docs/GUIA_DE_USO.md`. Responsiva, no visual Halo, no tema claro e no escuro.
- [ ] Rodou o levantamento no navegador (`npm run e2e` no frontend) quando mexeu em tela.
- [ ] Usou IA? Diga no PR o que ela gerou e como você conferiu.

## Onde ler mais
- Arquitetura e decisões: `docs/sistema/` (ADR-009 e ADR-010).
- Dívida técnica conhecida: seções 2 e 3 de `docs/sistema/05_revisao_arquitetura.md`.
