import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { api, type Actividad, type ActividadInput, type Empresa, type EstadoActividad, type NotaDia, type TipoActividad } from '../api'
import { Btn, Card, ErrorBox, Field, Icon, Modal, PageHeader, Select, Spinner, Tag, TextArea } from '../ui'
import { cx, DIAS_CORTOS, diaLargo, hora, hoyIso, isoDia, leerDia, lunes, MESES, minutos, sumarDias, toast, useCarga } from '../lib'

/* ------------------------------- Catálogos ------------------------------- */

const TIPOS_ACTIVIDAD: Record<TipoActividad, { label: string; icon: string; css: string }> = {
  auditoria: { label: 'Auditoría', icon: 'fact_check', css: 'bg-red text-white' },
  inspeccion: { label: 'Inspección', icon: 'search', css: 'bg-yellow' },
  capacitacion: { label: 'Capacitación', icon: 'school', css: 'bg-blue text-white' },
  reunion: { label: 'Reunión', icon: 'groups', css: 'bg-ink text-white' },
  visita: { label: 'Visita', icon: 'directions_car', css: 'bg-blue-soft' },
  informe: { label: 'Informe', icon: 'description', css: 'bg-paper-high' },
  otro: { label: 'Otro', icon: 'event', css: 'bg-white' },
}

const ESTADOS: Record<EstadoActividad, { label: string; css: string }> = {
  PENDIENTE: { label: 'Pendiente', css: 'bg-white' },
  REALIZADA: { label: 'Realizada', css: 'bg-yellow' },
  CANCELADA: { label: 'Cancelada', css: 'bg-red-soft text-red' },
}

type Vista = 'mes' | 'semana' | 'dia'
const HORA_PX = 48
const DIA_INICIO = 6
const DIA_FIN = 22

/* -------------------------------- Helpers -------------------------------- */

const primeroDeMes = (iso: string) => `${iso.slice(0, 7)}-01`
const mesSiguiente = (iso: string, n: number) => {
  const d = leerDia(primeroDeMes(iso))
  d.setMonth(d.getMonth() + n)
  return isoDia(d)
}
/** Cuadrícula del mes: 6 semanas desde el lunes anterior al día 1. */
const cuadricula = (ancla: string) => {
  const inicio = lunes(primeroDeMes(ancla))
  return Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i))
}
const ordenar = (a: Actividad, b: Actividad) => (a.horaInicio ?? '').localeCompare(b.horaInicio ?? '') || a.id - b.id
const rangoHoras = (a: Actividad) => (a.horaInicio ? `${a.horaInicio}${a.horaFin ? `–${a.horaFin}` : ''}` : 'Todo el día')
const nombreEmpresa = (e: Empresa) => e.nombreComercial || e.razonSocial

/** Columnas para actividades que se superponen en la misma franja (como Google Calendar). */
function carriles(lista: Actividad[]) {
  const conHora = lista.filter((a) => a.horaInicio).sort(ordenar)
  const res = new Map<number, { carril: number; total: number }>()
  let grupo: { a: Actividad; fin: number; carril: number }[] = []
  let finGrupo = -1
  const cerrar = () => {
    const total = Math.max(1, ...grupo.map((g) => g.carril + 1))
    for (const g of grupo) res.set(g.a.id, { carril: g.carril, total })
    grupo = []
  }
  for (const a of conHora) {
    const ini = minutos(a.horaInicio!)
    const fin = a.horaFin ? minutos(a.horaFin) : ini + 60
    if (ini >= finGrupo) cerrar()
    const ocupados = new Set(grupo.filter((g) => g.fin > ini).map((g) => g.carril))
    let carril = 0
    while (ocupados.has(carril)) carril++
    grupo.push({ a, fin, carril })
    finGrupo = Math.max(finGrupo, fin)
  }
  cerrar()
  return res
}

/* --------------------------------- Página --------------------------------- */

