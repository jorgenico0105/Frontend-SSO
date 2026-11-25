import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, type ItemArchivo, type NivelRiesgo, type TipoArchivo } from '../api'
import { useYo } from '../session'
import { Card, Empty, ErrorBox, Icon, MatrizTag, PageHeader, RiskTag, Select, Spinner, Tag } from '../ui'
import { cx, TIPO, fecha, useCarga } from '../lib'

const ESTADO: Record<string, string> = {
  BORRADOR: 'Borrador',
  COMPLETA: 'Completa',
  REGISTRADO: 'Registrado',
  ANALIZADO: 'Analizado',
  PROCESANDO: 'Procesando',
  PENDIENTE: 'Pendiente',
  AUTORIZADO: 'Autorizado',
  CERRADO: 'Cerrado',
}

const claveMes = (iso: string) => iso.slice(0, 7)
const nombreMes = (clave: string) => new Date(`${clave}-15T12:00:00`).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })

function Nivel({ item }: { item: ItemArchivo }) {
  if (!item.nivel) return null
  if (item.tipo === 'reporte') return <RiskTag nivel={item.nivel as NivelRiesgo} />
  if (item.tipo === 'matriz') return <MatrizTag nivel={item.nivel} />
  if (item.tipo === 'ergo') return <Tag>REBA {item.nivel}</Tag>
  if (item.tipo === 'accidente') return <Tag className={item.nivel === 'incidente' ? 'bg-yellow' : 'bg-red text-white'}>{item.nivel === 'incidente' ? 'Incidente' : 'Accidente'}</Tag>
  return null
}

export default function ArchivoEmpresa() {
  const empresaId = Number(useParams().empresaId)
  const { gestor } = useYo()
  const empresa = useCarga(() => api.empresa(empresaId), [empresaId])
  const { datos, error } = useCarga(() => api.archivo(empresaId), [empresaId])
  const [tipo, setTipo] = useState<TipoArchivo | ''>('')
  const [mes, setMes] = useState('')
  const [autor, setAutor] = useState('')
  const [buscar, setBuscar] = useState('')

  const lista = useMemo(() => datos ?? [], [datos])
  const meses = useMemo(() => [...new Set(lista.map((i) => claveMes(i.fecha)))], [lista])
  const autores = useMemo(() => [...new Set(lista.map((i) => i.autor).filter((a): a is string => !!a))].sort(), [lista])
  const tipos = useMemo(() => [...new Set(lista.map((i) => i.tipo))], [lista])

  const q = buscar.trim().toLowerCase()
  const filtrada = lista.filter(
    (i) =>
      (!tipo || i.tipo === tipo) &&
      (!mes || claveMes(i.fecha) === mes) &&
      (!autor || i.autor === autor) &&
      (!q || `${i.codigo ?? ''} ${i.titulo} ${i.detalle} ${i.area ?? ''}`.toLowerCase().includes(q)),
  )
  const grupos = new Map<string, ItemArchivo[]>()
  for (const i of filtrada) grupos.set(claveMes(i.fecha), [...(grupos.get(claveMes(i.fecha)) ?? []), i])

  return (
    <>
      <Link to="/archivo" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline">
        <Icon name="arrow_back" /> Archivo
      </Link>
      <PageHeader kicker="Archivo" title={empresa.datos?.nombreComercial || empresa.datos?.razonSocial || '…'} />
      <ErrorBox error={error ?? empresa.error} />
      {!datos && !error && <Spinner />}
      {datos && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {(Object.keys(TIPO) as TipoArchivo[]).map((t) => {
              const n = lista.filter((i) => i.tipo === t).length
              const activo = tipo === t
              return (
                <button
                  key={t}
                  disabled={!tipos.includes(t)}
                  onClick={() => setTipo(activo ? '' : t)}
                  className={cx('flex items-center gap-3 border-2 border-ink p-3 text-left shadow-hard-sm disabled:opacity-40', activo ? 'bg-yellow' : 'bg-white hover:bg-paper-bright')}
                >
                  <Icon name={TIPO[t].icon} className="text-[28px]" />
                  <span>
                    <span className="block font-headline text-2xl leading-none font-bold">{n}</span>
                    <span className="font-headline text-[10px] font-bold tracking-widest uppercase">{TIPO[t].label}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className={cx('mb-6 grid gap-4', gestor ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
            <div className="flex items-end gap-2 border-b-2 border-ink bg-white px-2">
              <Icon name="search" className="mb-2" />
              <input className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Código, puesto, área, descripción…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            </div>
            <Select label="Mes" value={mes} onChange={(e) => setMes(e.target.value)}>
              <option value="">Todo el historial</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {nombreMes(m)}
                </option>
              ))}
            </Select>
            {gestor && (
              <Select label="Registrado por" value={autor} onChange={(e) => setAutor(e.target.value)}>
                <option value="">Todos</option>
                {autores.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            )}
          </div>

          {filtrada.length === 0 && (
            <Empty icon="folder_off" title={lista.length ? 'Nada coincide con los filtros' : 'La carpeta está vacía'}>
              {!lista.length && (gestor ? 'Los registros que hagan los técnicos desde la app aparecerán aquí.' : 'Lo que registres desde la app aparecerá aquí.')}
            </Empty>
          )}

          <div className="space-y-6">
            {[...grupos].map(([m, items]) => (
              <Card key={m} title={`${nombreMes(m)} · ${items.length}`} icon="calendar_month">
                <ul className="divide-y-2 divide-paper-high">
                  {items.map((i) => (
                    <li key={`${i.tipo}-${i.id}`}>
                      <Link to={`/archivo/${empresaId}/${i.tipo}/${i.id}`} className="flex items-center gap-3 py-3 hover:bg-paper-bright">
                        <span className={cx('flex size-10 shrink-0 items-center justify-center border-2 border-ink', TIPO[i.tipo].css)}>
                          <Icon name={TIPO[i.tipo].icon} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">
                            {i.codigo && <span className="mr-2 font-headline text-xs font-bold text-muted">{i.codigo}</span>}
                            {i.titulo}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {[fecha(i.fecha, true), i.area, i.autor, i.detalle].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <Nivel item={i} />
                        <Tag>{ESTADO[i.estado] ?? i.estado}</Tag>
                        <Icon name="chevron_right" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}
