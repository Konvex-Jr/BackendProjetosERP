import { useState } from 'react'
import Multi from './Multi'

export default function FormModal({ t, fs, init, save, close }) {
  const [v, setV] = useState(init), set = (k, x) => setV(o => ({ ...o, [k]: x }))
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={close}>
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
          <form className="modal-content" onSubmit={e => { e.preventDefault(); if (save(v) !== false) close() }}>
            <div className="modal-body">
              <h3 className="h5 fw-bold mb-3">{t}</h3>
              {fs.filter(x => !x.s || x.s(v)).map(x => x.c
                ? <div className="mb-3" key={x.k}><div className="form-label">{x.l}</div><Multi opts={x.c} value={v[x.k] || []} onChange={z => set(x.k, z)} /></div>
                : <label className="form-label w-100 mb-3" key={x.k}>{x.l}
                  {x.o
                    ? <select className="form-select mt-1" disabled={Boolean(x.disabled)} value={v[x.k] ?? ''} onChange={e => set(x.k, e.target.value)}>{x.o.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
                    : <input className="form-control mt-1" type={x.t || 'text'} required value={v[x.k] ?? ''} onChange={e => set(x.k, e.target.value)} />}
                </label>)}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-g" onClick={close}>Cancelar</button>
                <button className="btn btn-primary">Salvar</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
