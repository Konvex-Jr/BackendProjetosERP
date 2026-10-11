import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { fm, nid, sz, un } from '../lib/utils'
import Ic from '../components/Icon'
import ActionMenu from '../components/ActionMenu'
import Table from '../components/Table'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'

export default function Gestao() {
  const { D, up, form, me, uploadDocument, downloadDocument } = useApp()
  const fileInput = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [pid, setPid] = useState(null), pa = D.g.find(x => x.id == pid), cnt = id => D.d.filter(x => x.pastaId == id).length

  const nova = f => form(f ? 'Renomear pasta' : 'Nova pasta', [{ k: 'nome', l: 'Nome da pasta' }], f ? { nome: f.nome } : {}, o => up('g', a => f ? a.map(x => x.id == f.id ? { ...x, nome: o.nome } : x) : [...a, { id: nid(a), ...o }]))
  const delP = async folder => {
    const confirmed = await alerts.confirm({ title: 'Excluir pasta?', text: `A pasta e seus ${cnt(folder.id)} documento(s) serão excluídos.`, confirmText: 'Excluir pasta', danger: true })
    if (confirmed) up('g', folders => folders.filter(item => item.id != folder.id))
  }
  const add = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !pid) return
    setUploading(true)
    try {
      await uploadDocument(pid, file)
      await alerts.toastSuccess('Documento enviado', `${file.name} foi salvo na pasta.`)
    } catch (error) {
      await alerts.error('Não foi possível enviar o documento', error.message)
    } finally {
      setUploading(false)
    }
  }
  const ren = x => form('Renomear documento', [{ k: 'nome', l: 'Nome' }], { nome: x.nome }, o => up('d', a => a.map(y => y.id == x.id ? { ...y, nome: o.nome } : y)))
  const bx = async x => { try { await downloadDocument(x.url) } catch (error) { await alerts.error('Não foi possível baixar o documento', error.message) } }
  const delD = async document => {
    const confirmed = await alerts.confirm({ title: 'Excluir documento?', text: document.nome, confirmText: 'Excluir documento', danger: true })
    if (confirmed) up('d', documents => documents.filter(item => item.id != document.id))
  }

  if (!pa) return (
    <>
      <PageBar title="Gestão" sub="Documentos da empresa, organizados por pasta."><button className="btn btn-primary" onClick={() => nova()}><Ic k="plus" />Nova pasta</button></PageBar>
      <div className="row g-3">
        {D.g.map(f => (
          <div className="col-sm-6 col-xl-4" key={f.id}>
            <div className="fc" onClick={() => setPid(f.id)}>
              <span className="fi"><Ic k="gestao" /></span>
              <div><b>{f.nome}</b><small>{cnt(f.id)} documento{cnt(f.id) == 1 ? '' : 's'}</small></div>
              <ActionMenu items={[['open', 'Abrir', () => setPid(f.id)], ['edit', 'Renomear', () => nova(f)], ['trash', 'Excluir', () => delP(f), 1]]} />
            </div>
          </div>
        ))}
      </div>
      {!D.g.length && <div className="card card-body">Nenhuma pasta ainda. Use “Nova pasta”.</div>}
    </>
  )

  const L = D.d.filter(x => x.pastaId == pid)
  const cols = [
    { k: 'nome', l: 'Documento', render: x => <span className="fn"><Ic k="file" />{x.nome}</span> },
    { k: 'ext', l: 'Tipo', filter: 1 },
    { k: 'tam', l: 'Tamanho', render: x => sz(x.tam) },
    { k: 'autor', l: 'Enviado por', filter: 1 },
    { k: 'data', l: 'Data', render: x => fm(x.data) },
    { l: 'Ações', render: x => <ActionMenu items={[['download', 'Baixar', () => bx(x)], ['edit', 'Renomear', () => ren(x)], ['trash', 'Excluir', () => delD(x), 1]]} /> }
  ]
  return (
    <div className="dw">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="d-flex align-items-center gap-2"><button className="btn btn-g" onClick={() => setPid(null)}><Ic k="back" />Voltar</button><h1>{pa.nome}</h1></div>
        <input ref={fileInput} type="file" hidden onChange={add} />
        <button className="btn btn-primary" disabled={uploading} onClick={() => fileInput.current?.click()}><Ic k="upload" />{uploading ? 'Enviando…' : 'Adicionar documento'}</button>
      </div>
      {L.length ? <Table cols={cols} rows={L} /> : <div className="dz"><Ic k="upload" /><b>Nenhum documento nesta pasta</b><small>Selecione um arquivo para enviá-lo ao servidor (máximo de 20 MB).</small></div>}
    </div>
  )
}
