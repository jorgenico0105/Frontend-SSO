import { useMemo, useState } from 'react'
import { api, type Empresa, type EstadoMovimiento, type MetodoPago, type Movimiento, type MovimientoInput, type ResumenFinanzas, type TipoMovimiento } from '../api'
import { Btn, Card, Empty, ErrorBox, Field, Icon, Modal, PageHeader, Select, Spinner, Tag, TextArea } from '../ui'
import { cx, diaCorto, dinero, hoyIso, MESES, sumarDias, toast, useCarga } from '../lib'

/* ------------------------------- Catálogos ------------------------------- */

const CATEGORIAS: Record<TipoMovimiento, string[]> = {
  INGRESO: ['Honorarios', 'Auditoría', 'Consultoría', 'Capacitación', 'Inspección', 'Asesoría mensual', 'Otros ingresos'],
  GASTO: ['Transporte', 'Alimentación', 'Hospedaje', 'Equipos y EPP', 'Materiales', 'Capacitación', 'Software y servicios', 'Impuestos', 'Seguridad social', 'Otros gastos'],
}

const METODOS: Record<MetodoPago, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
}

type Pestana = 'movimientos' | 'cobrar' | 'empresas' | 'categorias'
type Filtro = { mes: string; tipo: TipoMovimiento | ''; estado: 'PAGADO' | 'PENDIENTE' | 'VENCIDO' | ''; empresa: string; texto: string }

const nombreEmpresa = (e: Empresa) => e.nombreComercial || e.razonSocial

function EstadoTag({ m }: { m: Movimiento }) {
  if (m.tipo === 'GASTO') return <Tag className="bg-paper-high">Gasto</Tag>
  if (m.vencido) return <Tag className="bg-red text-white">Vencido</Tag>
  return m.estado === 'PAGADO' ? <Tag className="bg-yellow">Cobrado</Tag> : <Tag className="bg-white">Pendiente</Tag>
}

