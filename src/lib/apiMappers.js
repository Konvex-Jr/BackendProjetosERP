import { iso } from './utils.js'

export const slug = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')

export const dateOnly = value => value ? String(value).slice(0, 10) : ''

export function userCode(value) {
  if (!value || typeof value !== 'object') return value
  return value.codigo ?? value.id ?? null
}

export function adaptUser(user) {
  const senioridadeRef = user.senioridade && typeof user.senioridade === 'object'
    ? user.senioridade
    : null
  const senioridadeValue = senioridadeRef?.codigo || senioridadeRef?.nome || user.senioridade

  return {
    id: user.codigo,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    ativo: user.ativo,
    senha: undefined,
    senioridade: senioridadeValue ? slug(senioridadeValue) : undefined,
    senioridadeRef,
  }
}

export function adaptProject(project) {
  return {
    id: project.codigo,
    nome: project.nome,
    descricao: project.descricao,
    inicio: dateOnly(project.dataInicio),
    fim: dateOnly(project.dataFim),
    status: project.status,
    membros: (project.membros || []).map(userCode),
  }
}

export function adaptTask(task) {
  return {
    id: task.codigo,
    projetoId: userCode(task.projeto),
    titulo: task.titulo,
    descricao: task.descricao || '',
    inicio: dateOnly(task.dataInicio),
    fim: dateOnly(task.dataFim),
    status: task.status,
    prioridade: task.prioridade,
    conclusao: task.dataConclusao ? dateOnly(task.dataConclusao) : undefined,
    dependeDe: userCode(task.dependeDe) || undefined,
    responsaveis: (task.responsaveis || []).map(userCode),
    checklist: (task.checklist || []).map(item => ({
      id: item.codigo ?? item.id,
      texto: item.texto,
      feito: Boolean(item.feito),
    })),
  }
}

export function adaptTraining(training) {
  return {
    id: training.codigo,
    titulo: training.titulo,
    data: dateOnly(training.data),
    hora: training.hora,
    instrutor: training.instrutor?.nome || training.instrutor || '—',
    instrutorId: userCode(training.instrutor),
    vagas: training.vagas,
    tipo: training.tipo,
    sala: training.sala,
    inscritos: (training.inscritos || []).map(userCode),
  }
}

export function adaptCheckin(checkin) {
  return {
    id: checkin.codigo,
    usuarioId: userCode(checkin.usuario),
    semana: dateOnly(checkin.semana),
    humor: checkin.humor,
    resumo: checkin.resumo,
    aprendizados: checkin.aprendizados,
    sentimento: checkin.sentimento || '',
  }
}

export function adaptDocument(document) {
  return {
    id: document.codigo,
    pastaId: userCode(document.pasta),
    nome: document.nome,
    ext: document.extensao || '—',
    tam: Number(document.tamanhoBytes || 0),
    data: dateOnly(document.dataEnvio),
    autor: document.autor?.nome || '—',
    autorId: userCode(document.autor),
    url: document.arquivoUrl,
  }
}

export function adaptFeedback(feedback) {
  return {
    id: feedback.codigo,
    capId: userCode(feedback.capacitacao),
    usuarioId: userCode(feedback.usuario),
    nota: feedback.nota,
    data: dateOnly(feedback.data),
    bom: feedback.bom || '',
    melhorar: feedback.melhorar || '',
  }
}

export function readConfig(registros = [], usarPadrao = registros.length === 0) {
  const senioridades = registros.length
    ? registros
    : (usarPadrao ? [
        { codigo: 'junior', nome: 'Júnior', valorHora: 45 },
        { codigo: 'pleno', nome: 'Pleno', valorHora: 75 },
        { codigo: 'senior', nome: 'Sênior', valorHora: 120 },
      ] : [])

  return {
    hoje: iso(new Date()),
    perfis: ['diretor', 'gerente', 'membro'],
    senioridades: Object.fromEntries(senioridades.map(item => [slug(item.codigo || item.nome), item.nome])),
    valorHora: Object.fromEntries(senioridades.map(item => [slug(item.codigo || item.nome), Number(item.valorHora) || 0])),
  }
}

export function normalizeSenioridades(registros = []) {
  // A API normalmente retorna uma lista de entidades. Aceitamos também a forma
  // de configuração usada pelas telas para evitar divergências entre versões.
  const lista = Array.isArray(registros)
    ? registros
    : Object.entries(registros || {}).map(([codigo, valor]) =>
      typeof valor === 'object' && valor !== null
        ? { codigo: valor.codigo || codigo, ...valor }
        : { codigo, nome: valor, valorHora: 0 }
    )

  return lista
    .map(item => ({
      codigo: String(item?.codigo ?? item?.code ?? item?.id ?? '').trim(),
      nome: String(item?.nome ?? item?.name ?? '').trim(),
      valorHora: Number(item?.valorHora ?? item?.valor_hora ?? item?.hourlyRate ?? 0),
    }))
    .filter(item => item.codigo && item.nome)
}

export function resolveSenioridade(user, registros = []) {
  const senioridades = normalizeSenioridades(registros)
  const selecionada = user.senioridade
  const chave = typeof selecionada === 'object' && selecionada
    ? selecionada.codigo || selecionada.code || selecionada.nome || selecionada.name
    : selecionada
  const chaveNormalizada = slug(chave)
  const encontrada = senioridades.find(item =>
    slug(item.codigo) === chaveNormalizada || slug(item.nome) === chaveNormalizada
  )

  if (encontrada) return encontrada

  const referencia = user.senioridadeRef
  if (referencia?.codigo) {
    const senioridadeAtual = senioridades.find(item => slug(item.codigo) === slug(referencia.codigo))
    if (senioridadeAtual) return senioridadeAtual
  }

  const opcoesDisponiveis = senioridades.map(item => `${item.codigo} (${item.nome})`).join(', ')
  throw new Error(
    senioridades.length
      ? `A senioridade selecionada "${String(chave || '')}" não corresponde às opções retornadas pela API: ${opcoesDisponiveis}. Atualize a tela e tente novamente.`
      : 'A API não retornou senioridades cadastradas. Verifique os dados da tabela senioridades no banco e atualize a tela.'
  )
}
