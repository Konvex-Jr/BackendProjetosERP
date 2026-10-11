import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { ApiError, apiUrl, request } from '../src/services/api.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function response(status, body = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }
}

test('request sends authentication and JSON headers only when needed', async () => {
  let captured
  globalThis.fetch = async (url, options) => {
    captured = { url, options }
    return response(200, '[]')
  }

  const result = await request('/projetos', { token: 'jwt-test' })

  assert.deepEqual(result, [])
  assert.equal(captured.url, `${apiUrl}/projetos`)
  assert.equal(captured.options.method, 'GET')
  assert.equal(captured.options.headers.Accept, 'application/json')
  assert.equal(captured.options.headers['access-token'], 'jwt-test')
  assert.equal(captured.options.headers['Content-Type'], undefined)
  assert.equal(captured.options.body, undefined)
})

test('request serializes write bodies and returns parsed JSON', async () => {
  let captured
  globalThis.fetch = async (_url, options) => {
    captured = options
    return response(201, '{"codigo":"task-1"}')
  }

  const body = { titulo: 'Integrar API', codigosResponsaveis: ['user-1'] }
  const result = await request('/tarefas', { method: 'POST', token: 'jwt-test', body })

  assert.deepEqual(result, { codigo: 'task-1' })
  assert.equal(captured.headers['Content-Type'], 'application/json')
  assert.equal(captured.body, JSON.stringify(body))
})

test('request raises ApiError with the API message and HTTP status', async () => {
  globalThis.fetch = async () => response(422, '{"message":"Tarefa inválida"}')

  await assert.rejects(
    request('/tarefas', { token: 'jwt-test' }),
    error => error instanceof ApiError && error.status === 422 && error.message === 'Tarefa inválida',
  )
})

test('request preserves useful error text when the API returns non-JSON', async () => {
  globalThis.fetch = async () => response(500, 'Falha no servidor')

  await assert.rejects(
    request('/projetos', { token: 'jwt-test' }),
    error => error instanceof ApiError && error.status === 500 && error.message === 'Falha no servidor',
  )
})

test('request reports network failures with the configured API URL', async () => {
  globalThis.fetch = async () => { throw new TypeError('network down') }

  await assert.rejects(
    request('/auth/login'),
    error => error instanceof ApiError && error.status === 0 && error.message.includes(apiUrl),
  )
})

test('request returns null for successful empty responses', async () => {
  globalThis.fetch = async () => response(204)
  assert.equal(await request('/usuarios/123', { method: 'DELETE', token: 'jwt-test' }), null)
})


test('request sends binary files without JSON serialization', async () => {
  const originalFetch = globalThis.fetch
  const file = new Blob(['conteudo do arquivo'], { type: 'application/pdf' })
  let captured
  globalThis.fetch = async (_url, options) => {
    captured = options
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const { request } = await import('../src/services/api.js')
    const result = await request('/pastas/folder/documents/upload', { method: 'POST', token: 'token', body: file, headers: { 'X-File-Name': 'arquivo.pdf' } })
    assert.deepEqual(result, { ok: true })
    assert.equal(captured.body, file)
    assert.equal(captured.headers['Content-Type'], 'application/pdf')
    assert.equal(captured.headers['access-token'], 'token')
  } finally { globalThis.fetch = originalFetch }
})
