import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { brl, chip } from '../lib/utils'
import Multi from '../components/Multi'
import { PageBar } from '../components/Ui'


export default function Precificacao() {
  const { D } = useApp()

  const senioridades = D?.c?.senioridades ?? {}
  const membros = (D?.u ?? []).filter(
    u => u.ativo && u.senioridade && Object.hasOwn(senioridades, u.senioridade)
  )

  const [selecionados, setSelecionados] = useState([])
  const [horasPorMembro, setHorasPorMembro] = useState({})
  const [valoresHora, setValoresHora] = useState(
    () => D?.c?.valorHora ?? {}
  )
  const [margem, setMargem] = useState(30)
  const [impostos, setImpostos] = useState(10)

  const horas = id => horasPorMembro[id] ?? 40

  const valorHora = usuario =>
    Number(valoresHora?.[usuario.senioridade]) || 0

  const fatorPreco =
    (1 + margem / 100) /
    (1 - Math.min(impostos, 99) / 100)

  const equipe = selecionados
    .map(id => membros.find(u => u.id === id))
    .filter(Boolean)

  const totalHoras = equipe.reduce(
    (total, usuario) => total + horas(usuario.id),
    0
  )

  const custoTotal = equipe.reduce(
    (total, usuario) =>
      total + horas(usuario.id) * valorHora(usuario),
    0
  )

  const precoBase = custoTotal * (1 + margem / 100)
  const precoFinal = custoTotal * fatorPreco

  const limitarValor = (atualizar, maximo = 1e9) => evento => {
    const valor = Number(evento.target.value)

    atualizar(
      Math.min(maximo, Math.max(0, Number.isFinite(valor) ? valor : 0))
    )
  }

  const atualizarHoras = (id, valor) => {
    setHorasPorMembro(atual => ({
      ...atual,
      [id]: valor,
    }))
  }

  const atualizarValorHora = (senioridade, valor) => {
    setValoresHora(atual => ({
      ...atual,
      [senioridade]: valor,
    }))
  }

  return (
    <>
      <PageBar
        title="Simular precificação"
        sub="Escolha diretores, gestores e membros com senioridade cadastrada, defina as horas e calcule o custo por pessoa."
      />

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card card-body">
            <div className="form-label">Equipe da proposta</div>

            <Multi
              opts={membros}
              value={selecionados}
              onChange={setSelecionados}
            />

            {equipe.length > 0 ? (
              <div className="tw mt-3">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      {[
                        'Membro',
                        'Senioridade',
                        'Valor hora (custo)',
                        'Valor hora (venda)',
                        'Horas',
                        'Subtotal (venda)',
                      ].map(titulo => (
                        <th key={titulo} className="n">
                          {titulo}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {equipe.map(usuario => (
                      <tr key={usuario.id}>
                        <td>{usuario.nome}</td>

                        <td>
                          <span className={chip()}>
                            {
                              senioridades[
                              usuario.senioridade
                              ]
                            }
                          </span>
                        </td>

                        <td>{brl(valorHora(usuario))}</td>

                        <td>{brl(valorHora(usuario) * fatorPreco)}</td>

                        <td>
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            aria-label={`Horas de ${usuario.nome}`}
                            value={horas(usuario.id)}
                            onChange={evento =>
                              atualizarHoras(
                                usuario.id,
                                Math.max(0, Number(evento.target.value) || 0)
                              )
                            }
                          />
                        </td>

                        <td>
                          <b>
                            {brl(
                              horas(usuario.id) *
                              valorHora(usuario) *
                              fatorPreco
                            )}
                          </b>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td colSpan="4">
                        <b>Total</b>
                      </td>
                      <td>
                        <b>{totalHoras} h</b>
                      </td>
                      <td>
                        <b>{brl(precoFinal)}</b>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="mt-3 mb-0">
                <small>Selecione ao menos um membro para simular.</small>
              </p>
            )}
          </div>
        </div>

        <div className="col-lg-4 d-flex flex-column gap-3">
          <div className="card card-body">
            <h2>Parâmetros</h2>

            {Object.entries(senioridades).map(([chave, nome]) => (
              <label
                className="form-label w-100 mb-3"
                key={chave}
              >
                Valor hora {nome} (R$)

                <input
                  className="form-control mt-1"
                  type="number"
                  min="0"
                  value={valoresHora[chave] ?? 0}
                  onChange={evento =>
                    atualizarValorHora(
                      chave,
                      Math.max(0, Number(evento.target.value) || 0)
                    )
                  }
                />
              </label>
            ))}

            <label className="form-label w-100 mb-3">
              Margem (%)

              <input
                className="form-control mt-1"
                type="number"
                min="0"
                value={margem}
                onChange={limitarValor(setMargem)}
              />
            </label>

            <label className="form-label w-100 m-0">
              Impostos (%)

              <input
                className="form-control mt-1"
                type="number"
                min="0"
                max="99"
                value={impostos}
                onChange={limitarValor(setImpostos, 99)}
              />
            </label>
          </div>

          <div className="card card-body">
            <h2>Resultado</h2>

            <div className="pl">
              <span>Horas totais</span>
              <b>{totalHoras} h</b>
            </div>

            <div className="pl">
              <span>Custo da equipe</span>
              <b>{brl(custoTotal)}</b>
            </div>

            <div className="pl">
              <span>Margem ({margem}%)</span>
              <b>{brl(precoBase - custoTotal)}</b>
            </div>

            <div className="pl">
              <span>Impostos ({impostos}%)</span>
              <b>{brl(precoFinal - precoBase)}</b>
            </div>

            <div className="pv mt-3 mb-1">
              <small>Preço final da proposta</small>
              <b>{brl(precoFinal)}</b>
            </div>

            <small>
              Valor hora médio de venda:{' '}
              {brl(totalHoras ? precoFinal / totalHoras : 0)}
            </small>
          </div>
        </div>
      </div>
    </>
  )
}