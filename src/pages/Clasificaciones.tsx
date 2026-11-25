import { useState } from 'react'
import { api, type Clasificacion, type TipoReporte } from '../api'
import { Btn, Card, Empty, ErrorBox, Field, Icon, Modal, PageHeader, Select, Spinner, Tag, TextArea } from '../ui'
import { toast, useCarga } from '../lib'

const TIPOS: { tipo: TipoReporte; titulo: string }[] = [
  { tipo: 'acto', titulo: 'Actos subestándar' },
  { tipo: 'condicion', titulo: 'Condiciones subestándar' },
]

function FormClasificacion({ c, tipo, onClose, onSaved }: { c?: Clasificacion; tipo: TipoReporte; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ tipo: c?.tipo ?? tipo, nombre: c?.nombre ?? '', medida: c?.medida ?? '', orden: String(c?.orden ?? 0), activo: c?.activo ?? true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const guardar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setBusy(true)
    const datos = { ...f, nombre: f.nombre.trim(), medida: f.medida.trim() || undefined, orden: Number(f.orden) || 0 }
    try {
      if (c) await api.actualizarClasificacion(c.id, datos)
      else await api.crearClasificacion(datos)
      toast.ok('Clasificación guardada')
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }
  return (
    <Modal title={c ? 'Editar clasificación' : 'Nueva clasificación'} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <Select label="Tipo" value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value as TipoReporte }))}>
          <option value="acto">Acto subestándar</option>
          <option value="condicion">Condición subestándar</option>
        </Select>
        <Field label="Nombre *" required maxLength={80} value={f.nombre} onChange={(e) => setF((x) => ({ ...x, nombre: e.target.value }))} />
        <TextArea label="Medida sugerida" hint="La IA la propone como acción inmediata" value={f.medida} onChange={(e) => setF((x) => ({ ...x, medida: e.target.value }))} />
        <Field label="Orden" type="number" value={f.orden} onChange={(e) => setF((x) => ({ ...x, orden: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-ink" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} />
          Activa (disponible en la app y para la IA)
        </label>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <Btn type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn type="submit" busy={busy} icon="save">
            Guardar
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

export default function Clasificaciones() {
  const { datos, error, recargar } = useCarga(() => api.clasificaciones(), [])
  const [editar, setEditar] = useState<{ c?: Clasificacion; tipo: TipoReporte } | null>(null)

  const eliminar = async (c: Clasificacion) => {
    if (!window.confirm(`¿Eliminar "${c.nombre}"?`)) return
    try {
      await api.eliminarClasificacion(c.id)
      toast.ok('Clasificación eliminada')
      recargar()
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <PageHeader kicker="Catálogo global" title="Clasificaciones" />
      <p className="mb-6 text-sm text-muted">Catálogo de clasificaciones inmediatas para los reportes de actos y condiciones. Es común a todas las empresas: la IA solo elige entre las activas.</p>
      <ErrorBox error={error} />
      {!datos && !error && <Spinner />}
      {datos && (
        <div className="grid gap-6 lg:grid-cols-2">
          {TIPOS.map(({ tipo, titulo }) => {
            const lista = datos.filter((c) => c.tipo === tipo).sort((a, b) => a.orden - b.orden)
            return (
              <Card
                key={tipo}
                title={`${titulo} (${lista.length})`}
                icon={tipo === 'acto' ? 'directions_walk' : 'construction'}
                actions={
                  <Btn icon="add" className="!px-2 !py-1 !text-xs" onClick={() => setEditar({ tipo })}>
                    Nueva
                  </Btn>
                }
              >
                {lista.length === 0 ? (
                  <Empty title="Sin clasificaciones" />
                ) : (
                  <ul className="divide-y-2 divide-paper-high">
                    {lista.map((c) => (
                      <li key={c.id} className="flex items-start gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{c.nombre}</p>
                          {c.medida && <p className="text-xs text-muted">{c.medida}</p>}
                        </div>
                        {!c.activo && <Tag className="bg-red text-white">Inactiva</Tag>}
                        <button title="Editar" className="hover:text-blue" onClick={() => setEditar({ c, tipo })}>
                          <Icon name="edit" />
                        </button>
                        <button title="Eliminar" className="hover:text-red" onClick={() => eliminar(c)}>
                          <Icon name="delete" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {editar && <FormClasificacion c={editar.c} tipo={editar.tipo} onClose={() => setEditar(null)} onSaved={recargar} />}
    </>
  )
}