/** Exporta los movimientos visibles a CSV (se abre en Excel). */
function exportarCsv(lista: Movimiento[], anio: number) {
  const celda = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const filas = [
    ['Fecha', 'Tipo', 'Concepto', 'Empresa', 'Categoría', 'Monto', 'Estado', 'Vencimiento', 'Fecha de pago', 'Método', 'Referencia', 'Nota'],
    ...lista.map((m) => [
      m.fecha,
      m.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto',
      m.concepto,
      m.empresa?.nombre ?? '',
      m.categoria,
      (m.tipo === 'GASTO' ? -m.monto : m.monto).toFixed(2),
      m.tipo === 'GASTO' ? 'Pagado' : m.vencido ? 'Vencido' : m.estado === 'PAGADO' ? 'Cobrado' : 'Pendiente',
      m.fechaVencimiento ?? '',
      m.fechaPago ?? '',
      m.metodo ? METODOS[m.metodo] : '',
      m.referencia ?? '',
      m.nota ?? '',
    ]),
  ]
  // BOM para que Excel lea las tildes; ";" es el separador habitual en configuración regional es.
  const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `finanzas-${anio}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* --------------------------------- Página --------------------------------- */

export default function Finanzas() {
  const [anio, setAnio] = useState(() => Number(hoyIso().slice(0, 4)))
  const [pestana, setPestana] = useState<Pestana>('movimientos')
  const [filtro, setFiltro] = useState<Filtro>({ mes: '', tipo: '', estado: '', empresa: '', texto: '' })
  const [editar, setEditar] = useState<Partial<Movimiento> | null>(null)

  const movs = useCarga(() => api.movimientos(), [])
  const resumen = useCarga(() => api.resumenFinanzas(anio), [anio])
  const empresas = useCarga(() => api.empresas(), [])
  const recargar = () => {
    movs.recargar()
    resumen.recargar()
  }

  const delAnio = useMemo(() => (movs.datos ?? []).filter((m) => m.fecha.startsWith(String(anio))), [movs.datos, anio])
  const filtrados = useMemo(() => {
    const t = filtro.texto.trim().toLowerCase()
    return delAnio.filter(
      (m) =>
        (!filtro.mes || m.fecha.slice(5, 7) === filtro.mes) &&
        (!filtro.tipo || m.tipo === filtro.tipo) &&
        (!filtro.empresa || String(m.empresa?.id ?? '') === filtro.empresa) &&
        (!filtro.estado ||
          (filtro.estado === 'VENCIDO' ? m.vencido : m.tipo === 'INGRESO' && m.estado === filtro.estado && (filtro.estado !== 'PENDIENTE' || !m.vencido))) &&
        (!t || [m.concepto, m.categoria, m.referencia, m.nota, m.empresa?.nombre].some((v) => v?.toLowerCase().includes(t))),
    )
  }, [delAnio, filtro])
  const pendientes = useMemo(
    () =>
      (movs.datos ?? [])
        .filter((m) => m.tipo === 'INGRESO' && m.estado === 'PENDIENTE')
        .sort((a, b) => (a.fechaVencimiento ?? a.fecha).localeCompare(b.fechaVencimiento ?? b.fecha)),
    [movs.datos],
  )

  const marcarPagado = async (m: Movimiento) => {
    try {
      await api.actualizarMovimiento(m.id, { estado: 'PAGADO', fechaPago: hoyIso() })
      toast.ok(`Cobro de ${dinero(m.monto)} marcado como pagado`)
      recargar()
    } catch (e) {
      toast.error(e)
    }
  }
  const eliminar = async (m: Movimiento) => {
    if (!window.confirm(`¿Eliminar "${m.concepto}" por ${dinero(m.monto)}?`)) return
    try {
      await api.eliminarMovimiento(m.id)
      toast.ok('Movimiento eliminado')
      recargar()
    } catch (e) {
      toast.error(e)
    }
  }

  const anioActual = Number(hoyIso().slice(0, 4))
  const anios = [...new Set([anioActual + 1, anioActual, anio, ...(movs.datos ?? []).map((m) => Number(m.fecha.slice(0, 4)))])].sort((a, b) => b - a)
  const r = resumen.datos

  return (
    <>
      <PageHeader
        kicker="Control personal"
        title="Finanzas"
        actions={
          <>
            <Btn icon="add_card" onClick={() => setEditar({ tipo: 'INGRESO', estado: 'PENDIENTE' })}>
              Nuevo cobro
            </Btn>
            <Btn variant="dark" icon="shopping_cart" onClick={() => setEditar({ tipo: 'GASTO', estado: 'PAGADO' })}>
              Nuevo gasto
            </Btn>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="font-headline text-xs font-bold tracking-widest text-muted uppercase">Año</span>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="cursor-pointer border-2 border-ink bg-white px-2 py-1 font-headline font-bold shadow-hard-sm">
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox error={movs.error || resumen.error} />
      {(!movs.datos || !r) && !movs.error && !resumen.error && <Spinner />}

      {movs.datos && r && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label={`Facturado ${anio}`} valor={r.totales.facturado} icon="receipt_long" />
            <Kpi label={`Cobrado ${anio}`} valor={r.totales.cobrado} icon="savings" css="bg-yellow" />
            <Kpi label={`Gastos ${anio}`} valor={r.totales.gastos} icon="shopping_cart" css="bg-ink text-white" />
            <Kpi label="Balance" valor={r.totales.balance} icon="account_balance" css={r.totales.balance < 0 ? 'bg-red-soft text-red' : 'bg-blue-soft'} />
            <Kpi
              label={`Por cobrar (${r.totales.pendientes})`}
              valor={r.totales.porCobrar}
              icon="schedule"
              css={r.totales.vencido > 0 ? 'bg-red text-white' : undefined}
              sub={r.totales.vencido > 0 ? `${dinero(r.totales.vencido)} vencido` : undefined}
            />
          </div>

          <Card title={`Mes a mes · ${anio}`} icon="bar_chart" className="mb-6">
            <GraficoMeses resumen={r} />
          </Card>

          <div className="mb-4 flex flex-wrap border-b-4 border-ink">
            {(
              [
                ['movimientos', 'Movimientos', 'list'],
                ['cobrar', `Por cobrar (${pendientes.length})`, 'pending_actions'],
                ['empresas', 'Por empresa', 'apartment'],
                ['categorias', 'Gastos por categoría', 'donut_small'],
              ] as [Pestana, string, string][]
            ).map(([k, label, icon]) => (
              <button
                key={k}
                onClick={() => setPestana(k)}
                className={cx('-mb-1 flex items-center gap-2 border-2 border-b-0 px-4 py-2 font-headline text-sm font-bold tracking-wider uppercase', pestana === k ? 'border-ink bg-yellow' : 'border-transparent hover:bg-white')}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>

          {pestana === 'movimientos' && (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-6">
                <input
                  value={filtro.texto}
                  onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))}
                  placeholder="Buscar concepto, factura, nota…"
                  className="border-2 border-ink bg-white px-2 py-1.5 text-sm md:col-span-2"
                />
                <FiltroSelect value={filtro.mes} onChange={(mes) => setFiltro((f) => ({ ...f, mes }))} label="Todo el año">
                  {MESES.map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, '0')}>
                      {m}
                    </option>
                  ))}
                </FiltroSelect>
                <FiltroSelect value={filtro.tipo} onChange={(tipo) => setFiltro((f) => ({ ...f, tipo: tipo as Filtro['tipo'] }))} label="Ingresos y gastos">
                  <option value="INGRESO">Solo ingresos</option>
                  <option value="GASTO">Solo gastos</option>
                </FiltroSelect>
                <FiltroSelect value={filtro.estado} onChange={(estado) => setFiltro((f) => ({ ...f, estado: estado as Filtro['estado'] }))} label="Cualquier estado">
                  <option value="PAGADO">Cobrados</option>
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="VENCIDO">Vencidos</option>
                </FiltroSelect>
                <FiltroSelect value={filtro.empresa} onChange={(empresa) => setFiltro((f) => ({ ...f, empresa }))} label="Todas las empresas">
                  {[...new Map(delAnio.filter((m) => m.empresa).map((m) => [m.empresa!.id, m.empresa!.nombre])).entries()].map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </FiltroSelect>
              </div>
              <TablaMovimientos
                lista={filtrados}
                onEditar={setEditar}
                onPagar={marcarPagado}
                onEliminar={eliminar}
                pie={
                  filtrados.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink bg-paper-bright px-3 py-2 text-sm">
                      <span>
                        {filtrados.length} movimiento{filtrados.length === 1 ? '' : 's'} · Ingresos{' '}
                        <b>{dinero(filtrados.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0))}</b> · Gastos{' '}
                        <b>{dinero(filtrados.filter((m) => m.tipo === 'GASTO').reduce((s, m) => s + m.monto, 0))}</b>
                      </span>
                      <Btn variant="ghost" icon="download" className="!px-2 !py-1 !text-xs" onClick={() => exportarCsv(filtrados, anio)}>
                        Exportar CSV
                      </Btn>
                    </div>
                  )
                }
              />
            </>
          )}

          {pestana === 'cobrar' && (
            <TablaMovimientos lista={pendientes} onEditar={setEditar} onPagar={marcarPagado} onEliminar={eliminar} vacio="No tienes cobros pendientes. ¡Todo al día!" porVencimiento />
          )}

          {pestana === 'empresas' && <PorEmpresa resumen={r} />}
          {pestana === 'categorias' && <PorCategoria resumen={r} />}
        </>
      )}

      {editar && <FormMovimiento inicial={editar} empresas={empresas.datos ?? []} onClose={() => setEditar(null)} onSaved={recargar} />}
    </>
  )
}

/* ------------------------------ Componentes ------------------------------ */

function Kpi({ label, valor, icon, css, sub }: { label: string; valor: number; icon: string; css?: string; sub?: string }) {
  return (
    <div className={cx('border-2 border-ink p-4 shadow-hard', css ?? 'bg-white')}>
      <div className="flex items-center justify-between">
        <p className="font-headline text-[10px] font-bold tracking-widest uppercase">{label}</p>
        <Icon name={icon} />
      </div>
      <p className="mt-2 font-headline text-2xl leading-none font-bold">{dinero(valor)}</p>
      {sub && <p className="mt-1 text-xs font-semibold">{sub}</p>}
    </div>
  )
}

function FiltroSelect({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer border-2 border-ink bg-white px-2 py-1.5 text-sm">
      <option value="">{label}</option>
      {children}
    </select>
  )
}

/** Barras de cobrado (azul) y gastos (rojo) por mes, con el balance a la derecha. */
function GraficoMeses({ resumen }: { resumen: ResumenFinanzas }) {
  const max = Math.max(1, ...resumen.meses.flatMap((m) => [m.cobrado, m.gastos]))
  const hoy = hoyIso()
  const mesActual = resumen.anio === Number(hoy.slice(0, 4)) ? Number(hoy.slice(5, 7)) : 0
  return (
    <>
      <div className="mb-3 flex gap-4 font-headline text-[11px] font-bold tracking-wider uppercase">
        <span className="flex items-center gap-1">
          <span className="size-3 border-2 border-ink bg-blue" /> Cobrado
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 border-2 border-ink bg-red" /> Gastos
        </span>
      </div>
      <div className="space-y-1.5">
        {resumen.meses.map((m) => (
          <div key={m.mes} className={cx('grid grid-cols-[5.5rem_1fr_7rem] items-center gap-3 px-1', m.mes === mesActual && 'bg-yellow/30')}>
            <span className="font-headline text-xs font-bold uppercase">{MESES[m.mes - 1].slice(0, 3)}</span>
            <div className="space-y-0.5">
              <Barra valor={m.cobrado} max={max} css="bg-blue" />
              <Barra valor={m.gastos} max={max} css="bg-red" />
            </div>
            <span className={cx('text-right font-headline text-sm font-bold', m.balance < 0 && 'text-red')}>{m.cobrado || m.gastos ? dinero(m.balance) : '—'}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function Barra({ valor, max, css }: { valor: number; max: number; css: string }) {
  return (
    <div className="flex items-center gap-2" title={dinero(valor)}>
      <div className={cx('h-3 border-ink', css, valor > 0 && 'border-2')} style={{ width: `${(valor / max) * 85}%` }} />
      {valor > 0 && <span className="text-[11px] text-muted">{dinero(valor)}</span>}
    </div>
  )
}

function TablaMovimientos({
  lista,
  onEditar,
  onPagar,
  onEliminar,
  pie,
  vacio = 'Sin movimientos con estos filtros.',
  porVencimiento,
}: {
  lista: Movimiento[]
  onEditar: (m: Movimiento) => void
  onPagar: (m: Movimiento) => void
  onEliminar: (m: Movimiento) => void
  pie?: React.ReactNode
  vacio?: string
  porVencimiento?: boolean
}) {
  if (lista.length === 0) return <Empty icon="payments" title={vacio} />
  return (
    <div className="overflow-x-auto border-2 border-ink bg-white shadow-hard">
      <table className="w-full text-sm">
        <thead className="border-b-2 border-ink bg-paper-bright text-left font-headline text-[11px] tracking-widest uppercase">
          <tr>
            <th className="px-3 py-2">{porVencimiento ? 'Vence' : 'Fecha'}</th>
            <th className="px-3 py-2">Concepto</th>
            <th className="px-3 py-2">Empresa</th>
            <th className="px-3 py-2">Categoría</th>
            <th className="px-3 py-2 text-right">Monto</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-paper-high">
          {lista.map((m) => (
            <tr key={m.id} className={cx('hover:bg-paper-bright', m.vencido && 'bg-red-soft/40')}>
              <td className="px-3 py-2 whitespace-nowrap">
                {diaCorto(porVencimiento ? (m.fechaVencimiento ?? m.fecha) : m.fecha)}
                {porVencimiento && !m.fechaVencimiento && <span className="block text-[10px] text-muted">sin vencimiento</span>}
              </td>
              <td className="max-w-64 px-3 py-2">
                <button onClick={() => onEditar(m)} className="block max-w-full truncate text-left font-semibold hover:text-blue">
                  {m.concepto}
                </button>
                {m.referencia && <span className="block truncate text-xs text-muted">Ref. {m.referencia}</span>}
              </td>
              <td className="max-w-48 truncate px-3 py-2">{m.empresa?.nombre ?? <span className="text-muted">—</span>}</td>
              <td className="px-3 py-2 whitespace-nowrap">{m.categoria}</td>
              <td className={cx('px-3 py-2 text-right font-headline font-bold whitespace-nowrap', m.tipo === 'GASTO' ? 'text-red' : '')}>
                {m.tipo === 'GASTO' ? '−' : '+'}
                {dinero(m.monto)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <EstadoTag m={m} />
                {m.estado === 'PAGADO' && m.tipo === 'INGRESO' && m.fechaPago && <span className="block text-[10px] text-muted">{diaCorto(m.fechaPago)}</span>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex justify-end gap-2">
                  {m.tipo === 'INGRESO' && m.estado === 'PENDIENTE' && (
                    <button title="Marcar como cobrado hoy" className="hover:text-blue" onClick={() => onPagar(m)}>
                      <Icon name="price_check" />
                    </button>
                  )}
                  <button title="Editar" className="hover:text-blue" onClick={() => onEditar(m)}>
                    <Icon name="edit" />
                  </button>
                  <button title="Eliminar" className="hover:text-red" onClick={() => onEliminar(m)}>
                    <Icon name="delete" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pie}
    </div>
  )
}

function PorEmpresa({ resumen }: { resumen: ResumenFinanzas }) {
  if (resumen.empresas.length === 0) return <Empty icon="apartment" title={`Sin cobros en ${resumen.anio}`} />
  const total = (k: 'facturado' | 'cobrado' | 'pendiente') => resumen.empresas.reduce((s, e) => s + e[k], 0)
  return (
    <div className="overflow-x-auto border-2 border-ink bg-white shadow-hard">
      <table className="w-full text-sm">
        <thead className="border-b-2 border-ink bg-paper-bright text-left font-headline text-[11px] tracking-widest uppercase">
          <tr>
            <th className="px-3 py-2">Empresa</th>
            <th className="px-3 py-2 text-right">Facturado {resumen.anio}</th>
            <th className="px-3 py-2 text-right">Cobrado {resumen.anio}</th>
            <th className="px-3 py-2 text-right">Te debe (total)</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-paper-high">
          {resumen.empresas.map((e) => (
            <tr key={e.empresa?.id ?? 'sin'}>
              <td className="px-3 py-2 font-semibold">{e.empresa?.nombre ?? <span className="text-muted">Sin empresa</span>}</td>
              <td className="px-3 py-2 text-right">{dinero(e.facturado)}</td>
              <td className="px-3 py-2 text-right">{dinero(e.cobrado)}</td>
              <td className={cx('px-3 py-2 text-right font-headline font-bold', e.pendiente > 0 && 'text-red')}>{dinero(e.pendiente)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-ink bg-paper-bright font-headline font-bold">
          <tr>
            <td className="px-3 py-2 uppercase">Total</td>
            <td className="px-3 py-2 text-right">{dinero(total('facturado'))}</td>
            <td className="px-3 py-2 text-right">{dinero(total('cobrado'))}</td>
            <td className="px-3 py-2 text-right">{dinero(total('pendiente'))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function PorCategoria({ resumen }: { resumen: ResumenFinanzas }) {
  if (resumen.categorias.length === 0) return <Empty icon="shopping_cart" title={`Sin gastos en ${resumen.anio}`} />
  const total = resumen.categorias.reduce((s, c) => s + c.total, 0)
  return (
    <Card title={`Gastos ${resumen.anio}: ${dinero(total)}`} icon="donut_small">
      <ul className="space-y-3">
        {resumen.categorias.map((c) => {
          const pct = (c.total / total) * 100
          return (
            <li key={c.categoria}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">{c.categoria}</span>
                <span className="font-headline font-bold">
                  {dinero(c.total)} <span className="text-xs text-muted">({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-3 border-2 border-ink bg-white">
                <div className="h-full bg-red" style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ------------------------------ Formulario ------------------------------ */

function FormMovimiento({ inicial, empresas, onClose, onSaved }: { inicial: Partial<Movimiento>; empresas: Empresa[]; onClose: () => void; onSaved: () => void }) {
  const tipoInicial = inicial.tipo ?? 'INGRESO'
  const [f, setF] = useState({
    tipo: tipoInicial,
    concepto: inicial.concepto ?? '',
    categoria: inicial.categoria ?? CATEGORIAS[tipoInicial][0],
    monto: inicial.monto !== undefined ? String(inicial.monto) : '',
    fecha: inicial.fecha ?? hoyIso(),
    fechaVencimiento: inicial.fechaVencimiento ?? (inicial.id ? '' : sumarDias(hoyIso(), 30)),
    estado: inicial.estado ?? ((tipoInicial === 'GASTO' ? 'PAGADO' : 'PENDIENTE') as EstadoMovimiento),
    fechaPago: inicial.fechaPago ?? '',
    metodo: (inicial.metodo ?? '') as MetodoPago | '',
    referencia: inicial.referencia ?? '',
    nota: inicial.nota ?? '',
    empresaId: inicial.empresa?.id ? String(inicial.empresa.id) : '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const existente = inicial.id ? (inicial as Movimiento) : null
  const ingreso = f.tipo === 'INGRESO'
  const pagado = !ingreso || f.estado === 'PAGADO'
  const opciones = existente?.empresa && !empresas.some((e) => e.id === existente.empresa!.id) ? [existente.empresa] : []

  const cambiarTipo = (tipo: TipoMovimiento) =>
    setF((x) => ({
      ...x,
      tipo,
      categoria: CATEGORIAS[tipo].includes(x.categoria) ? x.categoria : CATEGORIAS[tipo][0],
      estado: tipo === 'GASTO' ? 'PAGADO' : x.estado,
    }))

  const guardar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    const monto = Number(f.monto.replace(',', '.'))
    if (!(monto > 0)) return setError(new Error('Escribe un monto mayor a 0'))
    const datos: MovimientoInput = {
      tipo: f.tipo,
      concepto: f.concepto.trim(),
      categoria: f.categoria.trim(),
      monto: Math.round(monto * 100) / 100,
      fecha: f.fecha,
      fechaVencimiento: ingreso && f.fechaVencimiento ? f.fechaVencimiento : null,
      estado: ingreso ? f.estado : 'PAGADO',
      fechaPago: ingreso && f.estado === 'PAGADO' ? f.fechaPago || hoyIso() : null,
      metodo: pagado && f.metodo ? f.metodo : null,
      referencia: f.referencia.trim() || null,
      nota: f.nota.trim() || null,
      empresaId: f.empresaId ? Number(f.empresaId) : null,
    }
    setBusy(true)
    setError(null)
    try {
      if (existente) await api.actualizarMovimiento(existente.id, datos)
      else await api.crearMovimiento(datos)
      toast.ok(ingreso ? 'Cobro guardado' : 'Gasto guardado')
      onSaved()
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal title={existente ? (ingreso ? 'Editar cobro' : 'Editar gasto') : ingreso ? 'Nuevo cobro' : 'Nuevo gasto'} onClose={onClose} wide>
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex border-2 border-ink shadow-hard-sm">
          {(['INGRESO', 'GASTO'] as TipoMovimiento[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => cambiarTipo(t)}
              className={cx('flex flex-1 items-center justify-center gap-2 py-2 font-headline text-sm font-bold tracking-wider uppercase', f.tipo === t ? (t === 'INGRESO' ? 'bg-yellow' : 'bg-ink text-white') : 'bg-white hover:bg-paper-high')}
            >
              <Icon name={t === 'INGRESO' ? 'add_card' : 'shopping_cart'} />
              {t === 'INGRESO' ? 'Cobro / ingreso' : 'Gasto'}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Concepto *" required maxLength={200} autoFocus value={f.concepto} onChange={(e) => set('concepto', e.target.value)} placeholder={ingreso ? 'Ej. Auditoría mensual de noviembre' : 'Ej. Gasolina visita a planta'} />
          </div>
          <Field label="Monto (USD) *" required inputMode="decimal" value={f.monto} onChange={(e) => set('monto', e.target.value)} placeholder="0.00" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={ingreso ? 'Empresa (cliente)' : 'Empresa relacionada'} value={f.empresaId} onChange={(e) => set('empresaId', e.target.value)}>
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
          <Field label="Categoría *" required maxLength={60} list={`categorias-${f.tipo}`} value={f.categoria} onChange={(e) => set('categoria', e.target.value)} hint="Elige una o escribe la tuya" />
          <datalist id={`categorias-${f.tipo}`}>
            {CATEGORIAS[f.tipo].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={ingreso ? 'Fecha de emisión *' : 'Fecha *'} type="date" required value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
          {ingreso && <Field label="Vence" type="date" value={f.fechaVencimiento} onChange={(e) => set('fechaVencimiento', e.target.value)} />}
          <Field label="N.º factura / referencia" maxLength={100} value={f.referencia} onChange={(e) => set('referencia', e.target.value)} />
        </div>
        {ingreso && (
          <div>
            <span className="font-headline text-[11px] font-bold tracking-widest text-muted uppercase">Estado del cobro</span>
            <div className="mt-1 flex gap-1">
              {(['PENDIENTE', 'PAGADO'] as EstadoMovimiento[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => set('estado', s)}
                  className={cx('border-2 border-ink px-3 py-1 font-headline text-[11px] font-bold tracking-wider uppercase', f.estado === s ? (s === 'PAGADO' ? 'bg-yellow shadow-hard-sm' : 'bg-ink text-white shadow-hard-sm') : 'bg-white opacity-60 hover:opacity-100')}
                >
                  {s === 'PAGADO' ? 'Cobrado' : 'Pendiente'}
                </button>
              ))}
            </div>
          </div>
        )}
        {pagado && (
          <div className="grid gap-4 sm:grid-cols-2">
            {ingreso && <Field label="Fecha de cobro" type="date" value={f.fechaPago} onChange={(e) => set('fechaPago', e.target.value)} hint="Vacía = hoy" />}
            <Select label="Método de pago" value={f.metodo} onChange={(e) => set('metodo', e.target.value as MetodoPago | '')}>
              <option value="">—</option>
              {(Object.keys(METODOS) as MetodoPago[]).map((m) => (
                <option key={m} value={m}>
                  {METODOS[m]}
                </option>
              ))}
            </Select>
          </div>
        )}
        <TextArea label="Nota" value={f.nota} onChange={(e) => set('nota', e.target.value)} />
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
