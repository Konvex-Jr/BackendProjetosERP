import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function Login() {
  const { me, entrar, loading } = useApp()
  const [em, setEm] = useState(''), [sn, setSn] = useState('')
  if (me) return <Navigate to="/" replace />

  const send = async event => {
    event.preventDefault()
    try { await entrar(em, sn) } catch { /* O contexto apresenta o alerta de erro. */ }
  }

  return (
    <div className="lg row g-0">
      <aside className="lgb col-lg-6 d-none d-lg-flex flex-column justify-content-center gap-2">
        <img src={import.meta.env.BASE_URL + 'assets/logo-branca.png'} alt="Konvex Jr" />
        <h1>Bem-vindo de volta.</h1>
        <p>Seus projetos, capacitações e o check-in da semana estão te esperando.</p>
      </aside>
      <div className="lgf col-12 col-lg-6 d-flex align-items-center justify-content-center p-4">
        <form onSubmit={send}>
          <h2 className="fs-3 fw-bold mb-1">Entrar</h2>
          <small>Use seu e-mail corporativo.</small>
          <label className="form-label w-100 mt-3 mb-3">E-mail
            <input className="form-control mt-1" type="email" required autoComplete="username" value={em} onChange={event => setEm(event.target.value)} placeholder="voce@empresa.com" />
          </label>
          <label className="form-label w-100 mb-3">Senha
            <input className="form-control mt-1" type="password" required autoComplete="current-password" value={sn} onChange={event => setSn(event.target.value)} />
          </label>
          <button className="btn btn-primary w-100 py-2" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
