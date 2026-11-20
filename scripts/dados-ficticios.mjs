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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = (process.env.API_URL || "http://localhost:5001").replace(/\/$/, "");
const EMAIL = process.env.ADMIN_EMAIL || "dev@konvexjr.com.br";
const SENHA = process.env.ADMIN_PASSWORD || "konvex-dev";
export const SENHA_FICTICIA = "Konvex@123";
// A API não aceita senha no cadastro: grava o e-mail de convite aqui (docker-compose.dev monta ./.emails-dev).
const EMAILS_DEV = process.env.EMAILS_DEV || join(dirname(fileURLToPath(import.meta.url)), "..", ".emails-dev", "emails.jsonl");

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

// Envia um arquivo (bytes no corpo, nome em X-Nome-Arquivo) para a rota de anexos de um dono.
async function enviarArquivo(caminho, token, nome, bytes) {
    const r = await fetch(API + caminho, {
        method: "POST",
        headers: { "access-token": token, "Content-Type": "application/octet-stream", "X-Nome-Arquivo": encodeURIComponent(nome) },
        body: bytes,
    });
    const texto = await r.text();
    if (r.status !== 201 && r.status !== 200) throw new Error(`POST ${caminho} → ${r.status}: ${texto}`);
}

// PDF mínimo válido de uma página (com tabela xref e deslocamentos calculados), para o visualizador abrir sem reclamar.
function montarPdf() {
    const conteudo = "BT /F1 18 Tf 20 50 Td (Documento ficticio) Tj ET";
    const objetos = [
        "<</Type/Catalog/Pages 2 0 R>>",
        "<</Type/Pages/Kids[3 0 R]/Count 1>>",
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
        `<</Length ${conteudo.length}>>\nstream\n${conteudo}\nendstream`,
        "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ];
    let pdf = "%PDF-1.4\n";
    const deslocamentos = objetos.map((corpo, i) => {
        const inicio = pdf.length;
        pdf += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
        return inicio;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const d of deslocamentos) pdf += `${String(d).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<</Size ${objetos.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, "latin1");
}
const PDF_FICTICIO = montarPdf();

function dia(deslocamento) {
    const d = new Date();
    d.setDate(d.getDate() + deslocamento);
    return d.toISOString().slice(0, 10);
}

/** Lê o último link de convite da pessoa no arquivo de e-mails de dev e define a senha fictícia por ele. */
async function definirSenha(email) {
    let token = null;
    try {
        const linhas = readFileSync(EMAILS_DEV, "utf8").trim().split("\n").reverse();
        for (const linha of linhas) {
            const e = JSON.parse(linha);
            if (e.para !== email) continue;
            token = /\/#\/senha\/([^\s"'<>]+)/.exec(e.texto)?.[1] ?? null;
            if (token) break;
        }
    } catch (erro) {
        throw new Error(`Não consegui ler ${EMAILS_DEV} (defina EMAILS_DEV): ${erro.message}`);
    }
    if (!token) throw new Error(`Sem e-mail de convite para ${email} em ${EMAILS_DEV}.`);
    await exigir("POST", `/auth/link-senha/${token}`, undefined, { senha: SENHA_FICTICIA, confirmacao: SENHA_FICTICIA });
}

const CURSOS_FICTICIOS = ["Ciência da Computação", "Engenharia Mecânica", "Engenharia Elétrica"];

async function main() {
    const login = await exigir("POST", "/auth/login", undefined, { email: EMAIL, senha: SENHA });
    const dir = login.token;
    console.log(`Entrou como ${login.usuario.nome}.`);

    const pessoas = await exigir("GET", "/usuarios", dir);
    const porEmail = new Map(pessoas.map((p) => [p.email, p]));

    // Perfil completo (sessão 25b): curso, telefone, e-mail pessoal, ingresso e calendário; quem fica sem
    // eles cai na tela de completar o perfil (só a "Paula Pendente", de propósito). O diretor também.
    await exigir("PUT", "/auth/perfil", dir, {
        curso: CURSOS_FICTICIOS[0],
        telefone: "(11) 98888-0000",
        emailPessoal: "dev.pessoal@exemplo.com",
        ingresso: "2020/1",
        calendarioUrl: "https://calendar.exemplo.com/dev",
    });
    const CURSOS = CURSOS_FICTICIOS;
    let contagemPessoas = 0;
    async function pessoa(nome, email, perfil, extra = {}, soCurso = false) {
        if (porEmail.has(email)) return porEmail.get(email);
        const n = contagemPessoas++;
        const par = n % 2 === 0;
        const criada = await exigir("POST", "/usuarios", dir, {
            nome,
            email,
            perfil,
            codigoSenioridade: "junior",
            curso: CURSOS[n % CURSOS.length],
            ...(soCurso
                ? {}
                : {
                      telefone: par ? `(11) 9${1000 + n}-${2000 + n}` : `(11) 3${100 + n}-${4000 + n}`,
                      emailPessoal: `${email.split("@")[0]}@exemplo.com`,
                      ingresso: `${2021 + (n % 4)}/${(n % 2) + 1}`,
                      calendarioUrl: `https://calendar.exemplo.com/${email.split("@")[0]}`,
                  }),
            ...extra,
        });
        await definirSenha(email);
        console.log(`Pessoa criada: ${nome} (${perfil})`);
        return criada;
    }

    const ines = await pessoa("Inês Gerente", "ines@dev.konvex", "gerente");
    const bia = await pessoa("Bia Membro", "bia@dev.konvex", "membro");
    const caio = await pessoa("Caio Membro", "caio@dev.konvex", "membro");

    // Papel membro, mas com cargo que lidera a área de Execução: organiza o geral da área (sessão 23b).
    const lia = await pessoa("Lia Líder", "lia@dev.konvex", "membro");

    // Trainee com login (papel membro, sem Biblioteca).
    const davi = await pessoa("Davi Trainee", "davi@dev.konvex", "membro", { status: "trainee" });

    // Quem já foi trainee (fim do trainee gravado ao virar Ativo) e quem saiu com motivo (sessão 25b).
    const evaNova = !porEmail.has("eva@dev.konvex");
    const eva = await pessoa("Eva Egressa", "eva@dev.konvex", "membro", { status: "trainee" });
    if (evaNova) await exigir("PATCH", `/usuarios/${eva.codigo}/status`, dir, { status: "ativo" });
    const otoNovo = !porEmail.has("oto@dev.konvex");
    const oto = await pessoa("Oto Inativo", "oto@dev.konvex", "membro");
    if (otoNovo) {
        await exigir("PATCH", `/usuarios/${oto.codigo}/status`, dir, {
            status: "inativo",
            motivoSaida: "Mudou de cidade (fictício)",
        });
    }

    // Perfil incompleto de propósito (tem curso; faltam telefone, e-mail pessoal, ingresso e calendário).
    await pessoa("Paula Pendente", "paula@dev.konvex", "membro", {}, true);

    // Áreas, cargos e períodos (sessão 23a). Bia fica em duas áreas e tem um período antigo encerrado.
    const areasExistentes = await exigir("GET", "/areas", dir);
    async function area(nome, pai = null) {
        const achada = areasExistentes.find((a) => a.nome === nome);
        if (achada) return achada;
        const criada = await exigir("POST", "/areas", dir, { nome, codigoAreaPai: pai?.codigo ?? null });
        areasExistentes.push(criada);
        return criada;
    }
    const cargosExistentes = await exigir("GET", "/cargos", dir);
    async function cargo(nome, lideraArea) {
        const achado = cargosExistentes.find((c) => c.nome === nome);
        if (achado) return achado;
        const criado = await exigir("POST", "/cargos", dir, { nome, lideraArea });
        cargosExistentes.push(criado);
        return criado;
    }
    const areaProjetos = await area("Projetos");
    const areaInovacao = await area("Inovação", areaProjetos);
    const areaExecucao = await area("Execução", areaProjetos);
    const areaCapacitacao = await area("Capacitação", areaProjetos);
    const assessor = await cargo("Assessor", false);
    const gerente = await cargo("Gerente", true);
    await cargo("Diretor", true);
    const coordenador = await cargo("Coordenador", true);
    const periodosFicticios = [
        // Inês lidera Inovação (gerente); Caio é da equipe de Inovação e Execução; Bia fica fora de Inovação.
        [ines, [[areaInovacao, gerente, -300, null]]],
        [
            bia,
            [
                [areaExecucao, assessor, -200, null],
                [areaCapacitacao, assessor, -400, -200],
            ],
        ],
        [
            caio,
            [
                [areaExecucao, assessor, -120, null],
                [areaInovacao, null, -90, null], // sem cargo: só um período com cargo por vez (24a)
            ],
        ],
        [davi, [[areaCapacitacao, null, -10, null]]],
        [lia, [[areaExecucao, coordenador, -60, null]]],
    ];
    for (const [quem, lista] of periodosFicticios) {
        if ((await exigir("GET", `/usuarios/${quem.codigo}/periodos`, dir)).length) continue;
        for (const [a, c, ini, fim] of lista) {
            await exigir("POST", `/usuarios/${quem.codigo}/periodos`, dir, {
                codigoArea: a.codigo,
                codigoCargo: c?.codigo ?? null,
                inicio: dia(ini),
                fim: fim === null ? null : dia(fim),
            });
        }
        console.log(`Períodos de ${quem.nome} lançados.`);
    }

    // Bancos que já tinham os dados antigos: tira o período de Bia em Inovação e a raiz de Inês (idempotente).
    for (const [quem, areaTira] of [
        [bia, areaInovacao],
        [ines, areaProjetos],
    ]) {
        for (const p of await exigir("GET", `/usuarios/${quem.codigo}/periodos`, dir)) {
            if (p.area.codigo === areaTira.codigo)
                await exigir("DELETE", `/usuarios/${quem.codigo}/periodos/${p.codigo}`, dir, undefined, [200, 204]);
        }
    }
    const periodosInes = await exigir("GET", `/usuarios/${ines.codigo}/periodos`, dir);
    if (!periodosInes.length) {
        await exigir("POST", `/usuarios/${ines.codigo}/periodos`, dir, {
            codigoArea: areaInovacao.codigo,
            codigoCargo: gerente.codigo,
            inicio: dia(-300),
            fim: null,
        });
    }
    const periodosCaio = await exigir("GET", `/usuarios/${caio.codigo}/periodos`, dir);
    if (!periodosCaio.some((p) => p.area.codigo === areaInovacao.codigo)) {
        await exigir("POST", `/usuarios/${caio.codigo}/periodos`, dir, {
            codigoArea: areaInovacao.codigo,
            codigoCargo: null,
            inicio: dia(-90),
            fim: null,
        });
    }

    const projetos = await exigir("GET", "/projetos", dir);
    if (!projetos.some((p) => p.nome === "Robô")) {
        await exigir("POST", "/projetos", dir, {
            nome: "Robô",
            descricao: "Projeto interno de Inovação.",
            dataInicio: dia(-10),
            dataFim: dia(90),
            status: "em_execucao",
            tipo: "interno",
            codigoArea: areaInovacao.codigo,
        });
        console.log("Projeto interno Robô (Inovação) criado.");
    }
    let projeto = projetos.find((p) => p.nome === "Site institucional (fictício)");
    if (!projeto) {
        projeto = await exigir("POST", "/projetos", dir, {
            nome: "Site institucional (fictício)",
            descricao: "Projeto de exemplo para desenvolvimento.",
            dataInicio: dia(-20),
            dataFim: dia(40),
            status: "em_execucao",
        });
        await exigir("POST", `/projetos/${projeto.codigo}/membros`, dir, { codigoUsuario: bia.codigo, funcao: "Dev" });
        await exigir("POST", `/projetos/${projeto.codigo}/membros`, dir, { codigoUsuario: caio.codigo, funcao: "Design" });
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

    // Colunas do quadro (sessão 21): 5 etapas no projeto principal e tarefas espalhadas por elas.
    // Reaproveita os códigos das colunas padrão; se o projeto já tem "Em teste", não mexe.
    const detalhe = await exigir("GET", `/projetos/${projeto.codigo}`, dir);
    if (!detalhe.colunas.some((c) => c.nome === "Em teste")) {
        const existente = (nome) => detalhe.colunas.find((c) => c.nome === nome);
        await exigir("PUT", `/projetos/${projeto.codigo}/colunas`, dir, {
            colunas: [
                { codigo: existente("A fazer")?.codigo, nome: "A fazer", cor: "cinza", papel: "entrada" },
                { codigo: existente("Fazendo")?.codigo, nome: "Fazendo", cor: "azul", papel: "meio" },
                { nome: "Em teste", cor: "roxo", papel: "meio" },
                { codigo: existente("Revisando")?.codigo, nome: "Revisando", cor: "amarelo", papel: "meio" },
                { codigo: existente("Concluído")?.codigo, nome: "Concluído", cor: "verde", papel: "concluida" },
            ],
            destinos: {},
        });
        console.log("Projeto: colunas do quadro personalizadas (5).");
    }
    const colunasDoProjeto = (await exigir("GET", `/projetos/${projeto.codigo}`, dir)).colunas;
    const tarefasDoProjeto = await exigir("GET", `/tarefas?codigoProjeto=${projeto.codigo}`, dir);
    for (const [titulo, ini, fim, quem] of [
        ["Testar o formulário de contato", -3, 6, caio],
        ["Revisar os textos", -4, 4, bia],
    ]) {
        if (tarefasDoProjeto.some((t) => t.titulo === titulo)) continue;
        tarefasDoProjeto.push(
            await exigir("POST", "/tarefas", dir, {
                codigoProjeto: projeto.codigo,
                titulo,
                dataInicio: dia(ini),
                dataFim: dia(fim),
                prioridade: "P2",
                codigosResponsaveis: [quem.codigo],
            }),
        );
    }
    // Ocupação semanal (sessão 24a): as 4 dificuldades, uma tarefa que cruza duas semanas e Caio (assessor, teto 10 h)
    // acima de 100% na semana atual. As datas são relativas a hoje, então os dados servem em qualquer semana.
    for (const [titulo, ini, fim, quem, dificuldade] of [
        ["Ajustar o rodapé", -1, 1, bia, "rapida"],
        ["Corrigir os links do menu", -2, 2, bia, "facil"],
        ["Integrar o formulário ao e-mail", -3, 10, bia, "media"],
        ["Redesenhar a página inicial", -6, 6, caio, "dificil"],
        ["Refazer o guia de estilos", -6, 6, caio, "dificil"],
        ["Preparar a apresentação final", -6, 6, caio, "dificil"],
    ]) {
        if (tarefasDoProjeto.some((t) => t.titulo === titulo)) continue;
        tarefasDoProjeto.push(
            await exigir("POST", "/tarefas", dir, {
                codigoProjeto: projeto.codigo,
                titulo,
                dataInicio: dia(ini),
                dataFim: dia(fim),
                prioridade: "P2",
                dificuldade,
                codigosResponsaveis: [quem.codigo],
            }),
        );
    }
    const etapaDaTarefa = {
        "Publicar primeira versão": "A fazer",
        "Protótipo das telas": "Fazendo",
        "Testar o formulário de contato": "Em teste",
        "Revisar os textos": "Revisando",
        "Levantar requisitos": "Concluído",
    };
    for (const t of tarefasDoProjeto) {
        const coluna = colunasDoProjeto.find((c) => c.nome === etapaDaTarefa[t.titulo]);
        if (!coluna || t.coluna?.codigo === coluna.codigo) continue;
        await exigir("PATCH", `/tarefas/${t.codigo}/coluna`, dir, { codigoColuna: coluna.codigo });
    }

    // Anexo numa tarefa do projeto (Bia é responsável e da equipe); reaproveita se a tarefa já tem.
    const tarefaComAnexo = (await exigir("GET", `/tarefas?codigoProjeto=${projeto.codigo}`, dir)).find(
        (t) => t.titulo === "Levantar requisitos",
    );
    if (tarefaComAnexo) {
        const tokenBiaTarefa = (await exigir("POST", "/auth/login", undefined, { email: "bia@dev.konvex", senha: SENHA_FICTICIA })).token;
        const jaTem = await exigir("GET", `/tarefas/${tarefaComAnexo.codigo}/anexos`, tokenBiaTarefa);
        if (jaTem.length === 0) {
            await enviarArquivo(`/tarefas/${tarefaComAnexo.codigo}/anexos`, tokenBiaTarefa, "requisitos.pdf", PDF_FICTICIO);
            console.log("Tarefa: anexo criado.");
        }
    }

    // Projeto sigiloso: Ines (gerente) na lista de acesso; Bia e Davi na equipe; Caio (membro fora) não o vê.
    let sigiloso = projetos.find((p) => p.nome === "Proposta confidencial (fictício)");
    if (!sigiloso) {
        sigiloso = await exigir("POST", "/projetos", dir, {
            nome: "Proposta confidencial (fictício)",
            descricao: "Projeto sigiloso de exemplo.",
            dataInicio: dia(-5),
            dataFim: dia(60),
            status: "em_execucao",
            sigiloso: true,
            acesso: [ines.codigo],
        });
        await exigir("POST", `/projetos/${sigiloso.codigo}/membros`, dir, { codigoUsuario: bia.codigo, funcao: "Dev" });
        await exigir("POST", `/projetos/${sigiloso.codigo}/membros`, dir, { codigoUsuario: davi.codigo, funcao: "Apoio" });
        console.log("Projeto sigiloso (acesso: Inês; equipe: Bia e Davi) criado.");
    }
    if ((await exigir("GET", `/tarefas?codigoProjeto=${sigiloso.codigo}`, dir)).length === 0) {
        await exigir("POST", "/tarefas", dir, {
            codigoProjeto: sigiloso.codigo,
            titulo: "Montar a proposta",
            dataInicio: dia(-2),
            dataFim: dia(15),
            prioridade: "P2",
            codigosResponsaveis: [davi.codigo],
        });
        console.log("Tarefa do trainee no projeto sigiloso criada.");
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

    // Biblioteca: um item por sigilo e um ligado ao projeto (reaproveita pelo título).
    const entrou = async (email) => (await exigir("POST", "/auth/login", undefined, { email, senha: SENHA_FICTICIA })).token;
    const tokenBia = await entrou("bia@dev.konvex");
    const tokenInes = await entrou("ines@dev.konvex");
    const itens = await exigir("GET", "/biblioteca", dir);
    const itensBiblioteca = [
        [tokenBia, { titulo: "Como pedir férias (fictício)", conteudo: "Passo a passo para todos.", tags: ["rh"], sigilo: "todos" }],
        [tokenInes, { titulo: "Metas da diretoria (fictício)", conteudo: "Só a gestão enxerga.", tags: ["metas"], sigilo: "gestao" }],
        [
            tokenBia,
            {
                titulo: "Atas do site institucional (fictício)",
                conteudo: "Decisões da equipe do projeto.",
                sigilo: "projeto",
                codigoProjeto: projeto.codigo,
            },
        ],
        [
            tokenBia,
            {
                titulo: "Reunião de alinhamento (fictício)",
                conteudo: "Item com acento no título, para testar a busca sem acento (digite reuniao).",
                tags: ["reuniao"],
                sigilo: "todos",
            },
            { arquivo: "ata-da-reuniao.pdf" },
        ],
        [
            tokenBia,
            {
                titulo: "Referências de layout (fictício)",
                links: ["https://example.com/layout"],
                sigilo: "todos",
                codigoProjeto: projeto.codigo,
            },
        ],
    ];
    let criados = 0;
    for (const [token, corpo, extra] of itensBiblioteca) {
        if (itens.some((i) => i.titulo === corpo.titulo)) continue;
        const item = await exigir("POST", "/biblioteca", token, corpo);
        if (extra?.arquivo) await enviarArquivo(`/biblioteca/${item.codigo}/anexos`, token, extra.arquivo, PDF_FICTICIO);
        criados++;
    }
    if (criados) console.log(`Biblioteca: ${criados} item(ns) criado(s).`);

    console.log(`Pronto. Contas fictícias: ines@, bia@, caio@ e davi@ (trainee) dev.konvex com a senha ${SENHA_FICTICIA}.`);
}

main().catch((erro) => {
    console.error(erro.message);
    process.exit(1);
});
