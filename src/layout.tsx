import { useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router'
import { api } from './api'
import { useSession } from './session'
import { Btn, ErrorBox, Icon, Spinner } from './ui'
import { cx } from './lib'

const PERFIL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador general',
  ADMIN_EMPRESA: 'Administrador de empresa',
  USUARIO: 'Técnico SST',
}

export function Marca({ grande }: { grande?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cx('flex items-center justify-center border-2 border-ink bg-yellow shadow-hard-sm', grande ? 'size-12' : 'size-9')}>
        <Icon name="warning" className={grande ? 'text-[28px]' : ''} />
      </span>
      <div className="leading-none">
        <p className={cx('font-headline font-bold tracking-tight uppercase', grande ? 'text-2xl' : 'text-base')}>SST Prevención</p>
        <p className="font-headline text-[10px] font-bold tracking-[0.25em] text-muted uppercase">Panel web</p>
      </div>
    </div>
  )
}

/** Layout autenticado: menú lateral según el perfil y aceptación de términos vigente. */
export function Layout() {
  const { yo, esAdmin, gestor, puede, salir } = useSession()
  if (yo === undefined) return <Spinner label="Restaurando sesión…" />
  if (!yo) return <Navigate to="/login" replace />
  if (!yo.legal.aceptada) return <Terminos />

  const menu = [
    { to: '/', icon: 'dashboard', label: 'Inicio', end: true },
    { to: '/archivo', icon: 'folder_open', label: 'Archivo' },
    ...(puede('AGENDA') ? [{ to: '/agenda', icon: 'calendar_month', label: 'Agenda' }] : []),
    ...(puede('FINANZAS') ? [{ to: '/finanzas', icon: 'payments', label: 'Finanzas' }] : []),
    ...(gestor
      ? [
          { to: '/empresas', icon: 'apartment', label: 'Empresas' },
          { to: '/usuarios', icon: 'group', label: 'Usuarios' },
        ]
      : []),
    ...(esAdmin ? [{ to: '/clasificaciones', icon: 'category', label: 'Clasificaciones' }] : []),
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r-4 border-ink bg-paper-bright">
        <div className="border-b-2 border-ink p-4">
          <Marca />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 border-2 px-3 py-2 font-headline text-sm font-bold tracking-wider uppercase',
                  isActive ? 'border-ink bg-yellow shadow-hard-sm' : 'border-transparent hover:border-ink hover:bg-white',
                )
              }
            >
              <Icon name={m.icon} />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t-2 border-ink p-4">
          <p className="truncate text-sm font-semibold">
            {yo.nombres} {yo.apellidos}
          </p>
          <p className="truncate text-xs text-muted">{yo.email}</p>
          <p className="mt-1 font-headline text-[10px] font-bold tracking-widest text-blue uppercase">{PERFIL[yo.perfil]}</p>
          <Btn variant="ghost" icon="logout" className="mt-3 w-full" onClick={salir}>
            Salir
          </Btn>
        </div>
      </aside>
      <main className="print-plain min-w-0 flex-1 p-8">
        <div className="print-plain mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function Terminos() {
  const { refrescar, salir } = useSession()
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const aceptar = async () => {
    setBusy(true)
    try {
      await api.aceptarTerminos()
      await refrescar()
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg border-2 border-ink bg-white p-6 shadow-hard-lg">
        <Marca />
        <h1 className="mt-6 font-headline text-2xl font-bold uppercase">Términos y privacidad</h1>
        <p className="mt-2 text-sm text-muted">Para continuar, acepta la versión vigente de los términos de uso y la política de privacidad.</p>
        <div className="mt-4 flex gap-4 text-sm font-semibold">
          <a className="text-blue underline" href="/terminos" target="_blank" rel="noreferrer">
            Términos de uso
          </a>
          <a className="text-blue underline" href="/privacidad" target="_blank" rel="noreferrer">
            Política de privacidad
          </a>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          He leído y acepto los términos de uso y la política de privacidad.
        </label>
        <div className="mt-4">
          <ErrorBox error={error} />
        </div>
        <div className="mt-6 flex justify-between gap-2">
          <Btn variant="ghost" onClick={salir}>
            Salir
          </Btn>
          <Btn disabled={!ok} busy={busy} onClick={aceptar} icon="check">
            Aceptar y continuar
          </Btn>
        </div>
      </div>
    </div>
  )
}

/** Rutas solo para administradores; el backend igual las rechaza (403). */
export function SoloGestor({ admin }: { admin?: boolean }) {
  const { esAdmin, gestor } = useSession()
  return (admin ? esAdmin : gestor) ? <Outlet /> : <Navigate to="/" replace />
}

/** Ruta de un módulo (feature): sin él vuelve al inicio. El backend también lo exige. */
export function ConModulo({ codigo }: { codigo: string }) {
  const { puede } = useSession()
  return puede(codigo) ? <Outlet /> : <Navigate to="/" replace />
}
