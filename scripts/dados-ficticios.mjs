#!/usr/bin/env node
/**
 * Dados fictícios para desenvolvimento e para o levantamento no navegador (frontend/e2e).
 * Fala só com a API (nunca com o banco), então serve para qualquer ambiente de dev.
 * Pode rodar mais de uma vez: o que já existe é reaproveitado.
 *
 *   API_URL=http://localhost:5001 ADMIN_EMAIL=dev@konvexjr.com.br ADMIN_PASSWORD=konvex-dev \
 *     node scripts/dados-ficticios.mjs
 *
 * NUNCA rode contra a produção.
 */
const API = (process.env.API_URL || "http://localhost:5001").replace(/\/$/, "");
const EMAIL = process.env.ADMIN_EMAIL || "dev@konvexjr.com.br";
const SENHA = process.env.ADMIN_PASSWORD || "konvex-dev";
export const SENHA_FICTICIA = "Konvex123";

if (/konvexjr\.com\.br\/api|erp\.konvexjr/.test(API)) {
    console.error("Recusado: este script não roda contra a produção.");
    process.exit(1);
}

async function chamar(metodo, caminho, token, corpo) {
    const headers = {};
    if (token) headers["access-token"] = token;
    if (corpo !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(API + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const texto = await r.text();
    const dados = texto ? JSON.parse(texto) : null;
    return { status: r.status, dados };
}

async function exigir(metodo, caminho, token, corpo, aceitos = [200, 201]) {
    const r = await chamar(metodo, caminho, token, corpo);
    if (!aceitos.includes(r.status)) {
        throw new Error(`${metodo} ${caminho} → ${r.status}: ${JSON.stringify(r.dados)}`);
    }
    return r.dados;
}

function dia(deslocamento) {
    const d = new Date();
    d.setDate(d.getDate() + deslocamento);
    return d.toISOString().slice(0, 10);
}

async function main() {
    const login = await exigir("POST", "/auth/login", undefined, { email: EMAIL, senha: SENHA });
    const dir = login.token;
    console.log(`Entrou como ${login.usuario.nome}.`);

    const pessoas = await exigir("GET", "/usuarios", dir);
    const porEmail = new Map(pessoas.map((p) => [p.email, p]));

    async function pessoa(nome, email, perfil, extra = {}) {
        if (porEmail.has(email)) return porEmail.get(email);
        const criada = await exigir("POST", "/usuarios", dir, {
            nome,
            email,
            senha: SENHA_FICTICIA,
            perfil,
            codigoSenioridade: "junior",
            ...extra,
        });
        console.log(`Pessoa criada: ${nome} (${perfil})`);
        return criada;
    }

    const ines = await pessoa("Inês Gerente", "ines@dev.konvex", "gerente");
    const bia = await pessoa("Bia Membro", "bia@dev.konvex", "membro");
    const caio = await pessoa("Caio Membro", "caio@dev.konvex", "membro");

    const projetos = await exigir("GET", "/projetos", dir);
    let projeto = projetos.find((p) => p.nome === "Site institucional (fictício)");
    if (!projeto) {
        projeto = await exigir("POST", "/projetos", dir, {
            nome: "Site institucional (fictício)",
            descricao: "Projeto de exemplo para desenvolvimento.",
            dataInicio: dia(-20),
            dataFim: dia(40),
            status: "em_execucao",
        });
        await exigir("POST", `/projetos/${projeto.codigo}/membros`, dir, { codigoUsuario: bia.codigo, funcao: "Dev", alocacao: 50 });
        await exigir("POST", `/projetos/${projeto.codigo}/membros`, dir, { codigoUsuario: caio.codigo, funcao: "Design", alocacao: 30 });
        await exigir("PUT", `/projetos/${projeto.codigo}/lider`, dir, { codigoUsuario: bia.codigo });
        for (const [titulo, ini, fim, quem] of [
            ["Levantar requisitos", -15, -10, bia],
            ["Protótipo das telas", -5, 3, caio],
            ["Publicar primeira versão", 5, 20, bia],
        ]) {
            await exigir("POST", "/tarefas", dir, {
                codigoProjeto: projeto.codigo,
                titulo,
                dataInicio: dia(ini),
                dataFim: dia(fim),
                prioridade: "P2",
                codigosResponsaveis: [quem.codigo],
            });
        }
        console.log("Projeto, equipe e tarefas criados.");
    }

    const caps = await exigir("GET", "/capacitacoes", dir);
    if (!caps.some((c) => c.titulo.endsWith("(fictícia)"))) {
        const base = {
            descricao: "Capacitação de exemplo.",
            hora: "19:00",
            duracaoHoras: 2,
            codigoInstrutor: ines.codigo,
            vagas: 10,
            tipo: "computacao",
            sala: "Lab 1",
        };
        const passada = await exigir("POST", "/capacitacoes", dir, { ...base, titulo: "Git e GitHub (fictícia)", data: dia(-7) });
        for (const p of [bia, caio]) await exigir("POST", `/capacitacoes/${passada.codigo}/inscricoes`, dir, { codigoUsuario: p.codigo });
        await exigir("POST", "/capacitacoes", dir, { ...base, titulo: "React do zero (fictícia)", data: dia(3) });
        await exigir("POST", "/capacitacoes", dir, {
            ...base,
            titulo: "Circuitos básicos (fictícia)",
            data: dia(10),
            tipo: "eletrica",
            vagas: 2,
        });
        console.log("Capacitações criadas (uma já passou, com Bia e Caio inscritos).");
    }

    console.log(`Pronto. Contas fictícias: ines@, bia@ e caio@dev.konvex com a senha ${SENHA_FICTICIA}.`);
}

main().catch((erro) => {
    console.error(erro.message);
    process.exit(1);
});
