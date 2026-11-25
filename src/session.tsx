import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, esGestor, onSesionExpirada, token, type Yo } from './api'

interface Sesion {
  /** `undefined` mientras se restaura la sesión guardada. */
  yo: Yo | null | undefined
  /** Administrador general: todas las empresas, clasificaciones, crear empresas. */
  esAdmin: boolean
  /** Administrador general o de empresa: usuarios, áreas y puestos. */
  gestor: boolean
  entrar: (email: string, password: string) => Promise<void>
  salir: () => void
  refrescar: () => Promise<void>
}

const Ctx = createContext<Sesion | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  // Sin token guardado no hay nada que restaurar.
  const [yo, setYo] = useState<Yo | null | undefined>(() => (token.get() ? undefined : null))

  const salir = useCallback(() => {
    token.set(null)
    setYo(null)
  }, [])

  const refrescar = useCallback(async () => setYo(await api.yo()), [])

  useEffect(() => {
    onSesionExpirada(salir)
    if (token.get()) api.yo().then(setYo, salir)
  }, [salir])

  const entrar = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password)
    token.set(r.token)
    setYo(r.usuario)
  }, [])

  const valor = useMemo<Sesion>(
    () => ({
      yo,
      esAdmin: yo?.perfil === 'ADMINISTRADOR',
      gestor: !!yo && esGestor(yo.perfil),
      entrar,
      salir,
      refrescar,
    }),
    [yo, entrar, salir, refrescar],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

// oxlint-disable-next-line react/only-export-components -- hook del contexto, junto a su provider
export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession fuera de SessionProvider')
  return s
}

/** Sesión con usuario garantizado (solo bajo el layout autenticado). */
// oxlint-disable-next-line react/only-export-components
export function useYo() {
  const s = useSession()
  if (!s.yo) throw new Error('useYo sin sesión')
  return { ...s, yo: s.yo }
}
