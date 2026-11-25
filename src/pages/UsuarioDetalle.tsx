import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, type Perfil, type Usuario, type UsuarioInput } from '../api'
import { useYo } from '../session'
import { Btn, Card, Check, ErrorBox, Field, Icon, PageHeader, Select, Spinner } from '../ui'
import { toast, useCarga } from '../lib'

const CAMPOS: { k: keyof UsuarioInput; label: string; tipo?: string; req?: boolean }[] = [
  { k: 'nombres', label: 'Nombres *', req: true },
  { k: 'apellidos', label: 'Apellidos' },
  { k: 'email', label: 'Correo *', tipo: 'email', req: true },
  { k: 'cedula', label: 'Cédula' },
  { k: 'telefono', label: 'Teléfono' },
  { k: 'cargo', label: 'Cargo', tipo: 'text' },
  { k: 'licencia', label: 'Registro / licencia SST' },
]

const AYUDA: Record<Perfil, string> = {
  USUARIO: 'Técnico de campo: usa los módulos marcados en las empresas asignadas y solo ve los registros que él mismo crea.',
  ADMIN_EMPRESA: 'Administra usuarios, áreas y puestos de las empresas asignadas y ve todos sus registros. Usa los módulos marcados.',
  ADMINISTRADOR: 'Administrador general: acceso total a todas las empresas, módulos, usuarios y clasificaciones.',
}

export default function UsuarioDetalle() {
  const param = useParams().id!
  const usuario = useCarga<Usuario | null>(() => (param === 'nuevo' ? Promise.resolve(null) : api.usuario(Number(param))), [param])
  if (usuario.error) return <ErrorBox error={usuario.error} />
  if (usuario.datos === undefined) return <Spinner />
  // El formulario se monta con los datos ya cargados; `key` lo reinicia al cambiar de usuario.
  return <Formulario key={param} u={usuario.datos} onGuardado={usuario.setDatos} />
}

