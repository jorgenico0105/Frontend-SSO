import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, nombre, type Area, type AreaInput, type Empresa, type EmpresaInput, type NivelRiesgo, type Puesto, type PuestoInput } from '../api'
import { useYo } from '../session'
import { Btn, Card, Empty, ErrorBox, Field, Icon, Modal, PageHeader, RiskTag, Select, Spinner, Tag, TextArea } from '../ui'
import { toast, useCarga } from '../lib'

const NIVELES: { value: NivelRiesgo; label: string }[] = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
  { value: 'critico', label: 'Crítico' },
]

/** Texto vacío → null, para que el backend no valide como correo/cédula un campo opcional vacío. */
const limpio = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' && !v.trim() ? null : typeof v === 'string' ? v.trim() : v])) as T

type CampoEmpresa = { k: keyof EmpresaInput; label: string; tipo?: string; req?: boolean; hint?: string }
const GRUPOS: { titulo: string; campos: CampoEmpresa[] }[] = [
  {
    titulo: 'Datos generales',
    campos: [
      { k: 'razonSocial', label: 'Razón social *', req: true },
      { k: 'nombreComercial', label: 'Nombre comercial' },
      { k: 'ruc', label: 'RUC *', req: true, hint: '13 dígitos' },
      { k: 'actividadEconomica', label: 'Actividad económica' },
      { k: 'sector', label: 'Sector' },
      { k: 'numeroEmpleados', label: 'Número de empleados', tipo: 'number' },
    ],
  },
  {
    titulo: 'Ubicación y contacto',
    campos: [
      { k: 'pais', label: 'País' },
      { k: 'provincia', label: 'Provincia' },
      { k: 'ciudad', label: 'Ciudad' },
      { k: 'direccion', label: 'Dirección' },
      { k: 'telefono', label: 'Teléfono' },
      { k: 'email', label: 'Correo', tipo: 'email' },
    ],
  },
  {
    titulo: 'Representante legal',
    campos: [
      { k: 'representanteLegalNombre', label: 'Nombre *', req: true },
      { k: 'representanteLegalCedula', label: 'Cédula *', req: true, hint: '10 dígitos' },
      { k: 'representanteLegalCargo', label: 'Cargo' },
      { k: 'representanteLegalEmail', label: 'Correo', tipo: 'email' },
      { k: 'representanteLegalTelefono', label: 'Teléfono' },
    ],
  },
  {
    titulo: 'Responsable de SST',
    campos: [
      { k: 'responsableSstNombre', label: 'Nombre' },
      { k: 'responsableSstCedula', label: 'Cédula', hint: '10 dígitos' },
      { k: 'responsableSstEmail', label: 'Correo', tipo: 'email' },
      { k: 'responsableSstTelefono', label: 'Teléfono' },
    ],
  },
  {
    titulo: 'Indicadores',
    campos: [
      { k: 'fechaUltimoAccidente', label: 'Fecha del último accidente', tipo: 'date' },
      { k: 'metaDiasSinAccidentes', label: 'Meta de días sin accidentes', tipo: 'number' },
    ],
  },
]

