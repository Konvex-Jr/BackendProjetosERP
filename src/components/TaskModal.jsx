import { useEffect, useState } from 'react'
import Ic from './Icon'
import Multi from './Multi'
import { Prog } from './Ui'
import { ST, chip } from '../lib/utils'
import alerts from '../lib/alerts'

const L = ({ l, children }) => <label className="form-label w-100 mb-3">{l}{children}</label>

export default function TaskModal({ D, up, t, p, T, close, del }) {
  const [draft, setDraft] = useState({ ...t }), [nv, setNv] = useState('')
  const cl = draft.checklist || [], dn = cl.filter(x => x.feito).length
  const patch = o => setDraft(current => ({ ...current, ...o })), setCl = f => patch({ checklist: f(cl) })
  const st = value => patch({ status: value, conclusao: value == 'concluida' ? D.c.hoje : undefined })
  const save = () => { up('t', a => a.map(item => item.id == t.id ? draft : item)); close() }
  const remove = async () => {
    const confirmed = await alerts.confirm({ title: 'Excluir tarefa?', text: 'Esta ação não poderá ser desfeita.', confirmText: 'Excluir tarefa', danger: true })
    if (confirmed) { del(t.id); close() }
  }
  const chain = id => { const o = []; let x = T.find(y => y.id == id); while (x && !o.includes(x.id)) { o.push(x.id); x = T.find(y => y.id == x.dependeDe) } return o }
  const opts = T.filter(c => c.id != t.id && !chain(c.id).includes(t.id)), deps = T.filter(x => x.dependeDe == t.id)
  const addI = () => { const v = nv.trim(); if (!v) return; setCl(a => [...a, { id: crypto.randomUUID(), texto: v, feito: false }]); setNv('') }
  useEffect(() => { const k = e => e.key == 'Escape' && close(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" tabIndex="-1" onClick={close}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" role="dialog" aria-label="Detalhes da tarefa" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-body">
              <input className="tt0 form-control" aria-label="Título da tarefa" value={draft.titulo} onChange={e => patch({ titulo: e.target.value })} />
              <small>em {p.nome}</small>
              <div className="row g-4 mt-1 tcols">
                <div className="col-md-8">
                  <h4><Ic k="list" />Descrição</h4>
                  <textarea className="form-control" rows={4} aria-label="Descrição" placeholder="Adicione uma descrição mais detalhada…" value={draft.descricao || ''} onChange={e => patch({ descricao: e.target.value })} />
                  <h4><Ic k="check" />Checklist{cl.length > 0 && <span className={chip()}>{dn}/{cl.length}</span>}</h4>
                  {cl.length > 0 && <Prog v={dn / cl.length * 100} cls={dn == cl.length ? 'ok' : ''} />}
                  {cl.map(x => (
                    <div className="d-flex align-items-center justify-content-between gap-1" key={x.id}>
                      <label className="form-check flex-grow-1 py-1 m-0">
                        <input type="checkbox" className="form-check-input" checked={x.feito} onChange={() => setCl(a => a.map(y => y.id == x.id ? { ...y, feito: !y.feito } : y))} />
                        <span className={'form-check-label ms-1 ' + (x.feito ? 'dn' : '')}>{x.texto}</span>
                      </label>
                      <button className="dots" aria-label="Remover item" onClick={() => setCl(a => a.filter(y => y.id != x.id))}><Ic k="x" /></button>
                    </div>
                  ))}
                  <div className="d-flex gap-2 mt-2">
                    <input className="form-control" placeholder="Adicionar item" aria-label="Novo item do checklist" value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => e.key == 'Enter' && addI()} />
                    <button className="btn btn-g" onClick={addI}>Adicionar</button>
                  </div>
                </div>
                <div className="col-md-4">
                  <L l="Situação"><select className="form-select mt-1" value={draft.status} onChange={e => st(e.target.value)}>{Object.entries(ST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
                  <L l="Prioridade"><select className="form-select mt-1" value={draft.prioridade} onChange={e => patch({ prioridade: e.target.value })}>{['P1', 'P2', 'P3', 'P4'].map(x => <option key={x}>{x}</option>)}</select></L>
                  <L l="Início"><input className="form-control mt-1" type="date" value={draft.inicio} onChange={e => patch({ inicio: e.target.value })} /></L>
                  <L l="Fim"><input className="form-control mt-1" type="date" value={draft.fim} onChange={e => patch({ fim: e.target.value })} /></L>
                  <div className="mb-3"><div className="form-label">Responsáveis</div><Multi opts={D.u.filter(u => p.membros.includes(u.id))} value={draft.responsaveis || []} onChange={z => patch({ responsaveis: z })} /></div>
                  <L l="Depende de"><select className="form-select mt-1" value={draft.dependeDe || ''} onChange={e => patch({ dependeDe: e.target.value || undefined })}><option value="">Nenhuma</option>{opts.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select></L>
                  {deps.length > 0 && <div><div className="form-label">Tarefas que dependem desta</div>{deps.map(x => <span key={x.id} className={chip('d-block mt-1 text-wrap')}>{x.titulo}</span>)}</div>}
                </div>
              </div>
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button className="btn btn-g" onClick={remove}><Ic k="trash" />Excluir tarefa</button>
                <button className="btn btn-g" onClick={close}>Cancelar</button>
                <button className="btn btn-primary" onClick={save}>Salvar alterações</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
