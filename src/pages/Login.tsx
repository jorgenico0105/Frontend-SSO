import { useState } from 'react'
import { Navigate } from 'react-router'
import { Marca } from '../layout'
import { useSession } from '../session'
import { Btn, ErrorBox, Field } from '../ui'

export default function Login() {
  const { yo, entrar } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (yo) return <Navigate to="/" replace />

  const enviar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await entrar(email, password)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between border-r-4 border-ink bg-ink p-12 text-white lg:flex">
        <div className="size-16 bg-yellow" />
        <div>
          <p className="font-headline text-6xl leading-[0.9] font-bold uppercase">
            Seguridad
            <br />y salud
            <br />
            <span className="text-yellow">en el trabajo</span>
          </p>
          <p className="mt-6 max-w-md text-paper-high">Administra empresas, usuarios y el archivo de matrices, reportes, evaluaciones ergonómicas y permisos de trabajo.</p>
        </div>
        <div className="flex gap-3">
          <div className="size-6 rounded-full bg-red" />
          <div className="size-6 bg-blue" />
          <div className="size-6 bg-yellow" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={enviar} className="w-full max-w-sm border-2 border-ink bg-white p-8 shadow-hard-lg">
          <Marca grande />
          <h1 className="mt-8 font-headline text-3xl font-bold uppercase">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted">Usa la misma cuenta que en la app móvil.</p>
          <div className="mt-6 space-y-4">
            <Field label="Correo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <ErrorBox error={error} />
            <Btn type="submit" busy={busy} className="w-full" icon="login">
              Entrar
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