/** Crear (sin `empresa`) o editar los datos de una empresa. */
export function FormEmpresa({ empresa, onClose, onSaved }: { empresa?: Empresa; onClose: () => void; onSaved: (e: Empresa) => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = { pais: 'Ecuador' }
    for (const g of GRUPOS) for (const c of g.campos) if (empresa?.[c.k] != null) f[c.k] = String(empresa[c.k])
    return f
  })
  const [nivel, setNivel] = useState<NivelRiesgo>(empresa?.nivelRiesgo ?? 'medio')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const guardar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const datos: Record<string, unknown> = { ...form, nivelRiesgo: nivel }
    for (const k of ['numeroEmpleados', 'metaDiasSinAccidentes']) datos[k] = form[k] ? Number(form[k]) : undefined
    try {
      const r = empresa ? await api.actualizarEmpresa(empresa.id, limpio(datos) as EmpresaInput) : await api.crearEmpresa(limpio(datos) as EmpresaInput)
      toast.ok(empresa ? 'Empresa actualizada' : 'Empresa creada')
      onSaved(r)
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal title={empresa ? 'Editar empresa' : 'Nueva empresa'} onClose={onClose} wide>
      <form onSubmit={guardar} className="space-y-6">
        {GRUPOS.map((g) => (
          <fieldset key={g.titulo}>
            <legend className="mb-2 font-headline text-sm font-bold tracking-widest uppercase">{g.titulo}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.campos.map((c) => (
                <Field key={c.k} label={c.label} hint={c.hint} type={c.tipo ?? 'text'} required={c.req} value={form[c.k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))} />
              ))}
              {g.titulo === 'Datos generales' && (
                <Select label="Nivel de riesgo" value={nivel} onChange={(e) => setNivel(e.target.value as NivelRiesgo)}>
                  {NIVELES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </fieldset>
        ))}
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

function FormArea({ empresaId, area, onClose, onSaved }: { empresaId: number; area?: Area; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<AreaInput>({
    nombre: area?.nombre ?? '',
    descripcion: area?.descripcion ?? '',
    ubicacion: area?.ubicacion ?? '',
    responsable: area?.responsable ?? '',
    nivelRiesgo: area?.nivelRiesgo ?? null,
    activo: area?.activo ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const set = (k: keyof AreaInput) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const guardar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setBusy(true)
    try {
      const datos = limpio({ ...f, nivelRiesgo: f.nivelRiesgo || undefined })
      if (area) await api.actualizarArea(empresaId, area.id, datos)
      else await api.crearArea(empresaId, datos)
      toast.ok(area ? 'Área actualizada' : 'Área creada')
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }
  return (
    <Modal title={area ? 'Editar área' : 'Nueva área'} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <Field label="Nombre *" required value={f.nombre ?? ''} onChange={set('nombre')} />
        <Field label="Ubicación" value={f.ubicacion ?? ''} onChange={set('ubicacion')} />
        <Field label="Responsable" value={f.responsable ?? ''} onChange={set('responsable')} />
        <Select label="Nivel de riesgo" value={f.nivelRiesgo ?? ''} onChange={set('nivelRiesgo')}>
          <option value="">Sin definir</option>
          {NIVELES.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </Select>
        <TextArea label="Descripción" value={f.descripcion ?? ''} onChange={set('descripcion')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-ink" checked={!!f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} />
          Área activa (las inactivas no aparecen en la app)
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

function FormPuesto({ empresa, puesto, onClose, onSaved }: { empresa: Empresa; puesto?: Puesto; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    nombre: puesto?.nombre ?? '',
    areaId: puesto?.area?.id ? String(puesto.area.id) : '',
    descripcion: puesto?.descripcion ?? '',
    funciones: puesto?.funciones ?? '',
    cicloTrabajo: puesto?.cicloTrabajo ?? '',
    jornadaHoras: puesto?.jornadaHoras != null ? String(puesto.jornadaHoras) : '',
    numeroTrabajadores: String(puesto?.numeroTrabajadores ?? ''),
    nivelRiesgo: puesto?.nivelRiesgo ?? '',
    epp: puesto?.eppRequerido?.join(', ') ?? '',
    activo: puesto?.activo ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const guardar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setBusy(true)
    const datos: PuestoInput = limpio({
      nombre: f.nombre,
      areaId: f.areaId ? Number(f.areaId) : null,
      descripcion: f.descripcion,
      funciones: f.funciones,
      cicloTrabajo: f.cicloTrabajo,
      jornadaHoras: f.jornadaHoras ? Number(f.jornadaHoras) : undefined,
      numeroTrabajadores: f.numeroTrabajadores ? Number(f.numeroTrabajadores) : undefined,
      nivelRiesgo: (f.nivelRiesgo || undefined) as NivelRiesgo | undefined,
      eppRequerido: f.epp
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      activo: f.activo,
    })
    try {
      if (puesto) await api.actualizarPuesto(empresa.id, puesto.id, datos)
      else await api.crearPuesto(empresa.id, datos)
      toast.ok(puesto ? 'Puesto actualizado' : 'Puesto creado')
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }
  return (
    <Modal title={puesto ? 'Editar puesto' : 'Nuevo puesto'} onClose={onClose} wide>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" required value={f.nombre} onChange={set('nombre')} />
          <Select label="Área" value={f.areaId} onChange={set('areaId')}>
            <option value="">Sin área</option>
            {empresa.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Select>
          <Field label="Jornada (horas/día)" type="number" step="0.5" min="0" value={f.jornadaHoras} onChange={set('jornadaHoras')} />
          <Field label="Número de trabajadores" type="number" min="0" value={f.numeroTrabajadores} onChange={set('numeroTrabajadores')} />
          <Field label="Ciclo de trabajo" value={f.cicloTrabajo} onChange={set('cicloTrabajo')} />
          <Select label="Nivel de riesgo" value={f.nivelRiesgo} onChange={set('nivelRiesgo')}>
            <option value="">Sin definir</option>
            {NIVELES.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </Select>
        </div>
        <Field label="EPP requerido" hint="Separado por comas: casco, guantes, gafas…" value={f.epp} onChange={set('epp')} />
        <TextArea label="Funciones" value={f.funciones} onChange={set('funciones')} />
        <TextArea label="Descripción" value={f.descripcion} onChange={set('descripcion')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-ink" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} />
          Puesto activo
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

const Fila = ({ label, valor }: { label: string; valor: string | number | null | undefined }) => (
  <div>
    <dt className="font-headline text-[10px] font-bold tracking-widest text-muted uppercase">{label}</dt>
    <dd className="text-sm">{valor || '—'}</dd>
  </div>
)

export default function EmpresaDetalle() {
  const id = Number(useParams().id)
  const { esAdmin } = useYo()
  const { datos: e, error, recargar, setDatos } = useCarga(() => api.empresa(id), [id])
  const usuarios = useCarga(() => api.usuarios(), [])
  const [editar, setEditar] = useState(false)
  const [area, setArea] = useState<Area | 'nueva' | null>(null)
  const [puesto, setPuesto] = useState<Puesto | 'nuevo' | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  if (error) return <ErrorBox error={error} />
  if (!e) return <Spinner />

  const miembros = (usuarios.datos ?? []).filter((u) => u.empresas.some((x) => x.id === id))

  const subirLogo = async (archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(true)
    try {
      const { logoUrl } = await api.subirLogo(id, archivo)
      setDatos({ ...e, logoUrl })
      toast.ok('Logo actualizado')
    } catch (err) {
      toast.error(err)
    } finally {
      setSubiendo(false)
    }
  }

  const cambiarEstado = async () => {
    if (e.activo && !window.confirm(`¿Desactivar ${e.razonSocial}? Sus usuarios dejarán de verla en la app.`)) return
    try {
      await api.actualizarEmpresa(id, { activo: !e.activo })
      toast.ok(e.activo ? 'Empresa desactivada' : 'Empresa reactivada')
      recargar()
    } catch (err) {
      toast.error(err)
    }
  }

  const eliminar = async (tipo: 'area' | 'puesto', x: { id: number; nombre: string }) => {
    if (!window.confirm(`¿Eliminar ${tipo === 'area' ? 'el área' : 'el puesto'} "${x.nombre}"? Si tiene registros asociados, mejor desactívalo.`)) return
    try {
      if (tipo === 'area') await api.eliminarArea(id, x.id)
      else await api.eliminarPuesto(id, x.id)
      toast.ok('Eliminado')
      recargar()
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <Link to="/empresas" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline">
        <Icon name="arrow_back" /> Empresas
      </Link>
      <PageHeader
        kicker={`RUC ${e.ruc}`}
        title={e.razonSocial}
        actions={
          <>
            <Link to={`/archivo/${id}`}>
              <Btn variant="ghost" icon="folder_open">
                Archivo
              </Btn>
            </Link>
            <Btn variant="dark" icon="edit" onClick={() => setEditar(true)}>
              Editar datos
            </Btn>
            {esAdmin && (
              <Btn variant={e.activo ? 'danger' : 'primary'} icon={e.activo ? 'block' : 'check'} onClick={cambiarEstado}>
                {e.activo ? 'Desactivar' : 'Reactivar'}
              </Btn>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Logo" icon="image">
          <div className="flex flex-col items-center gap-3">
            {e.logoUrl ? <img src={e.logoUrl} alt="Logo" className="h-32 w-full border-2 border-ink bg-white object-contain p-2" /> : <Empty icon="image" title="Sin logo" />}
            <label className="w-full">
              <input type="file" accept="image/*" className="hidden" onChange={(ev) => subirLogo(ev.target.files?.[0])} />
              <span className="flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-ink bg-yellow px-4 py-2 font-headline text-sm font-bold tracking-wider uppercase shadow-hard-sm hover:bg-ink hover:text-yellow">
                <Icon name={subiendo ? 'progress_activity' : 'upload'} className={subiendo ? 'animate-spin' : ''} />
                {subiendo ? 'Subiendo…' : 'Cambiar logo'}
              </span>
            </label>
            <p className="text-center text-xs text-muted">Aparece en los PDF que genera la app. Máximo 5 MB.</p>
          </div>
        </Card>
        <Card title="Datos de la empresa" icon="apartment" actions={!e.activo && <Tag className="bg-red text-white">Inactiva</Tag>}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Fila label="Nombre comercial" valor={e.nombreComercial} />
            <Fila label="Actividad" valor={e.actividadEconomica} />
            <div>
              <dt className="font-headline text-[10px] font-bold tracking-widest text-muted uppercase">Nivel de riesgo</dt>
              <dd className="mt-1">
                <RiskTag nivel={e.nivelRiesgo} />
              </dd>
            </div>
            <Fila label="Ubicación" valor={[e.ciudad, e.provincia, e.pais].filter(Boolean).join(', ')} />
            <Fila label="Teléfono" valor={e.telefono} />
            <Fila label="Empleados" valor={e.numeroEmpleados} />
            <Fila label="Representante legal" valor={e.representanteLegalNombre} />
            <Fila label="Responsable SST" valor={e.responsableSstNombre} />
            <Fila label="Último accidente" valor={e.fechaUltimoAccidente} />
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title={`Áreas (${e.areas.length})`}
          icon="grid_view"
          actions={
            <Btn icon="add" className="!px-2 !py-1 !text-xs" onClick={() => setArea('nueva')}>
              Área
            </Btn>
          }
        >
          {e.areas.length === 0 ? (
            <Empty icon="grid_view" title="Sin áreas" />
          ) : (
            <ul className="divide-y-2 divide-paper-high">
              {e.areas.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.nombre}</p>
                    <p className="text-xs text-muted">{[a.ubicacion, a.responsable].filter(Boolean).join(' · ') || 'Sin detalles'}</p>
                  </div>
                  {a.nivelRiesgo && <RiskTag nivel={a.nivelRiesgo} />}
                  {!a.activo && <Tag className="bg-red text-white">Inactiva</Tag>}
                  <button title="Editar" className="hover:text-blue" onClick={() => setArea(a)}>
                    <Icon name="edit" />
                  </button>
                  <button title="Eliminar" className="hover:text-red" onClick={() => eliminar('area', a)}>
                    <Icon name="delete" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title={`Puestos (${e.puestos.length})`}
          icon="engineering"
          actions={
            <Btn icon="add" className="!px-2 !py-1 !text-xs" onClick={() => setPuesto('nuevo')}>
              Puesto
            </Btn>
          }
        >
          {e.puestos.length === 0 ? (
            <Empty icon="engineering" title="Sin puestos" />
          ) : (
            <ul className="divide-y-2 divide-paper-high">
              {e.puestos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-xs text-muted">
                      {p.area?.nombre ?? 'Sin área'} · {p.numeroTrabajadores} trabajadores{p.jornadaHoras ? ` · ${p.jornadaHoras} h/día` : ''}
                    </p>
                  </div>
                  {!p.activo && <Tag className="bg-red text-white">Inactivo</Tag>}
                  <button title="Editar" className="hover:text-blue" onClick={() => setPuesto(p)}>
                    <Icon name="edit" />
                  </button>
                  <button title="Eliminar" className="hover:text-red" onClick={() => eliminar('puesto', p)}>
                    <Icon name="delete" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        className="mt-6"
        title={`Usuarios con acceso (${miembros.length})`}
        icon="group"
        actions={
          <Link to={`/usuarios/nuevo?empresa=${id}`}>
            <Btn icon="person_add" className="!px-2 !py-1 !text-xs">
              Usuario
            </Btn>
          </Link>
        }
      >
        {usuarios.error ? (
          <ErrorBox error={usuarios.error} />
        ) : miembros.length === 0 ? (
          <Empty icon="group" title="Nadie tiene acceso todavía" />
        ) : (
          <ul className="divide-y-2 divide-paper-high">
            {miembros.map((u) => (
              <li key={u.id}>
                <Link to={`/usuarios/${u.id}`} className="flex items-center gap-3 py-2 hover:bg-paper-bright">
                  <Icon name="person" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{nombre(u)}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </div>
                  <Tag className={u.perfil === 'ADMIN_EMPRESA' ? 'bg-blue text-white' : 'bg-paper-high'}>{u.perfil === 'ADMIN_EMPRESA' ? 'Admin. empresa' : 'Técnico'}</Tag>
                  {!u.activo && <Tag className="bg-red text-white">Inactivo</Tag>}
                  <Icon name="chevron_right" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editar && <FormEmpresa empresa={e} onClose={() => setEditar(false)} onSaved={() => recargar()} />}
      {area && <FormArea empresaId={id} area={area === 'nueva' ? undefined : area} onClose={() => setArea(null)} onSaved={recargar} />}
      {puesto && <FormPuesto empresa={e} puesto={puesto === 'nuevo' ? undefined : puesto} onClose={() => setPuesto(null)} onSaved={recargar} />}
    </>
  )
}
