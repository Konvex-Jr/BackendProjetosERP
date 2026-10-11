const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5001').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
        ...(body instanceof Blob && body.type ? { 'Content-Type': body.type } : {}),
        ...(token ? { 'access-token': token } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: body instanceof FormData || body instanceof Blob ? body : JSON.stringify(body) } : {}),
    })
  } catch {
    throw new ApiError(`Não foi possível conectar à API em ${API_URL}. Verifique se o backend está em execução e se VITE_API_URL está correto.`)
  }

  const text = await response.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = { message: text } }
  }

  if (!response.ok) {
    throw new ApiError(data?.message || `A API retornou HTTP ${response.status}.`, response.status)
  }

  return data
}

export const apiUrl = API_URL
