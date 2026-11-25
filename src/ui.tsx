// Primitivas del sistema Bauhaus — Neo-Brutalist para el panel: bordes gruesos, sombras sólidas,
// botones en mayúsculas que invierten colores al pasar el mouse e inputs con solo borde inferior.
// Las utilidades que no son componentes (cx, fecha, toast, useCarga…) están en lib.ts.
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import type { NivelRiesgo, SiglaNivel } from './api'
import { cx, NIVEL_MATRIZ, suscribirAvisos, type Aviso } from './lib'

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cx('icon text-[20px]', className)} aria-hidden>
      {name}
    </span>
  )
}

type Variante = 'primary' | 'dark' | 'ghost' | 'danger'
const VARIANTE: Record<Variante, string> = {
  primary: 'bg-yellow text-ink hover:bg-ink hover:text-yellow',
  dark: 'bg-ink text-white hover:bg-yellow hover:text-ink',
  ghost: 'bg-white text-ink hover:bg-ink hover:text-white',
  danger: 'bg-red text-white hover:bg-white hover:text-red',
}

export function Btn({
  variant = 'primary',
  icon,
  children,
  className,
  busy,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variante; icon?: string; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-2 border-2 border-ink px-4 py-2 font-headline text-sm font-bold tracking-wider uppercase shadow-hard-sm transition-colors active:translate-x-px active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTE[variant],
        className,
      )}
    >
      {busy ? <Icon name="progress_activity" className="animate-spin" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

export function Card({ children, className, title, icon, actions }: { children: ReactNode; className?: string; title?: string; icon?: string; actions?: ReactNode }) {
  return (
    <section className={cx('border-2 border-ink bg-white shadow-hard', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper-bright px-4 py-3">
          <h2 className="flex items-center gap-2 font-headline text-sm font-bold tracking-widest uppercase">
            {icon && <Icon name={icon} />}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function PageHeader({ title, kicker, actions }: { title: string; kicker?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-4 border-ink pb-4">
      <div>
        {kicker && <p className="font-headline text-xs font-bold tracking-[0.2em] text-muted uppercase">{kicker}</p>}
        <h1 className="font-headline text-4xl leading-none font-bold tracking-tight uppercase">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-block border-2 border-ink px-1.5 py-0.5 font-headline text-[10px] font-bold tracking-wider uppercase', className ?? 'bg-paper-high')}>{children}</span>
}

const NIVEL_RIESGO: Record<NivelRiesgo, { label: string; css: string }> = {
  critico: { label: 'Crítico', css: 'bg-red text-white' },
  alto: { label: 'Alto', css: 'bg-red-soft text-red' },
  medio: { label: 'Medio', css: 'bg-yellow' },
  bajo: { label: 'Bajo', css: 'bg-blue-soft' },
}

export const RiskTag = ({ nivel }: { nivel: NivelRiesgo | null | undefined }) =>
  nivel ? <Tag className={NIVEL_RIESGO[nivel].css}>{NIVEL_RIESGO[nivel].label}</Tag> : <span className="text-muted">—</span>

export function MatrizTag({ nivel }: { nivel: string | null }) {
  const n = nivel ? NIVEL_MATRIZ[nivel as SiglaNivel] : undefined
  return n ? <Tag className={n.css}>{n.nombre}</Tag> : <span className="text-muted">—</span>
}

const campo = 'w-full border-0 border-b-2 border-ink bg-transparent px-1 py-2 text-sm outline-none focus:border-blue focus:bg-paper-bright disabled:text-muted'

function Label({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-headline text-[11px] font-bold tracking-widest text-muted uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const Field = ({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) => (
  <Label label={label} hint={hint}>
    <input {...rest} className={campo} />
  </Label>
)

export const TextArea = ({ label, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) => (
  <Label label={label} hint={hint}>
    <textarea rows={3} {...rest} className={cx(campo, 'resize-y')} />
  </Label>
)

export const Select = ({ label, hint, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) => (
  <Label label={label} hint={hint}>
    <select {...rest} className={cx(campo, 'cursor-pointer')}>
      {children}
    </select>
  </Label>
)

export function Check({ label, sub, checked, onChange, disabled }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cx('flex items-start gap-3 border-2 border-ink p-3', checked ? 'bg-yellow' : 'bg-white', disabled ? 'opacity-60' : 'cursor-pointer hover:bg-paper-bright')}>
      <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
    </label>
  )
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 p-8 font-headline text-sm tracking-widest text-muted uppercase">
      <Icon name="progress_activity" className="animate-spin" />
      {label}
    </div>
  )
}

export function Empty({ icon = 'inbox', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="border-2 border-dashed border-ink bg-paper-bright p-8 text-center">
      <Icon name={icon} className="text-[40px]" />
      <p className="mt-2 font-headline font-bold tracking-wider uppercase">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <div className="flex items-start gap-2 border-2 border-red bg-red-soft p-3 text-sm text-red">
      <Icon name="error" />
      {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('w-full border-2 border-ink bg-paper shadow-hard-lg', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <header className="flex items-center justify-between border-b-2 border-ink bg-yellow px-4 py-3">
          <h2 className="font-headline font-bold tracking-widest uppercase">{title}</h2>
          <button onClick={onClose} className="hover:text-red" aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Avisos emitidos con `toast` (lib.ts); se monta una vez en main.tsx. */
export function Toasts() {
  const [lista, setLista] = useState<Aviso[]>([])
  useEffect(() => {
    suscribirAvisos((a) => {
      setLista((l) => [...l, a])
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), a.error ? 6000 : 3000)
    })
    return () => suscribirAvisos(null)
  }, [])
  return (
    <div className="no-print fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
      {lista.map((a) => (
        <div key={a.id} className={cx('flex items-start gap-2 border-2 border-ink p-3 text-sm font-semibold shadow-hard', a.error ? 'bg-red text-white' : 'bg-yellow')}>
          <Icon name={a.error ? 'error' : 'check_circle'} />
          {a.texto}
        </div>
      ))}
    </div>
  )
}
