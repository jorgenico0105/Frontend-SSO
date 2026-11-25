import { Link } from 'react-router'
import { api } from '../api'
import { useYo } from '../session'
import { Empty, ErrorBox, Icon, PageHeader, Spinner } from '../ui'
import { fecha, useCarga } from '../lib'

/** Una carpeta por empresa visible para el usuario. */
export default function Archivo() {
  const { gestor } = useYo()
  const { datos, error } = useCarga(() => api.empresas(), [])
  return (
    <>
      <PageHeader kicker="Carpetas" title="Archivo" />
      <p className="mb-6 text-sm text-muted">
        {gestor
          ? 'Matrices de riesgo, reportes de actos y condiciones, evaluaciones ergonómicas y permisos de trabajo de cada empresa.'
          : 'Tus matrices, reportes, evaluaciones ergonómicas y permisos de trabajo, organizados por empresa. Solo ves lo que tú registraste.'}
      </p>
      <ErrorBox error={error} />
      {!datos && !error && <Spinner />}
      {datos?.length === 0 && <Empty icon="folder_off" title="No tienes empresas asignadas" />}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {datos?.map((e) => (
          <Link key={e.id} to={`/archivo/${e.id}`} className="group block">
            {/* Pestaña de carpeta */}
            <div className="ml-3 h-4 w-24 border-2 border-b-0 border-ink bg-yellow" />
            <div className="border-2 border-ink bg-white p-4 shadow-hard transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-hard-lg">
              <div className="flex items-center gap-3">
                <Icon name="folder" className="text-[36px]" />
                <div className="min-w-0">
                  <p className="truncate font-headline text-lg font-bold uppercase">{e.nombreComercial || e.razonSocial}</p>
                  <p className="text-xs text-muted">Última actividad: {fecha(e.resumen?.ultimaActividad)}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
