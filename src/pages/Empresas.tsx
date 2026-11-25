import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { useYo } from '../session'
import { Btn, Card, Check, Empty, ErrorBox, Icon, PageHeader, Spinner, Tag } from '../ui'
import { FormEmpresa } from './EmpresaDetalle'
import { useCarga } from '../lib'

export default function Empresas() {
  const { esAdmin } = useYo()
  const navigate = useNavigate()
  const [inactivas, setInactivas] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [nueva, setNueva] = useState(false)
  const { datos, error } = useCarga(() => api.empresas(inactivas), [inactivas])

  const q = buscar.trim().toLowerCase()
  const lista = (datos ?? []).filter((e) => !q || `${e.razonSocial} ${e.nombreComercial ?? ''} ${e.ruc}`.toLowerCase().includes(q))

  return (
    <>
      <PageHeader
        kicker="Administración"
        title="Empresas"
        actions={
          esAdmin && (
            <Btn icon="add" onClick={() => setNueva(true)}>
              Nueva empresa
            </Btn>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-1 items-center gap-2 border-b-2 border-ink bg-white px-2">
          <Icon name="search" />
          <input className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Buscar por nombre o RUC" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        {esAdmin && <Check label="Incluir inactivas" checked={inactivas} onChange={setInactivas} />}
      </div>
      <ErrorBox error={error} />
      {!datos && !error && <Spinner />}
      {datos && lista.length === 0 && <Empty icon="apartment" title="No hay empresas" />}
      <div className="grid gap-3">
        {lista.map((e) => (
          <Link key={e.id} to={`/empresas/${e.id}`} className="block">
            <Card className="transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg">
              <div className="flex items-center gap-4">
                {e.logoUrl ? (
                  <img src={e.logoUrl} alt="" className="size-12 border-2 border-ink bg-white object-contain" />
                ) : (
                  <div className="flex size-12 items-center justify-center border-2 border-ink bg-yellow">
                    <Icon name="apartment" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-headline text-lg font-bold uppercase">{e.razonSocial}</p>
                  <p className="text-xs text-muted">
                    RUC {e.ruc} · {[e.ciudad, e.provincia].filter(Boolean).join(', ') || 'Sin ubicación'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Tag>{e.areas.length} áreas</Tag>
                  <Tag>{e.puestos.length} puestos</Tag>
                  {!e.activo && <Tag className="bg-red text-white">Inactiva</Tag>}
                </div>
                <Icon name="chevron_right" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {nueva && <FormEmpresa onClose={() => setNueva(false)} onSaved={(e) => navigate(`/empresas/${e.id}`)} />}
    </>
  )
}
