import { Link } from 'react-router'
import { api, type Empresa, type Usuario } from '../api'
import { useYo } from '../session'
import { Card, Empty, ErrorBox, Icon, PageHeader, Spinner, Tag } from '../ui'
import { fecha, useCarga } from '../lib'

function Dato({ valor, label, alerta }: { valor: number | string; label: string; alerta?: boolean }) {
  return (
    <div className={alerta ? 'bg-red p-3 text-white' : 'bg-paper-bright p-3'}>
      <p className="font-headline text-3xl leading-none font-bold">{valor}</p>
      <p className="mt-1 font-headline text-[10px] font-bold tracking-widest uppercase">{label}</p>
    </div>
  )
}

export default function Inicio() {
  const { yo, gestor } = useYo()
  const empresas = useCarga(() => api.empresas(), [])
  const usuarios = useCarga<Usuario[]>(() => (gestor ? api.usuarios() : Promise.resolve([])), [gestor])

  const lista: Empresa[] = empresas.datos ?? []
  const total = (k: 'reportesHoy' | 'hallazgosPendientes') => lista.reduce((a, e) => a + (e.resumen?.[k] ?? 0), 0)

  return (
    <>
      <PageHeader kicker={`Hola, ${yo.nombres}`} title="Resumen" />
      {!gestor && (
        <p className="mb-6 flex items-center gap-2 border-2 border-ink bg-blue-soft p-3 text-sm">
          <Icon name="lock" />
          Aquí ves solo la información que tú registraste en las empresas que tienes asignadas.
        </p>
      )}
      <ErrorBox error={empresas.error} />
      {!empresas.datos && !empresas.error && <Spinner />}

      {empresas.datos && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <Dato valor={lista.length} label="Empresas" />
            </Card>
            <Card>
              <Dato valor={total('reportesHoy')} label="Reportes hoy" />
            </Card>
            <Card>
              <Dato valor={total('hallazgosPendientes')} label="Hallazgos altos (30 días)" alerta={total('hallazgosPendientes') > 0} />
            </Card>
            <Card>
              <Dato valor={gestor ? (usuarios.datos?.filter((u) => u.activo).length ?? '…') : yo.features.length} label={gestor ? 'Usuarios activos' : 'Módulos habilitados'} />
            </Card>
          </div>

          <h2 className="mb-3 font-headline text-xl font-bold uppercase">Empresas</h2>
          {lista.length === 0 ? (
            <Empty icon="apartment" title="Sin empresas asignadas">
              Pide al administrador que te asigne una empresa.
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {lista.map((e) => (
                <Card key={e.id}>
                  <div className="flex items-start gap-3">
                    {e.logoUrl ? (
                      <img src={e.logoUrl} alt="" className="size-14 border-2 border-ink bg-white object-contain" />
                    ) : (
                      <div className="flex size-14 items-center justify-center border-2 border-ink bg-yellow">
                        <Icon name="apartment" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-headline text-lg font-bold uppercase">{e.nombreComercial || e.razonSocial}</p>
                      <p className="text-xs text-muted">
                        RUC {e.ruc} · {e.areas.length} áreas · {e.puestos.length} puestos
                      </p>
                      <p className="mt-1 text-xs text-muted">Última actividad: {fecha(e.resumen?.ultimaActividad, true)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Tag className="bg-yellow">Hoy: {e.resumen?.reportesHoy ?? 0}</Tag>
                    <Tag>Ayer: {e.resumen?.reportesAyer ?? 0}</Tag>
                    {!!e.resumen?.hallazgosPendientes && <Tag className="bg-red text-white">Altos/críticos: {e.resumen.hallazgosPendientes}</Tag>}
                    <span className="flex-1" />
                    <Link to={`/archivo/${e.id}`} className="font-headline text-xs font-bold tracking-wider text-blue uppercase hover:underline">
                      Archivo →
                    </Link>
                    {gestor && (
                      <Link to={`/empresas/${e.id}`} className="font-headline text-xs font-bold tracking-wider text-blue uppercase hover:underline">
                        Administrar →
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
