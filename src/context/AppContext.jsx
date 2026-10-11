import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BLOQ, NAV, path } from '../lib/utils'
import { request, apiUrl } from '../services/api'
import alerts from '../lib/alerts'
import {
  adaptCheckin,
  adaptDocument,
  adaptFeedback,
  adaptProject,
  adaptTask,
  adaptTraining,
  adaptUser,
  readConfig,
  resolveSenioridade,
} from '../lib/apiMappers'


const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)
const TOKEN_KEY = 'konvex_access_token'
const USER_KEY = 'konvex_user_code'

const dateTime = value => new Date(`${value}T12:00:00`).toISOString()

export function AppProvider({ children }) {
  const navigate = useNavigate()
  const [DF, setD] = useState(null)
  const [me, setMe] = useState(null)
  const [md, setMd] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const tokenRef = useRef(sessionStorage.getItem(TOKEN_KEY) || '')

  const loadApiData = async token => {
    const [users, projects, tasks, trainings, checkins, feedbacks, folders, senioridades] = await Promise.all([
      request('/usuarios', { token }),
      request('/projetos', { token }),
      request('/tarefas', { token }),
      request('/capacitacoes', { token }),
      request('/checkins', { token }),
      request('/feedbacks', { token }),
      request('/pastas', { token }),
      request('/senioridades', { token }),
    ])
    const documentsByFolder = await Promise.all(folders.map(folder => request(`/pastas/${folder.codigo}/documentos`, { token })))
    const documents = documentsByFolder.flat().map(adaptDocument)
    return {
      u: users.map(adaptUser),
      p: projects.map(adaptProject),
      t: tasks.map(adaptTask),
      k: trainings.map(adaptTraining),
      i: checkins.map(adaptCheckin),
      f: feedbacks.map(adaptFeedback),
      g: folders.map(folder => ({ id: folder.codigo, nome: folder.nome })),
      d: documents,
      senioridades,
    }
  }

  const refresh = async (token = tokenRef.current, config) => {
    const apiData = await loadApiData(token)
    const resolvedConfig = config || readConfig(apiData.senioridades, false)
    const next = { ...apiData, c: resolvedConfig }
    setD(next)
    return next
  }

  useEffect(() => {
    let active = true

    const initialize = async () => {
      const defaultConfig = readConfig()
      const token = sessionStorage.getItem(TOKEN_KEY)
      const storedUserCode = sessionStorage.getItem(USER_KEY)

      if (!token || !storedUserCode) {
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(USER_KEY)
        tokenRef.current = ''
        setD({
          c: defaultConfig,
          u: [],
          p: [],
          t: [],
          k: [],
          i: [],
          f: [],
          g: [],
          d: [],
        })
        return
      }

      tokenRef.current = token

      try {
        const data = await loadApiData(token)
        if (!active) return

        const user = data.u.find(item => item.id === storedUserCode && item.ativo)
        const config = readConfig(data.senioridades, false)

        if (!user) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(USER_KEY)
          tokenRef.current = ''
          setMe(null)
          setD({ ...data, c: config, u: [], p: [], t: [], k: [], i: [], f: [], g: [], d: [] })
          return
        }

        setMe(user.id)
        setD({ ...data, c: config })
      } catch (error) {
        console.error('Erro ao carregar dados da API:', error)
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(USER_KEY)
        tokenRef.current = ''
        setMe(null)
        setD({ c: defaultConfig, u: [], p: [], t: [], k: [], i: [], f: [], g: [], d: [] })

        if (error.status !== 401) {
          alerts.error('Falha ao conectar com a API', error.message)
        }
      }
    }

    initialize()
      .catch(error => {
        console.error('Falha na inicialização do frontend:', error)
        alerts.error('Falha ao iniciar o frontend', error.message)
      })
      .finally(() => {
        if (active) setSessionReady(true)
      })

    return () => {
      active = false
    }
  }, [])
  const mb = !!DF && !!me && DF.u.find(user => user.id === me)?.perfil === 'membro'
  const D = useMemo(() => {
    if (!DF) return null
    return mb
      ? { ...DF, priv: true, p: DF.p.filter(project => project.membros.includes(me)), t: DF.t.filter(task => (task.responsaveis || []).includes(me)), i: DF.i.filter(item => item.usuarioId === me), f: DF.f.filter(item => item.usuarioId === me) }
      : DF
  }, [DF, me, mb])
  const nav = NAV.filter(([key]) => !mb || !BLOQ.includes(key))

  const entrar = async (email, senha) => {
    setLoading(true)
    try {
      const result = await request('/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), senha } })
      if (!result?.token) throw new Error('A API não retornou um token de autenticação.')
      const data = await loadApiData(result.token)
      const emailNormalizado = email.trim().toLowerCase()
      const user = data.u.find(item => item.email.toLowerCase() === emailNormalizado && item.ativo)
      if (!user) throw new Error('O login foi aceito, mas não foi possível identificar um usuário ativo com esse e-mail.')

      tokenRef.current = result.token
      sessionStorage.setItem(TOKEN_KEY, result.token)
      sessionStorage.setItem(USER_KEY, user.id)
      const config = readConfig(data.senioridades, false)
      setD({ ...data, c: config })
      setMe(user.id)
      navigate('/')
      window.scrollTo(0, 0)
      alerts.toastSuccess('Login realizado', `Bem-vindo(a), ${user.nome.split(' ')[0]}.`)
    } catch (error) {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
      tokenRef.current = ''
      setMe(null)
      alerts.error('Não foi possível entrar', error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const sair = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    tokenRef.current = ''
    setMe(null)
    setMd(null)
    setD(current => current ? { ...current, u: [], p: [], t: [], k: [], i: [], f: [], g: [], d: [] } : current)
    navigate('/login')
    window.scrollTo(0, 0)
  }

  const downloadDocument = async documentUrl => {
    const token = tokenRef.current
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
    const filename = decodeURIComponent(String(documentUrl).split('/').pop().split('?')[0])
    const response = await fetch(`${apiUrl}/uploads/${encodeURIComponent(filename)}`, { headers: { 'access-token': token } })
    if (!response.ok) {
      let message = 'Não foi possível baixar o documento.'
      try { message = (await response.json()).message || message } catch {}
      throw new Error(message)
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }

  const uploadDocument = async (folderId, file) => {
    const token = tokenRef.current
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
    if (!file) throw new Error('Selecione um arquivo para enviar.')
    if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo excede o limite de 20 MB.')
    const encodedName = encodeURIComponent(file.name)
    await request(`/pastas/${folderId}/documentos/upload`, {
      method: 'POST',
      token,
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodedName },
      body: file,
    })
    await refresh()
  }

  const persistCollection = async (key, before, after) => {
    const token = tokenRef.current
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
    const oldById = new Map(before.map(item => [String(item.id), item]))
    const newById = new Map(after.map(item => [String(item.id), item]))
    const created = after.filter(item => !oldById.has(String(item.id)))
    const deleted = before.filter(item => !newById.has(String(item.id)))
    const updated = after.filter(item => oldById.has(String(item.id)) && JSON.stringify(item) !== JSON.stringify(oldById.get(String(item.id))))

    if (key === 'p') {
      for (const item of deleted) await request(`/projetos/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request('/projetos', { method: 'POST', token, body: { nome: item.nome, descricao: item.descricao, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), codigosMembros: item.membros || [] } })
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        const statusOnly = item.status !== old.status && ['nome', 'descricao', 'inicio', 'fim', 'membros'].every(field => JSON.stringify(item[field]) === JSON.stringify(old[field]))
        if (statusOnly) await request(`/projetos/${item.id}/status`, { method: 'PATCH', token })
        else await request(`/projetos/${item.id}`, { method: 'PUT', token, body: { nome: item.nome, descricao: item.descricao, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), codigosMembros: item.membros || [] } })
      }
    } else if (key === 't') {
      for (const item of deleted) await request(`/tarefas/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request('/tarefas', { method: 'POST', token, body: { codigoProjeto: item.projetoId, titulo: item.titulo, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), prioridade: item.prioridade, descricao: item.descricao || null, codigosResponsaveis: item.responsaveis || [] } })
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        const comparable = item => ({ ...item, status: undefined, conclusao: undefined })
        if (item.status !== old.status && JSON.stringify(comparable(item)) === JSON.stringify(comparable(old))) {
          await request(`/tarefas/${item.id}/status`, { method: 'PATCH', token, body: { status: item.status } })
        } else {
          await request(`/tarefas/${item.id}`, { method: 'PUT', token, body: { titulo: item.titulo, dataInicio: dateTime(item.inicio), dataFim: dateTime(item.fim), status: item.status, prioridade: item.prioridade, descricao: item.descricao || null, codigosResponsaveis: item.responsaveis || [], codigoDependencia: item.dependeDe || null, checklist: (item.checklist || []).map(checklistItem => ({ codigo: checklistItem.id, texto: checklistItem.texto, feito: Boolean(checklistItem.feito) })) } })
        }
      }
    } else if (key === 'k') {
      for (const item of created) await request('/capacitacoes', { method: 'POST', token, body: { titulo: item.titulo, data: item.data, hora: item.hora, codigoInstrutor: item.instrutorId || me, vagas: Number(item.vagas), tipo: item.tipo, sala: item.sala } })
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        const wasIn = (old.inscritos || []).some(code => String(code) === String(me))
        const isIn = (item.inscritos || []).some(code => String(code) === String(me))
        if (wasIn !== isIn) {
          await request(`/capacitacoes/${item.id}/inscricoes${isIn ? '' : `/${me}`}`, { method: isIn ? 'POST' : 'DELETE', token, ...(isIn ? { body: { codigoUsuario: me } } : {}) })
        }
      }
    } else if (key === 'i') {
      for (const item of [...created, ...updated]) {
        const existed = oldById.has(String(item.id)) || before.some(old => String(old.usuarioId) === String(item.usuarioId) && old.semana === item.semana)
        await request('/checkins', { method: existed ? 'PUT' : 'POST', token, body: { codigoUsuario: item.usuarioId, semana: item.semana, resumo: item.resumo, aprendizados: item.aprendizados, humor: Number(item.humor), sentimento: item.sentimento || null } })
      }
    } else if (key === 'f') {
      for (const item of created) await request(`/capacitacoes/${item.capId}/feedbacks`, { method: 'POST', token, body: { codigoUsuario: item.usuarioId, nota: Number(item.nota), bom: item.bom || null, melhorar: item.melhorar || null, data: dateTime(item.data) } })
    } else if (key === 'g') {
      for (const item of deleted) await request(`/pastas/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request('/pastas', { method: 'POST', token, body: { nome: item.nome } })
      for (const item of updated) await request(`/pastas/${item.id}`, { method: 'PUT', token, body: { nome: item.nome } })
    } else if (key === 'd') {
      for (const item of deleted) await request(`/documentos/${item.id}`, { method: 'DELETE', token })
      for (const item of created) await request(`/pastas/${item.pastaId}/documentos`, { method: 'POST', token, body: { nome: item.nome, tamanhoBytes: Number(item.tam || 0), dataEnvio: dateTime(item.data || DF.c.hoje), codigoAutor: item.autorId || me, arquivoUrl: item.url, extensao: item.ext && item.ext !== '—' ? item.ext : null } })
      for (const item of updated) await request(`/documentos/${item.id}`, { method: 'PUT', token, body: { nome: item.nome } })
    } else if (key === 'u') {
      for (const item of deleted) await request(`/usuarios/${item.id}`, { method: 'DELETE', token })
      for (const item of created) {
        const senioridade = resolveSenioridade(item, DF?.senioridades || [])
        await request('/usuarios', { method: 'POST', token, body: { nome: item.nome, email: item.email, senha: item.senha, perfil: item.perfil, senioridade } })
      }
      for (const item of updated) {
        const old = oldById.get(String(item.id))
        if (old.ativo && !item.ativo) {
          await request(`/usuarios/${item.id}`, { method: 'DELETE', token })
          continue
        }
        const senioridade = resolveSenioridade(item, DF?.senioridades || [])
        await request(`/usuarios/${item.id}`, { method: 'PUT', token, body: { nome: item.nome, email: item.email, perfil: item.perfil, senioridade } })
      }
    }
    const refreshed = await loadApiData(token)
    const next = { ...refreshed, c: readConfig(refreshed.senioridades, false) }
    setD(next)
  }

  const up = (key, fn) => {
    const before = DF?.[key] || []
    const after = fn(before)
    setD(current => ({ ...current, [key]: after }))
    persistCollection(key, before, after).catch(async error => {
      alerts.error('Não foi possível salvar', error.message)
      try { await refresh() } catch { sair() }
    })
  }

  const form = (title, fields, initial, save) => setMd({ t: title, fs: fields, init: initial, save })
  const go = (name, pid) => { navigate(path(name, pid)); window.scrollTo(0, 0) }

  if (!sessionReady || !DF) return <main className="container py-5">Carregando…</main>

  return <Ctx.Provider value={{ D, DF, up, form, go, me, mb, nav, entrar, sair, md, setMd, loading, refresh, token: tokenRef.current }}>{children}</Ctx.Provider>
}
