import { useEffect, useRef, useState } from 'react'
import { chip } from '../lib/utils'

export default function Multi({ opts, value, onChange }) {
  const [o, setO] = useState(false), [q, setQ] = useState(''), ref = useRef(null)
  useEffect(() => {
    const f = e => ref.current && !ref.current.contains(e.target) && setO(false)
    document.addEventListener('mousedown', f)
    return () => document.removeEventListener('mousedown', f)
  }, [])
  const tg = id => onChange(value.includes(id) ? value.filter(i => i != id) : [...value, id])
  const L = opts.filter(u => u.nome.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="ms" ref={ref}>
      <div className="mc" onClick={() => setO(true)}>
        {value.map(i => {
          const u = opts.find(x => x.id == i)
          return u && <span className={chip()} key={i}>{u.nome} <button type="button" aria-label={'Remover ' + u.nome} onClick={e => { e.stopPropagation(); tg(i) }}>×</button></span>
        })}
        <input placeholder={value.length ? '' : 'Selecionar…'} value={q} onFocus={() => setO(true)} onChange={e => setQ(e.target.value)} />
      </div>
      {o && (
        <div className="mp">
          {L.map(u => (
            <div key={u.id} className={'mo' + (value.includes(u.id) ? ' on' : '')} onClick={() => tg(u.id)}>
              <input type="checkbox" className="form-check-input m-0" readOnly checked={value.includes(u.id)} />{u.nome}<small>{u.perfil}</small>
            </div>
          ))}
          {!L.length && <div className="mo"><small>Ninguém encontrado</small></div>}
        </div>
      )}
    </div>
  )
}
