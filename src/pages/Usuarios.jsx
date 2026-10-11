import { useApp } from '../context/AppContext'
import { chip, nid } from '../lib/utils'
import Ic from '../components/Icon'
import Table from '../components/Table'
import { PageBar } from '../components/Ui'
import alerts from '../lib/alerts'
import { normalizeSenioridades, slug } from '../lib/apiMappers'

const PERFIS_PADRAO = ['diretor', 'gerente', 'membro']

export default function Usuarios() {
  const { D, up, form } = useApp()

  const perfis = D?.c?.perfis ?? PERFIS_PADRAO
  // A lista vem exclusivamente de GET /senioridades; nunca inventar opções locais.
  const senioridadesApi = normalizeSenioridades(D?.senioridades ?? [])
  const senioridades = Object.fromEntries(senioridadesApi.map(item => [slug(item.codigo), item.nome]))
  const primeiraSenioridade = senioridadesApi[0]?.codigo ?? ''
  const usuarios = D?.u ?? []

  const editar = usuario =>
    form(
      usuario ? 'Editar usuário' : 'Novo usuário',
      [
        { k: 'nome', l: 'Nome' },
        { k: 'email', l: 'E-mail', t: 'email' },
        {
          k: 'senha',
          l: 'Senha inicial',
          t: 'password',
          s: () => !usuario,
        },
        {
          k: 'perfil',
          l: 'Perfil',
          o: perfis.map(perfil => [perfil, perfil]),
        },
        {
          k: 'senioridade',
          l: 'Senioridade',
          o: senioridadesApi.map(item => [slug(item.codigo), item.nome]),
          disabled: senioridadesApi.length === 0,
          s: () => true,
        },
      ],
      usuario || {
        perfil: 'membro',
        senioridade: primeiraSenioridade,
      },
      valores => {
        if (senioridadesApi.length === 0) {
          alerts.error('Senioridades indisponíveis', 'A API não retornou senioridades cadastradas. Cadastre uma senioridade no banco de dados e tente novamente.')
          return false
        }
        const dados = {
          ...valores,
          senioridade: valores.senioridade || primeiraSenioridade,
        }

        up('u', atuais =>
          usuario
            ? atuais.map(item =>
              item.id === usuario.id
                ? { ...item, ...dados }
                : item
            )
            : [
              ...atuais,
              {
                id: nid(atuais),
                ativo: true,
                ...dados,
              },
            ]
        )
      }
    )

  const alterarStatus = async (usuario, alteracoes) => {
    if (senioridadesApi.length === 0) {
      await alerts.error('Senioridades indisponíveis', 'Não é possível atribuir o perfil de membro enquanto a API não retornar senioridades cadastradas no banco de dados.')
      return
    }

    if (alteracoes.ativo === false && usuario.ativo) {
      const confirmado = await alerts.confirm({
        title: 'Inativar usuário?',
        text: `${usuario.nome} perderá o acesso ao sistema.`,
        confirmText: 'Inativar',
        danger: true,
      })

      if (!confirmado) return
    }

    if (alteracoes.ativo === true && !usuario.ativo) {
      await alerts.info(
        'Reativação indisponível',
        'A API atual não disponibiliza uma rota para reativar usuários inativos.'
      )
      return
    }

    const alteracoesFinais =
      !('senioridade' in alteracoes) && !usuario.senioridade && primeiraSenioridade
        ? { ...alteracoes, senioridade: primeiraSenioridade }
        : alteracoes

    up('u', atuais =>
      atuais.map(item =>
        item.id === usuario.id
          ? { ...item, ...alteracoesFinais }
          : item
      )
    )
  }

  const colunas = [
    {
      k: 'nome',
      l: 'Nome',
    },
    {
      k: 'email',
      l: 'E-mail',
    },
    {
      k: 'perfil',
      l: 'Perfil',
      filter: 1,
      render: usuario => (
        <select
          className="form-select form-select-sm auto"
          aria-label={`Perfil de ${usuario.nome}`}
          value={usuario.perfil}
          onChange={evento =>
            alterarStatus(usuario, {
              perfil: evento.target.value,
            })
          }
        >
          {perfis.map(perfil => (
            <option key={perfil} value={perfil}>
              {perfil}
            </option>
          ))}
        </select>
      ),
    },
    {
      k: 'sn',
      l: 'Senioridade',
      filter: 1,
      get: usuario =>
        senioridades[usuario.senioridade] || '—',
      render: usuario =>
        (
          <select
            className="form-select form-select-sm auto"
            aria-label={`Senioridade de ${usuario.nome}`}
            value={usuario.senioridade || primeiraSenioridade}
            onChange={evento =>
              alterarStatus(usuario, {
                senioridade: evento.target.value,
              })
            }
          >
            {senioridadesApi.map(item => (
              <option key={item.codigo} value={slug(item.codigo)}>
                {item.nome}
              </option>
            ))}
          </select>
        ),
    },
    {
      k: 'st',
      l: 'Status',
      filter: 1,
      get: usuario => (usuario.ativo ? 'Ativo' : 'Inativo'),
      render: usuario => (
        <span className={chip(usuario.ativo ? 'ok' : 'er')}>
          {usuario.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      l: 'Ações',
      render: usuario => (
        <div className="d-flex gap-2">
          <button
            className="btn btn-g btn-sm"
            onClick={() => editar(usuario)}
          >
            Editar
          </button>

          {usuario.ativo && (
            <button
              className="btn btn-g btn-sm"
              onClick={() =>
                alterarStatus(usuario, { ativo: false })
              }
            >
              Inativar
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageBar title="Usuários">
        <button
          className="btn btn-primary"
          onClick={() => editar()}
        >
          <Ic k="plus" />
          Novo usuário
        </button>
      </PageBar>

      <Table cols={colunas} rows={usuarios} />
    </>
  )
}