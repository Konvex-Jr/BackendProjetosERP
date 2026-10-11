import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { chip, fm, nid, prog } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import { Av, PageBar, Prog } from '../components/Ui'
import alerts from '../lib/alerts'

export default function Projetos() {
  const { D, up, form, go } = useApp()
  const [pv, setPv] = useState('grid'), ok = p => p.status == 'concluido'
  const edit = p => form(p ? 'Editar projeto' : 'Novo projeto',
    [{ k: 'nome', l: 'Nome' }, { k: 'descricao', l: 'Descrição' }, { k: 'inicio', l: 'Início', t: 'date' }, { k: 'fim', l: 'Fim', t: 'date' }, { k: 'membros', l: 'Membros', c: D.u.filter(u => u.ativo) }],
    p || { membros: [] },
    o => up('p', a => p ? a.map(x => x.id == p.id ? { ...x, ...o } : x) : [...a, { id: nid(a), status: 'em_execucao', ...o }]))
  const toggle = p => up('p', a => a.map(x => x.id == p.id ? { ...x, status: ok(p) ? 'em_execucao' : 'concluido' } : x))
  const del = async p => {
    const confirmed = await alerts.confirm({ title: 'Excluir projeto?', text: 'Esta ação removerá o projeto e pode afetar suas tarefas.', confirmText: 'Excluir projeto', danger: true })
    if (!confirmed) return
    up('p', a => a.filter(x => x.id != p.id))
  }
  const Ac = ({ p }) => <ActionMenu items={D.priv
    ? [['open', 'Abrir', () => go('projeto', p.id)]]
    : [['open', 'Abrir', () => go('projeto', p.id)], ['edit', 'Editar', () => edit(p)], [ok(p) ? 'undo' : 'check', ok(p) ? 'Reabrir' : 'Concluir', () => toggle(p)], ['trash', 'Excluir', () => del(p), 1]]} />
  const Ch = ({ p }) => <span className={chip(ok(p) ? 'ok' : '')}>{ok(p) ? 'Concluído' : 'Em execução'}</span>
  const cols = [
    { k: 'nome', l: 'Projeto' },
    { k: 'st', l: 'Status', filter: 1, get: p => ok(p) ? 'Concluído' : 'Em execução', render: p => <Ch p={p} /> },
    { k: 'fim', l: 'Período', render: p => fm(p.inicio) + ' a ' + fm(p.fim) },
    { k: 'pr', l: 'Progresso', get: p => prog(D, p), render: p => prog(D, p) + '%' },
    { l: 'Membros', render: p => <Av D={D} ids={p.membros} /> },
    { l: 'Ações', render: p => <Ac p={p} /> }
  ]
  return (
    <>
      <PageBar title="Projetos">
        <button className={'btn btn-g' + (pv == 'grid' ? ' on' : '')} onClick={() => setPv('grid')}>Grid</button>
        <button className={'btn btn-g' + (pv == 'lista' ? ' on' : '')} onClick={() => setPv('lista')}>Linhas</button>
        {!D.priv && <button className="btn btn-primary" onClick={() => edit()}><Ic k="plus" />Novo projeto</button>}
      </PageBar>
      {pv == 'grid'
        ? <div className="row g-3">{D.p.map(p => (
          <div className="col-md-6 col-xl-4" key={p.id}>
            <div className="card card-body pj hoverable h-100" onClick={() => go('projeto', p.id)}>
              <div className="d-flex justify-content-between align-items-center"><Ch p={p} /><Av D={D} ids={p.membros} /></div>
              <h2 className="mt-3">{p.nome}</h2>
              <p className="text-mu m-0">{p.descricao}</p>
              <Prog v={prog(D, p)} />
              <small>{prog(D, p)}% · {fm(p.inicio)} a {fm(p.fim)}</small>
              <span className="cm"><Ac p={p} /></span>
            </div>
          </div>))}
        </div>
        : <Table cols={cols} rows={D.p} />}
    </>
  )
}
