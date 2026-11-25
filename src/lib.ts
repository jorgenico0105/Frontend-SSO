// Utilidades compartidas que no son componentes (separadas de ui.tsx para el fast refresh de Vite).
import { useEffect, useState } from 'react'
import type { SiglaNivel, TipoArchivo } from './api'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const fecha = (iso: string | null | undefined, conHora = false) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleString('es-EC', conHora ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
    : '—'

/** Niveles de la matriz F-PSSO-IMEC-02 (igual que mobile/src/domain/matriz.ts). */
export const NIVEL_MATRIZ: Record<SiglaNivel, { nombre: string; css: string }> = {
  T: { nombre: 'Trivial', css: 'bg-paper-high' },
  TO: { nombre: 'Tolerable', css: 'bg-blue-soft' },
  MO: { nombre: 'Moderado', css: 'bg-yellow' },
  I: { nombre: 'Importante', css: 'bg-red-soft text-red' },
  IN: { nombre: 'Intolerable', css: 'bg-red text-white' },
}

/** Tipos de registro del archivo. */
export const TIPO: Record<TipoArchivo, { label: string; icon: string; css: string }> = {
  matriz: { label: 'Matriz de riesgos', icon: 'record_voice_over', css: 'bg-yellow' },
  reporte: { label: 'Acto / condición', icon: 'photo_camera', css: 'bg-red text-white' },
  ergo: { label: 'Ergonomía', icon: 'accessibility_new', css: 'bg-blue text-white' },
  permiso: { label: 'Permiso de trabajo', icon: 'assignment', css: 'bg-ink text-white' },
  accidente: { label: 'Accidente', icon: 'personal_injury', css: 'bg-red-soft text-red' },
}

/* ------------------------------ Avisos (toasts) ------------------------------ */

export type Aviso = { id: number; texto: string; error?: boolean }
let emitir: ((a: Aviso) => void) | null = null
let siguiente = 1

/** `<Toasts />` (ui.tsx) se suscribe aquí; se llama desde cualquier pantalla. */
export const suscribirAvisos = (fn: ((a: Aviso) => void) | null) => {
  emitir = fn
}

export const toast = {
  ok: (texto: string) => emitir?.({ id: siguiente++, texto }),
  error: (e: unknown) => emitir?.({ id: siguiente++, texto: e instanceof Error ? e.message : String(e), error: true }),
}

/** Carga asíncrona con estado de error y recarga manual. */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [version, setVersion] = useState(0)
  // `fn` cambia en cada render: quien llama declara de qué depende en `deps`.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let vivo = true
    fn().then(
      (d) => {
        if (!vivo) return
        setDatos(d)
        setError(null)
      },
      (e) => vivo && setError(e),
    )
    return () => {
      vivo = false
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])
  return { datos, error, recargar: () => setVersion((v) => v + 1), setDatos }
}

/* ------------------------- Fechas locales y dinero ------------------------- */
// La agenda y las finanzas usan fechas YYYY-MM-DD sin zona horaria: se arman con los
// componentes locales para que un día no se corra al convertir a UTC.

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const dos = (n: number) => String(n).padStart(2, '0')
export const isoDia = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
export const leerDia = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}
export const hoyIso = () => isoDia(new Date())
export const sumarDias = (iso: string, n: number) => {
  const d = leerDia(iso)
  d.setDate(d.getDate() + n)
  return isoDia(d)
}
/** Lunes de la semana del día dado. */
export const lunes = (iso: string) => sumarDias(iso, -((leerDia(iso).getDay() + 6) % 7))
export const diaLargo = (iso: string) => leerDia(iso).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const diaCorto = (iso: string | null | undefined) => (iso ? leerDia(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

/** "HH:MM" → minutos desde la medianoche. */
export const minutos = (h: string) => {
  const [hh, mm] = h.split(':').map(Number)
  return hh * 60 + mm
}
export const hora = (min: number) => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`

const fmtDinero = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })
export const dinero = (n: number) => fmtDinero.format(n)