function Formulario({ u, onGuardado }: { u: Usuario | null; onGuardado: (u: Usuario) => void }) {
  const nuevo = !u
  const [query] = useSearchParams()
  const navigate = useNavigate()
  const { yo, esAdmin } = useYo()
  const empresas = useCarga(() => api.empresas(), [])
  const features = useCarga(() => api.features(), [])

  const [form, setForm] = useState<Record<string, string>>(() => (u ? Object.fromEntries(CAMPOS.map((c) => [c.k, String(u[c.k as keyof Usuario] ?? '')])) : {}))
  const [password, setPassword] = useState('')
  const [perfil, setPerfil] = useState<Perfil>(u?.perfil ?? 'USUARIO')
  const [activo, setActivo] = useState(u?.activo ?? true)
  const [empresaIds, setEmpresaIds] = useState<number[]>(() => (u ? u.empresas.map((e) => e.id) : query.get('empresa') ? [Number(query.get('empresa'))] : []))
  const [codigos, setCodigos] = useState<string[]>(u?.featureCodigos ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const propio = u?.id === yo.id
  // Quien también trabaja con otras empresas solo puede cambiarse de acceso a las del gestor.
  const soloAcceso = !esAdmin && !!u?.compartido
  const general = perfil === 'ADMINISTRADOR'
  // El ADMIN_EMPRESA solo otorga los módulos que él tiene.
  const otorgable = (codigo: string) => esAdmin || yo.features.some((f) => f.codigo === codigo)
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])

  const guardar = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setError(null)
    if (!general && !empresaIds.length && !esAdmin) {
      if (nuevo) {
        setError(new Error('Asigna al menos una empresa'))
        return
      }
      if (!window.confirm('Sin ninguna de tus empresas, este usuario dejará de aparecer en tu panel. ¿Continuar?')) return
    }
    setBusy(true)
    const datos: UsuarioInput = soloAcceso
      ? { empresaIds }
      : {
          ...Object.fromEntries(CAMPOS.map((c) => [c.k, (form[c.k] ?? '').trim()])),
          ...(password && { password }),
          ...(!propio && { perfil, activo }),
          ...(!general && { empresaIds, featureCodigos: codigos.filter(otorgable) }),
        }
    try {
      if (nuevo) {
        const creado = await api.crearUsuario(datos)
        toast.ok('Usuario creado')
        navigate(`/usuarios/${creado.id}`, { replace: true })
      } else {
        const r = await api.actualizarUsuario(u.id, datos)
        if (!r) {
          toast.ok('El usuario ya no tiene acceso a tus empresas')
          navigate('/usuarios', { replace: true })
          return
        }
        onGuardado(r)
        setPassword('')
        toast.ok('Cambios guardados')
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={guardar}>
      <Link to="/usuarios" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline">
        <Icon name="arrow_back" /> Usuarios
      </Link>
      <PageHeader
        kicker={nuevo ? 'Administración' : u?.email}
        title={nuevo ? 'Nuevo usuario' : `${u?.nombres} ${u?.apellidos}`.trim()}
        actions={
          <Btn type="submit" busy={busy} icon="save">
            {nuevo ? 'Crear usuario' : 'Guardar'}
          </Btn>
        }
      />
      {soloAcceso && (
        <p className="mb-6 flex items-start gap-2 border-2 border-ink bg-blue-soft p-3 text-sm">
          <Icon name="info" />
          Este usuario también trabaja con otras empresas. Solo puedes cambiar su acceso a tus empresas; sus datos, contraseña y módulos los gestiona el administrador general.
        </p>
      )}
      <div className="mb-6">
        <ErrorBox error={error} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Datos personales" icon="badge">
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <Field
                key={c.k}
                label={c.label}
                type={c.tipo ?? 'text'}
                required={c.req}
                disabled={soloAcceso}
                value={form[c.k] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))}
              />
            ))}
            <Field
              label={nuevo ? 'Contraseña *' : 'Nueva contraseña'}
              type="password"
              autoComplete="new-password"
              required={nuevo}
              disabled={soloAcceso}
              placeholder={nuevo ? '' : 'Vacío = mantener la actual'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </Card>

        <Card title="Perfil y estado" icon="admin_panel_settings">
          <div className="space-y-4">
            <Select label="Perfil" value={perfil} disabled={soloAcceso || propio} onChange={(e) => setPerfil(e.target.value as Perfil)}>
              <option value="USUARIO">Técnico SST</option>
              <option value="ADMIN_EMPRESA">Administrador de empresa</option>
              {(esAdmin || perfil === 'ADMINISTRADOR') && <option value="ADMINISTRADOR">Administrador general</option>}
            </Select>
            <p className="text-sm text-muted">{AYUDA[perfil]}</p>
            {propio && <p className="text-xs text-muted">No puedes cambiar tu propio perfil ni desactivarte.</p>}
            <Check label="Usuario activo" sub="Los inactivos no pueden iniciar sesión" checked={activo} disabled={soloAcceso || propio} onChange={setActivo} />
          </div>
        </Card>

        {!general && (
          <>
            <Card title={`Empresas (${empresaIds.length})`} icon="apartment">
              <ErrorBox error={empresas.error} />
              {!empresas.datos ? (
                <Spinner />
              ) : (
                <div className="grid gap-2">
                  {empresas.datos.map((e) => (
                    <Check key={e.id} label={e.razonSocial} sub={`RUC ${e.ruc}`} checked={empresaIds.includes(e.id)} onChange={() => setEmpresaIds((l) => alternar(l, e.id))} />
                  ))}
                </div>
              )}
              {u?.compartido && <p className="mt-3 text-xs text-muted">Sus otras empresas no se muestran y se conservan.</p>}
            </Card>
            <Card title={`Módulos (${codigos.length})`} icon="apps">
              <ErrorBox error={features.error} />
              {!features.datos ? (
                <Spinner />
              ) : (
                <div className="grid gap-2">
                  {features.datos.map((f) => (
                    <Check
                      key={f.codigo}
                      label={f.nombre}
                      sub={otorgable(f.codigo) ? (f.descripcion ?? f.codigo) : 'No lo tienes habilitado: no puedes otorgarlo'}
                      checked={codigos.includes(f.codigo)}
                      disabled={soloAcceso || !otorgable(f.codigo)}
                      onChange={() => setCodigos((l) => alternar(l, f.codigo))}
                    />
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </form>
  )
}
