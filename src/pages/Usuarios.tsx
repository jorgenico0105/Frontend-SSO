import { useState } from 'react'
import { Link } from 'react-router'
import { api, nombre, type Perfil } from '../api'
import { Btn, Card, Empty, ErrorBox, Icon, PageHeader, Select, Spinner, Tag } from '../ui'
import { fecha, useCarga } from '../lib'

const PERFIL_TAG: Record<Perfil, { label: string; css: string }> = {
  ADMINISTRADOR: { label: 'Admin. general', css: 'bg-red text-white' },
  ADMIN_EMPRESA: { label: 'Admin. empresa', css: 'bg-blue text-white' },
  USUARIO: { label: 'Técnico', css: 'bg-paper-high' },
}

export default function Usuarios() {
  const usuarios = useCarga(() => api.usuarios(), [])
  const empresas = useCarga(() => api.empresas(), [])
  const [buscar, setBuscar] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [estado, setEstado] = useState('activos')

  const q = buscar.trim().toLowerCase()
  const lista = (usuarios.datos ?? []).filter(
    (u) =>
      (!q || `${u.nombres} ${u.apellidos} ${u.email} ${u.cargo ?? ''}`.toLowerCase().includes(q)) &&
      (!empresa || u.empresas.some((e) => e.id === Number(empresa))) &&
      (estado === 'todos' || u.activo === (estado === 'activos')),
  )

  return (
    <>
      <PageHeader
        kicker="Administración"
        title="Usuarios"
        actions={
          <Link to="/usuarios/nuevo">
            <Btn icon="person_add">Nuevo usuario</Btn>
          </Link>
        }
      />
      <div className="mb-4 grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div className="flex items-end gap-2 border-b-2 border-ink bg-white px-2">
          <Icon name="search" className="mb-2" />
          <input className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Buscar por nombre, correo o cargo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <Select label="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Todas</option>
          {empresas.datos?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razonSocial}
            </option>
          ))}
        </Select>
        <Select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </Select>
      </div>
      <ErrorBox error={usuarios.error} />
      {!usuarios.datos && !usuarios.error && <Spinner />}
      {usuarios.datos && lista.length === 0 && <Empty icon="group" title="No hay usuarios con esos filtros" />}
      {lista.length > 0 && (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink bg-paper-bright font-headline text-[11px] tracking-widest uppercase">
              <tr>
                <th className="p-3">Usuario</th>
                <th className="p-3">Perfil</th>
                <th className="p-3">Empresas</th>
                <th className="p-3">Módulos</th>
                <th className="p-3">Último acceso</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-paper-high">
              {lista.map((u) => (
                <tr key={u.id} className={u.activo ? 'hover:bg-paper-bright' : 'bg-paper-high/50 text-muted'}>
                  <td className="p-3">
                    <Link to={`/usuarios/${u.id}`} className="font-semibold hover:text-blue hover:underline">
                      {nombre(u)}
                    </Link>
                    <p className="text-xs text-muted">
                      {u.email}
                      {u.cargo ? ` · ${u.cargo}` : ''}
                    </p>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <Tag className={PERFIL_TAG[u.perfil].css}>{PERFIL_TAG[u.perfil].label}</Tag>
                      {!u.activo && <Tag className="bg-red text-white">Inactivo</Tag>}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {u.perfil === 'ADMINISTRADOR' ? 'Todas' : u.empresas.map((e) => e.razonSocial).join(', ') || '—'}
                    {u.compartido && <span className="block text-muted">+ otras empresas</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {u.perfil === 'ADMINISTRADOR' ? (
                        <Tag className="bg-yellow">Todos</Tag>
                      ) : (
                        u.featureCodigos.map((f) => (
                          <Tag key={f} className="bg-yellow">
                            {f}
                          </Tag>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-xs">{fecha(u.ultimoAcceso, true)}</td>
                  <td className="p-3">
                    <Link to={`/usuarios/${u.id}`} aria-label="Editar" className="hover:text-blue">
                      <Icon name="chevron_right" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
