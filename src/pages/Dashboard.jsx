import { useApp } from '../context/AppContext'
import { PC, ST, TIPO, chip, d, fm, hj, un } from '../lib/utils'
import Burn from '../components/Burn'
import Ic from '../components/Icon'
import { Prog } from '../components/Ui'

function Agenda({ D, me, go }) {
  const h = hj(D)
  const tk = D.t.filter(t => t.status != 'concluida' && t.responsaveis.includes(me)).sort((a, b) => a.fim > b.fim ? 1 : -1).slice(0, 6)
  const ck = D.k.filter(c => c.inscritos.includes(me) && c.data >= D.c.hoje).sort((a, b) => a.data > b.data ? 1 : -1).slice(0, 6)
  return (
    <>
      <div className="col-md-6"><div className="card card-body h-100">
        <h2>Minhas tarefas</h2>
        {tk.length ? tk.map(t => {
          const lt = d(t.fim) < h
          return (
            <div className="ag" key={t.id} onClick={() => go('projeto', t.projetoId)}>
              <span className={chip(PC[t.prioridade])}>{t.prioridade}</span>
              <div><b>{t.titulo}</b><small>{D.p.find(p => p.id == t.projetoId)?.nome}{lt ? ' · atrasada' : ''}</small></div>
              <span className={chip(lt ? 'er' : '')}>{fm(t.fim)}</span>
            </div>
          )
        }) : <small>Você não tem tarefas abertas.</small>}
      </div></div>
      <div className="col-md-6"><div className="card card-body h-100">
        <h2>Minhas capacitações</h2>
        {ck.length ? ck.map(c => (
          <div className="ag" key={c.id} onClick={() => go('capacitacoes')}>
            <span className={chip()}>{TIPO[c.tipo]}</span>
            <div><b>{c.titulo}</b><small>{c.sala} · {c.hora}</small></div>
            <span className={chip()}>{fm(c.data)}</span>
          </div>
        )) : (
          <div>
            <small>Você não está inscrito em nenhuma capacitação futura.</small>
            <div className="mt-2"><button className="btn btn-g btn-sm" onClick={() => go('capacitacoes')}>Ver capacitações</button></div>
          </div>
        )}
      </div></div>
    </>
  )
}

export default function Dashboard() {
  const { D, go, me, nav } = useApp()
  const mine = D.t.filter(t => (t.responsaveis || []).includes(me)), ab = mine.filter(t => t.status != 'concluida')
  const lt = ab.filter(t => d(t.fim) < hj(D)).length, cap = D.k.filter(c => c.inscritos.includes(me) && c.data >= D.c.hoje).length
  return (
    <>
      <section className="hero d-flex flex-wrap justify-content-between align-items-center gap-4">
        <div>
          <h1>Olá, {un(D, me).split(' ')[0]}.</h1>
          <p>{d(D.c.hoje).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}. Vamos organizar a semana?</p>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button className="btn btn-primary" onClick={() => go('projetos')}>Ver projetos</button>
            <button className="btn btn-ol" onClick={() => go('checkins')}>Fazer check-in</button>
          </div>
        </div>
        <div className="hs d-flex flex-wrap gap-3">
          {[[ab.length, 'tarefas abertas'], [lt, 'atrasadas'], [cap, 'capacitações a caminho']].map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}
        </div>
      </section>

      <div className="row g-3 mb-3">
        <div className="col-lg-8"><div className="card card-body h-100">
          <h2>Burndown de tarefas</h2>
          {D.t.length ? <Burn D={D} /> : <small>Você ainda não tem tarefas atribuídas.</small>}
        </div></div>
        <div className="col-lg-4"><div className="card card-body h-100">
          <h2>Resumo das minhas tarefas</h2>
          {mine.length ? <>
            {Object.keys(ST).map(k => {
              const n = mine.filter(t => t.status == k).length
              return <div key={k}><div className="d-flex justify-content-between"><span>{ST[k]}</span><b>{n}</b></div><Prog v={n / mine.length * 100} /></div>
            })}
            <small>{mine.length} {mine.length == 1 ? 'tarefa atribuída' : 'tarefas atribuídas'} a você</small>
          </> : <small>Você não tem tarefas atribuídas.</small>}
        </div></div>
      </div>

      <div className="row g-3 mb-3"><Agenda D={D} me={me} go={go} /></div>

      <h2>Atalhos</h2>
      <div className="row g-3">
        {nav.slice(1).map(([k, l]) => (
          <div className="col-6 col-md-4 col-xl-3" key={k}>
            <button className="btn btn-g w-100 justify-content-start gap-2 p-3 rounded-4" onClick={() => go(k)}><Ic k={k} />{l}</button>
          </div>
        ))}
      </div>
    </>
  )
}