export default function Agenda() {
  const [vista, setVista] = useState<Vista>('mes')
  const [ancla, setAncla] = useState(hoyIso)
  const [dia, setDia] = useState(hoyIso)
  const [editar, setEditar] = useState<Partial<Actividad> | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoActividad | ''>('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')

  const dias = useMemo(() => cuadricula(ancla), [ancla])
  const desde = dias[0]
  const hasta = dias[dias.length - 1]
  const { datos, error, recargar, setDatos } = useCarga(() => api.agenda(desde, hasta), [desde, hasta])
  const empresas = useCarga(() => api.empresas(), [])

  const visibles = useMemo(
    () =>
      (datos?.actividades ?? []).filter(
        (a) => (!filtroTipo || a.tipo === filtroTipo) && (!filtroEmpresa || String(a.empresa?.id ?? '') === filtroEmpresa),
      ),
    [datos, filtroTipo, filtroEmpresa],
  )
  const porDia = useMemo(() => {
    const m = new Map<string, Actividad[]>()
    for (const a of visibles) m.set(a.fecha, [...(m.get(a.fecha) ?? []), a])
    for (const l of m.values()) l.sort(ordenar)
    return m
  }, [visibles])
  const notas = useMemo(() => new Map((datos?.notas ?? []).map((n) => [n.fecha, n.texto])), [datos])

  const mover = (n: number) => {
    const nueva = vista === 'mes' ? mesSiguiente(ancla, n) : sumarDias(ancla, vista === 'semana' ? 7 * n : n)
    setAncla(nueva)
    if (vista !== 'mes') setDia(nueva)
  }
  const irHoy = () => {
    setAncla(hoyIso())
    setDia(hoyIso())
  }
  const abrirDia = (d: string) => {
    setDia(d)
    if (vista !== 'mes') setAncla(d)
  }
  const nueva = (fecha: string, horaInicio: string | null = null) => {
    setDia(fecha)
    setEditar({
      fecha,
      horaInicio,
      horaFin: horaInicio ? hora(Math.min(minutos(horaInicio) + 60, 23 * 60 + 59)) : null,
      tipo: 'auditoria',
      estado: 'PENDIENTE',
    })
  }

  /** Cambio rápido (arrastrar o marcar estado): se ve al instante y se revierte si falla. */
  const cambiar = async (a: Actividad, cambios: Partial<ActividadInput>) => {
    setDatos((d) => d && { ...d, actividades: d.actividades.map((x) => (x.id === a.id ? { ...x, ...cambios } : x)) })
    try {
      await api.actualizarActividad(a.id, cambios)
    } catch (e) {
      toast.error(e)
      recargar()
    }
  }
  const soltar = (fecha: string, horaInicio?: string) => (e: DragEvent) => {
    e.preventDefault()
    const a = datos?.actividades.find((x) => x.id === Number(e.dataTransfer.getData('text/plain')))
    if (!a) return
    if (horaInicio === undefined) {
      if (a.fecha !== fecha) void cambiar(a, { fecha })
      return
    }
    const duracion = a.horaInicio && a.horaFin ? minutos(a.horaFin) - minutos(a.horaInicio) : 60
    const fin = Math.min(minutos(horaInicio) + duracion, 23 * 60 + 59)
    void cambiar(a, { fecha, horaInicio, horaFin: hora(fin) })
  }
  const guardarNota = (n: NotaDia) =>
    setDatos((d) => d && { ...d, notas: [...d.notas.filter((x) => x.fecha !== n.fecha), ...(n.texto ? [n] : [])] })

  const titulo =
    vista === 'mes'
      ? `${MESES[leerDia(ancla).getMonth()]} ${leerDia(ancla).getFullYear()}`
      : vista === 'semana'
        ? `Semana del ${leerDia(lunes(ancla)).getDate()} de ${MESES[leerDia(lunes(ancla)).getMonth()].toLowerCase()}`
        : diaLargo(ancla)

  return (
    <>
      <PageHeader
        kicker="Planificador personal"
        title="Agenda"
        actions={
          <Btn icon="add" onClick={() => nueva(dia)}>
            Nueva actividad
          </Btn>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Btn variant="ghost" onClick={irHoy}>
          Hoy
        </Btn>
        <Btn variant="ghost" icon="chevron_left" aria-label="Anterior" className="!px-2" onClick={() => mover(-1)} />
        <Btn variant="ghost" icon="chevron_right" aria-label="Siguiente" className="!px-2" onClick={() => mover(1)} />
        <h2 className="mx-2 font-headline text-2xl font-bold uppercase first-letter:uppercase">{titulo}</h2>
        <div className="ml-auto flex border-2 border-ink shadow-hard-sm">
          {(['mes', 'semana', 'dia'] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                setVista(v)
                if (v !== 'mes') setAncla(dia)
              }}
              className={cx('px-3 py-1.5 font-headline text-xs font-bold tracking-wider uppercase', vista === v ? 'bg-ink text-white' : 'bg-white hover:bg-yellow')}
            >
              {v === 'dia' ? 'Día' : v}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setFiltroTipo('')} className={cx('border-2 border-ink px-2 py-1 font-headline text-[11px] font-bold tracking-wider uppercase', !filtroTipo ? 'bg-ink text-white' : 'bg-white')}>
          Todas
        </button>
        {(Object.keys(TIPOS_ACTIVIDAD) as TipoActividad[]).map((t) => (
          <button
            key={t}
            onClick={() => setFiltroTipo(filtroTipo === t ? '' : t)}
            className={cx(
              'flex items-center gap-1 border-2 border-ink px-2 py-1 font-headline text-[11px] font-bold tracking-wider uppercase',
              TIPOS_ACTIVIDAD[t].css,
              filtroTipo && filtroTipo !== t && 'opacity-40',
            )}
          >
            <Icon name={TIPOS_ACTIVIDAD[t].icon} className="!text-[14px]" />
            {TIPOS_ACTIVIDAD[t].label}
          </button>
        ))}
        <select
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
          className="ml-auto cursor-pointer border-2 border-ink bg-white px-2 py-1 text-sm"
          aria-label="Filtrar por empresa"
        >
          <option value="">Todas las empresas</option>
          {(empresas.datos ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {nombreEmpresa(e)}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox error={error} />
      {!datos && !error && <Spinner />}
      {datos && (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            {vista === 'mes' ? (
              <VistaMes ancla={ancla} dias={dias} dia={dia} porDia={porDia} notas={notas} onDia={abrirDia} onNueva={nueva} onAbrir={setEditar} onSoltar={soltar} />
            ) : (
              <VistaHoras
                dias={vista === 'semana' ? Array.from({ length: 7 }, (_, i) => sumarDias(lunes(ancla), i)) : [ancla]}
                dia={dia}
                porDia={porDia}
                notas={notas}
                onDia={abrirDia}
                onNueva={nueva}
                onAbrir={setEditar}
                onSoltar={soltar}
              />
            )}
          </div>
          <aside className="space-y-6">
            <PanelDia key={`${dia}:${notas.get(dia) ?? ''}`} fecha={dia} actividades={porDia.get(dia) ?? []} nota={notas.get(dia) ?? ''} onNota={guardarNota} onNueva={() => nueva(dia)} onAbrir={setEditar} onEstado={(a, estado) => cambiar(a, { estado })} />
            <PlanMes ancla={ancla} actividades={visibles.filter((a) => a.fecha.startsWith(ancla.slice(0, 7)))} />
          </aside>
        </div>
      )}

      {editar && (
        <FormActividad
          inicial={editar}
          empresas={empresas.datos ?? []}
          onClose={() => setEditar(null)}
          onDuplicar={(a) => setEditar({ ...a, id: undefined, estado: 'PENDIENTE' })}
          onSaved={recargar}
        />
      )}
    </>
  )
}

/* ------------------------------- Vista mes ------------------------------- */

type PropsVista = {
  dia: string
  porDia: Map<string, Actividad[]>
  notas: Map<string, string>
  onDia: (d: string) => void
  onNueva: (d: string, horaInicio?: string | null) => void
  onAbrir: (a: Actividad) => void
  onSoltar: (fecha: string, horaInicio?: string) => (e: DragEvent) => void
}

const arrastrar = (a: Actividad) => (e: DragEvent) => {
  e.dataTransfer.setData('text/plain', String(a.id))
  e.dataTransfer.effectAllowed = 'move'
}

function Chip({ a, onAbrir, compacto }: { a: Actividad; onAbrir: (a: Actividad) => void; compacto?: boolean }) {
  const t = TIPOS_ACTIVIDAD[a.tipo]
  return (
    <button
      draggable
      onDragStart={arrastrar(a)}
      onClick={(e) => {
        e.stopPropagation()
        onAbrir(a)
      }}
      title={`${rangoHoras(a)} · ${a.titulo}${a.empresa ? ` · ${a.empresa.nombre}` : ''}`}
      className={cx(
        'flex w-full items-center gap-1 truncate border border-ink px-1 text-left text-[11px] leading-5 font-semibold',
        t.css,
        a.estado === 'CANCELADA' && 'line-through opacity-50',
      )}
    >
      {a.estado === 'REALIZADA' && <Icon name="check" className="!text-[13px]" />}
      {!compacto && a.horaInicio && <span className="font-headline">{a.horaInicio}</span>}
      <span className="truncate">{a.titulo}</span>
    </button>
  )
}

function VistaMes({ ancla, dias, dia, porDia, notas, onDia, onNueva, onAbrir, onSoltar }: PropsVista & { ancla: string; dias: string[] }) {
  const mes = ancla.slice(0, 7)
  const hoy = hoyIso()
  const [sobre, setSobre] = useState<string | null>(null)
  return (
    <div className="border-2 border-ink bg-white shadow-hard">
      <div className="grid grid-cols-7 border-b-2 border-ink bg-paper-bright">
        {DIAS_CORTOS.map((d) => (
          <div key={d} className="px-2 py-2 text-center font-headline text-[11px] font-bold tracking-widest uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const lista = porDia.get(d) ?? []
          const fuera = !d.startsWith(mes)
          return (
            <div
              key={d}
              onClick={() => onDia(d)}
              onDoubleClick={() => onNueva(d)}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(d)
              }}
              onDragLeave={() => setSobre((s) => (s === d ? null : s))}
              onDrop={(e) => {
                setSobre(null)
                onSoltar(d)(e)
              }}
              className={cx(
                'group min-h-28 cursor-pointer border-ink p-1',
                i % 7 !== 6 && 'border-r',
                i < 35 && 'border-b',
                fuera ? 'bg-paper text-muted' : 'bg-white',
                d === dia && 'outline-2 -outline-offset-2 outline-blue',
                sobre === d && 'bg-yellow/40',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cx('flex size-6 items-center justify-center font-headline text-sm font-bold', d === hoy && 'bg-red text-white')}>{leerDia(d).getDate()}</span>
                <span className="flex items-center gap-1">
                  {notas.get(d) && <Icon name="sticky_note_2" className="!text-[15px] text-blue" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNueva(d)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-blue"
                    aria-label="Agregar actividad"
                  >
                    <Icon name="add" className="!text-[16px]" />
                  </button>
                </span>
              </div>
              <div className="space-y-0.5">
                {lista.slice(0, 3).map((a) => (
                  <Chip key={a.id} a={a} onAbrir={onAbrir} />
                ))}
                {lista.length > 3 && <p className="px-1 font-headline text-[10px] font-bold text-muted uppercase">+{lista.length - 3} más</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------- Vista semana / día -------------------------- */

function VistaHoras({ dias, dia, porDia, notas, onDia, onNueva, onAbrir, onSoltar }: PropsVista & { dias: string[] }) {
  const hoy = hoyIso()
  // Amplía la franja visible si hay actividades fuera de 06:00–22:00.
  const [desdeH, hastaH] = useMemo(() => {
    let a = DIA_INICIO
    let b = DIA_FIN
    for (const d of dias)
      for (const x of porDia.get(d) ?? []) {
        if (!x.horaInicio) continue
        a = Math.min(a, Math.floor(minutos(x.horaInicio) / 60))
        b = Math.max(b, Math.ceil(minutos(x.horaFin ?? x.horaInicio) / 60) + (x.horaFin ? 0 : 1))
      }
    return [a, Math.min(b, 24)]
  }, [dias, porDia])
  const horas = Array.from({ length: hastaH - desdeH }, (_, i) => desdeH + i)
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes()

  /** Minuto (redondeado a 30) según la posición vertical dentro de la columna. */
  const minutoEn = (e: { clientY: number; currentTarget: HTMLElement }) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const m = desdeH * 60 + Math.floor((y / HORA_PX) * 2) * 30
    return hora(Math.max(0, Math.min(m, 23 * 60 + 30)))
  }
  const cols = `4rem repeat(${dias.length}, minmax(0, 1fr))`

  return (
    <div className="border-2 border-ink bg-white shadow-hard">
      <div className="grid border-b-2 border-ink bg-paper-bright" style={{ gridTemplateColumns: cols }}>
        <div />
        {dias.map((d) => (
          <button key={d} onClick={() => onDia(d)} className={cx('border-l border-ink px-2 py-2 text-center', d === dia && 'bg-yellow')}>
            <span className="block font-headline text-[11px] font-bold tracking-widest uppercase">{DIAS_CORTOS[(leerDia(d).getDay() + 6) % 7]}</span>
            <span className={cx('mx-auto flex size-8 items-center justify-center font-headline text-xl font-bold', d === hoy && 'bg-red text-white')}>{leerDia(d).getDate()}</span>
            {notas.get(d) && <Icon name="sticky_note_2" className="!text-[14px] text-blue" />}
          </button>
        ))}
      </div>
      <div className="grid border-b-2 border-ink" style={{ gridTemplateColumns: cols }}>
        <div className="px-1 py-1 text-right font-headline text-[10px] font-bold text-muted uppercase">Todo el día</div>
        {dias.map((d) => (
          <div key={d} onDragOver={(e) => e.preventDefault()} onDrop={onSoltar(d)} className="min-h-8 space-y-0.5 border-l border-ink p-0.5">
            {(porDia.get(d) ?? [])
              .filter((a) => !a.horaInicio)
              .map((a) => (
                <Chip key={a.id} a={a} onAbrir={onAbrir} />
              ))}
          </div>
        ))}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols }}>
          <div>
            {horas.map((h) => (
              <div key={h} style={{ height: HORA_PX }} className="-translate-y-2 pr-2 text-right font-headline text-[11px] font-bold text-muted">
                {h > desdeH && `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          {dias.map((d) => {
            const lista = (porDia.get(d) ?? []).filter((a) => a.horaInicio)
            const lanes = carriles(lista)
            return (
              <div
                key={d}
                className="relative cursor-pointer border-l border-ink"
                style={{ height: horas.length * HORA_PX }}
                onClick={(e) => onNueva(d, minutoEn(e))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onSoltar(d, minutoEn(e))(e)}
              >
                {horas.map((h) => (
                  <div key={h} style={{ top: (h - desdeH) * HORA_PX }} className="pointer-events-none absolute inset-x-0 border-t border-line" />
                ))}
                {d === hoy && minAhora >= desdeH * 60 && minAhora <= hastaH * 60 && (
                  <div style={{ top: ((minAhora - desdeH * 60) / 60) * HORA_PX }} className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red">
                    <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-red" />
                  </div>
                )}
                {lista.map((a) => {
                  const ini = minutos(a.horaInicio!)
                  const fin = a.horaFin ? minutos(a.horaFin) : ini + 60
                  const l = lanes.get(a.id) ?? { carril: 0, total: 1 }
                  const t = TIPOS_ACTIVIDAD[a.tipo]
                  return (
                    <button
                      key={a.id}
                      draggable
                      onDragStart={arrastrar(a)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onAbrir(a)
                      }}
                      style={{
                        top: ((ini - desdeH * 60) / 60) * HORA_PX,
                        height: Math.max(((fin - ini) / 60) * HORA_PX - 2, 20),
                        left: `calc(${(l.carril / l.total) * 100}% + 2px)`,
                        width: `calc(${100 / l.total}% - 4px)`,
                      }}
                      className={cx(
                        'absolute z-20 overflow-hidden border-2 border-ink px-1.5 py-0.5 text-left text-xs shadow-hard-sm',
                        t.css,
                        a.estado === 'CANCELADA' && 'line-through opacity-50',
                      )}
                    >
                      <span className="flex items-center gap-1 font-semibold">
                        {a.estado === 'REALIZADA' && <Icon name="check" className="!text-[13px]" />}
                        <span className="truncate">{a.titulo}</span>
                      </span>
                      <span className="block truncate font-headline text-[10px] font-bold opacity-80">
                        {rangoHoras(a)}
                        {a.empresa && ` · ${a.empresa.nombre}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Panel del día ------------------------------ */

function PanelDia({
  fecha,
  actividades,
  nota,
  onNota,
  onNueva,
  onAbrir,
  onEstado,
}: {
  fecha: string
  actividades: Actividad[]
  nota: string
  onNota: (n: NotaDia) => void
  onNueva: () => void
  onAbrir: (a: Actividad) => void
  onEstado: (a: Actividad, e: EstadoActividad) => void
}) {
  // El padre le da `key` por día y nota: el borrador se reinicia al cambiar cualquiera de los dos.
  const [texto, setTexto] = useState(nota)
  const [busy, setBusy] = useState(false)
  const sucio = texto.trim() !== nota

  const guardar = async () => {
    if (!sucio) return
    setBusy(true)
    try {
      onNota(await api.guardarNota(fecha, texto))
      toast.ok(texto.trim() ? 'Nota guardada' : 'Nota eliminada')
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={leerDia(fecha).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })}
      icon="today"
      actions={
        <Btn icon="add" className="!px-2 !py-1 !text-xs" onClick={onNueva}>
          Agregar
        </Btn>
      }
    >
      {actividades.length === 0 ? (
        <p className="mb-4 text-sm text-muted">Sin actividades este día.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {actividades.map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              <button
                title={a.estado === 'REALIZADA' ? 'Marcar pendiente' : 'Marcar realizada'}
                onClick={() => onEstado(a, a.estado === 'REALIZADA' ? 'PENDIENTE' : 'REALIZADA')}
                className={cx('mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 border-ink', a.estado === 'REALIZADA' ? 'bg-yellow' : 'bg-white hover:bg-paper-high')}
              >
                {a.estado === 'REALIZADA' && <Icon name="check" className="!text-[14px]" />}
              </button>
              <button onClick={() => onAbrir(a)} className="min-w-0 flex-1 text-left hover:text-blue">
                <span className={cx('block truncate text-sm font-semibold', a.estado === 'CANCELADA' && 'line-through opacity-60')}>{a.titulo}</span>
                <span className="block truncate text-xs text-muted">
                  {rangoHoras(a)}
                  {a.empresa && ` · ${a.empresa.nombre}`}
                </span>
              </button>
              <Tag className={TIPOS_ACTIVIDAD[a.tipo].css}>{TIPOS_ACTIVIDAD[a.tipo].label}</Tag>
            </li>
          ))}
        </ul>
      )}
      <TextArea label="Notas del día" rows={4} placeholder="Recordatorios, pendientes, observaciones…" value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={guardar} />
      {sucio && (
        <div className="mt-2 flex justify-end">
          <Btn icon="save" busy={busy} className="!px-2 !py-1 !text-xs" onClick={guardar}>
            Guardar nota
          </Btn>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------ Plan del mes ------------------------------ */

function PlanMes({ ancla, actividades }: { ancla: string; actividades: Actividad[] }) {
  const activas = actividades.filter((a) => a.estado !== 'CANCELADA')
  const hechas = activas.filter((a) => a.estado === 'REALIZADA').length
  const avance = activas.length ? Math.round((hechas / activas.length) * 100) : 0
  const tipos = (Object.keys(TIPOS_ACTIVIDAD) as TipoActividad[]).map((t) => ({ t, n: activas.filter((a) => a.tipo === t).length })).filter((x) => x.n)
  const empresas = [
    ...activas
      .filter((a) => a.empresa)
      .reduce((m, a) => {
        const e = m.get(a.empresa!.id) ?? { nombre: a.empresa!.nombre, total: 0, auditorias: 0, hechas: 0, fechas: [] as string[] }
        e.total++
        if (a.tipo === 'auditoria') e.auditorias++
        if (a.estado === 'REALIZADA') e.hechas++
        e.fechas.push(a.fecha)
        return m.set(a.empresa!.id, e)
      }, new Map<number, { nombre: string; total: number; auditorias: number; hechas: number; fechas: string[] }>())
      .values(),
  ].sort((a, b) => b.total - a.total)

  return (
    <Card title={`Plan de ${MESES[leerDia(ancla).getMonth()].toLowerCase()}`} icon="event_note">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="bg-paper-bright p-2">
          <p className="font-headline text-2xl font-bold">{activas.length}</p>
          <p className="font-headline text-[10px] font-bold tracking-widest uppercase">Actividades</p>
        </div>
        <div className="bg-yellow p-2">
          <p className="font-headline text-2xl font-bold">{hechas}</p>
          <p className="font-headline text-[10px] font-bold tracking-widest uppercase">Realizadas</p>
        </div>
        <div className="bg-paper-bright p-2">
          <p className="font-headline text-2xl font-bold">{empresas.length}</p>
          <p className="font-headline text-[10px] font-bold tracking-widest uppercase">Empresas</p>
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-1 flex justify-between font-headline text-[11px] font-bold tracking-wider uppercase">
          <span>Avance</span>
          <span>{avance}%</span>
        </div>
        <div className="h-3 border-2 border-ink bg-white">
          <div className="h-full bg-ink" style={{ width: `${avance}%` }} />
        </div>
      </div>
      {tipos.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {tipos.map(({ t, n }) => (
            <Tag key={t} className={TIPOS_ACTIVIDAD[t].css}>
              {TIPOS_ACTIVIDAD[t].label}: {n}
            </Tag>
          ))}
        </div>
      )}
      <p className="mb-2 font-headline text-[11px] font-bold tracking-widest text-muted uppercase">Empresas a visitar o auditar</p>
      {empresas.length === 0 ? (
        <p className="text-sm text-muted">Ninguna actividad del mes tiene empresa asignada.</p>
      ) : (
        <ul className="divide-y-2 divide-paper-high">
          {empresas.map((e) => (
            <li key={e.nombre} className="py-2">
              <p className="truncate text-sm font-semibold">{e.nombre}</p>
              <p className="text-xs text-muted">
                {e.total} actividad{e.total === 1 ? '' : 'es'}
                {e.auditorias > 0 && ` · ${e.auditorias} auditoría${e.auditorias === 1 ? '' : 's'}`} · {e.hechas} realizada{e.hechas === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-muted">Días: {[...new Set(e.fechas)].sort().map((f) => leerDia(f).getDate()).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------ Formulario ------------------------------ */

function FormActividad({
  inicial,
  empresas,
  onClose,
  onDuplicar,
  onSaved,
}: {
  inicial: Partial<Actividad>
  empresas: Empresa[]
  onClose: () => void
  onDuplicar: (a: Actividad) => void
  onSaved: () => void
}) {
  const [f, setF] = useState({
    titulo: inicial.titulo ?? '',
    tipo: inicial.tipo ?? ('auditoria' as TipoActividad),
    fecha: inicial.fecha ?? hoyIso(),
    todoElDia: !inicial.horaInicio,
    horaInicio: inicial.horaInicio ?? '08:00',
    horaFin: inicial.horaFin ?? '09:00',
    empresaId: inicial.empresa?.id ? String(inicial.empresa.id) : '',
    lugar: inicial.lugar ?? '',
    descripcion: inicial.descripcion ?? '',
    estado: inicial.estado ?? ('PENDIENTE' as EstadoActividad),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const existente = inicial.id ? (inicial as Actividad) : null
  // Una empresa ya asignada que el usuario dejó de tener sigue visible en la lista.
  const opciones = existente?.empresa && !empresas.some((e) => e.id === existente.empresa!.id) ? [{ id: existente.empresa.id, nombre: existente.empresa.nombre }] : []

  const datos = (): ActividadInput => ({
    titulo: f.titulo.trim(),
    tipo: f.tipo,
    fecha: f.fecha,
    horaInicio: f.todoElDia ? null : f.horaInicio,
    horaFin: f.todoElDia ? null : f.horaFin || null,
    empresaId: f.empresaId ? Number(f.empresaId) : null,
    lugar: f.lugar.trim() || null,
    descripcion: f.descripcion.trim() || null,
    estado: f.estado,
  })

  const guardar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (existente) await api.actualizarActividad(existente.id, datos())
      else await api.crearActividad(datos())
      toast.ok('Actividad guardada')
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const eliminar = async () => {
    if (!existente || !window.confirm(`¿Eliminar "${existente.titulo}"?`)) return
    try {
      await api.eliminarActividad(existente.id)
      toast.ok('Actividad eliminada')
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <Modal title={existente ? 'Editar actividad' : 'Nueva actividad'} onClose={onClose} wide>
      <form onSubmit={guardar} className="space-y-4">
        <Field label="Título *" required maxLength={150} autoFocus value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ej. Auditoría de seguridad en planta" />
        <div>
          <span className="font-headline text-[11px] font-bold tracking-widest text-muted uppercase">Tipo</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {(Object.keys(TIPOS_ACTIVIDAD) as TipoActividad[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => set('tipo', t)}
                className={cx(
                  'flex items-center gap-1 border-2 border-ink px-2 py-1 font-headline text-[11px] font-bold tracking-wider uppercase',
                  f.tipo === t ? `${TIPOS_ACTIVIDAD[t].css} shadow-hard-sm` : 'bg-white opacity-60 hover:opacity-100',
                )}
              >
                <Icon name={TIPOS_ACTIVIDAD[t].icon} className="!text-[14px]" />
                {TIPOS_ACTIVIDAD[t].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fecha *" type="date" required value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
          <Field label="Inicio" type="time" disabled={f.todoElDia} value={f.horaInicio} onChange={(e) => set('horaInicio', e.target.value)} />
          <Field label="Fin" type="time" disabled={f.todoElDia} value={f.horaFin} onChange={(e) => set('horaFin', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-ink" checked={f.todoElDia} onChange={(e) => set('todoElDia', e.target.checked)} />
          Todo el día
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Empresa" value={f.empresaId} onChange={(e) => set('empresaId', e.target.value)}>
            <option value="">— Sin empresa —</option>
            {opciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {nombreEmpresa(e)}
              </option>
            ))}
          </Select>
          <Field label="Lugar" maxLength={200} value={f.lugar} onChange={(e) => set('lugar', e.target.value)} placeholder="Dirección, área o enlace" />
        </div>
        <TextArea label="Descripción" value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Objetivo, checklist, personas de contacto…" />
        <div>
          <span className="font-headline text-[11px] font-bold tracking-widest text-muted uppercase">Estado</span>
          <div className="mt-1 flex gap-1">
            {(Object.keys(ESTADOS) as EstadoActividad[]).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => set('estado', s)}
                className={cx('border-2 border-ink px-2 py-1 font-headline text-[11px] font-bold tracking-wider uppercase', f.estado === s ? `${ESTADOS[s].css} shadow-hard-sm` : 'bg-white opacity-60 hover:opacity-100')}
              >
                {ESTADOS[s].label}
              </button>
            ))}
          </div>
        </div>
        <ErrorBox error={error} />
        <div className="flex flex-wrap justify-end gap-2">
          {existente && (
            <>
              <Btn type="button" variant="danger" icon="delete" onClick={eliminar} className="mr-auto">
                Eliminar
              </Btn>
              <Btn type="button" variant="ghost" icon="content_copy" onClick={() => onDuplicar(existente)}>
                Duplicar
              </Btn>
            </>
          )}
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
