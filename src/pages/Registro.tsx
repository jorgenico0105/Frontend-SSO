import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { api, nombre, type Accidente, type Ergo, type Matriz, type Permiso, type Reporte, type TipoArchivo } from '../api'
import { Btn, Card, ErrorBox, Icon, MatrizTag, RiskTag, Spinner, Tag } from '../ui'
import { cx, fecha, NIVEL_MATRIZ, TIPO, useCarga } from '../lib'

type Registro =
  | { tipo: 'reporte'; r: Reporte }
  | { tipo: 'ergo'; r: Ergo }
  | { tipo: 'matriz'; r: Matriz }
  | { tipo: 'permiso'; r: Permiso }
  | { tipo: 'accidente'; r: Accidente }

async function cargar(tipo: TipoArchivo, id: number): Promise<Registro> {
  switch (tipo) {
    case 'reporte':
      return { tipo, r: await api.reporte(id) }
    case 'ergo':
      return { tipo, r: await api.ergo(id) }
    case 'matriz':
      return { tipo, r: await api.matriz(id) }
    case 'permiso':
      return { tipo, r: await api.permiso(id) }
    case 'accidente':
      return { tipo, r: await api.accidente(id) }
  }
}

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="font-headline text-[10px] font-bold tracking-widest text-muted uppercase">{label}</dt>
    <dd className="mt-0.5 min-w-0 text-sm">{children || '—'}</dd>
  </div>
)

/** Foto del reporte; si no carga (URL vencida o de prueba), un aviso en vez de una imagen rota. */
function Evidencia({ url }: { url: string | null }) {
  const [rota, setRota] = useState(false)
  if (!url || rota)
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-2 border-dashed border-ink bg-paper-bright p-6 text-center text-sm text-muted">
        <Icon name="image_not_supported" className="text-[36px]" />
        No se pudo cargar la foto de evidencia
      </div>
    )
  return <img src={url} alt="Evidencia" onError={() => setRota(true)} className="w-full min-w-0 border-2 border-ink object-contain" />
}

const Lista = ({ items }: { items: string[] | null | undefined }) =>
  items?.length ? (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted">—</p>
  )

function VistaReporte({ r }: { r: Reporte }) {
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
      <Evidencia url={r.imagenUrl} />
      <div className="min-w-0 space-y-4">
        <dl className="grid grid-cols-2 gap-4">
          <Dato label="Tipo">{r.tipo === 'condicion' ? 'Condición subestándar' : 'Acto subestándar'}</Dato>
          <Dato label="Severidad">
            <RiskTag nivel={r.severidad} />
          </Dato>
        </dl>
        <Dato label="Clasificaciones">
          <div className="flex flex-wrap gap-1">
            {r.clasificaciones?.map((c) => (
              <Tag key={c} className="bg-yellow">
                {c}
              </Tag>
            ))}
          </div>
        </Dato>
        <Dato label="Descripción">
          <p className="whitespace-pre-line">{r.descripcion}</p>
        </Dato>
        <Dato label="Acción correctiva">
          <p className="whitespace-pre-line">{r.accionCorrectiva}</p>
        </Dato>
      </div>
    </div>
  )
}

function VistaErgo({ r }: { r: Ergo }) {
  const criticos = (r.puntos ?? []).filter((p) => p.critico).slice(0, 6)
  return (
    <div className="space-y-6">
      {r.estado === 'PROCESANDO' && <p className="border-2 border-ink bg-yellow p-3 text-sm font-semibold">El video sigue en análisis ({Math.round(r.progreso)}%).</p>}
      {r.errorMensaje && <ErrorBox error={r.errorMensaje} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['RULA', r.puntajeRula, 7],
          ['REBA', r.puntajeReba, 15],
          ['OWAS', r.puntajeOwas, 4],
        ].map(([m, v, max]) => (
          <div key={m as string} className="border-2 border-ink bg-paper-bright p-3">
            <p className="font-headline text-[10px] font-bold tracking-widest uppercase">{m}</p>
            <p className="font-headline text-3xl font-bold">
              {v ?? '—'}
              <span className="text-sm text-muted">/{max}</span>
            </p>
          </div>
        ))}
        <div className="border-2 border-ink bg-paper-bright p-3">
          <p className="font-headline text-[10px] font-bold tracking-widest uppercase">Nivel</p>
          <div className="mt-2">
            <RiskTag nivel={r.nivelRiesgo} />
          </div>
        </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Dato label="Puesto">{r.puesto?.nombre}</Dato>
        <Dato label="Medio">{r.medio === 'imagen' ? 'Imagen' : `Video${r.duracionSeg ? ` · ${Math.round(r.duracionSeg)} s` : ''}`}</Dato>
        <Dato label="Archivo">{r.nombreArchivo}</Dato>
      </dl>
      <Dato label="Diagnóstico">
        <p className="whitespace-pre-line">{r.diagnostico}</p>
      </Dato>
      <Dato label="Recomendaciones">
        <Lista items={r.recomendaciones} />
      </Dato>
      {!!r.advertencias?.length && (
        <Dato label="Advertencias">
          <Lista items={r.advertencias} />
        </Dato>
      )}
      {criticos.length > 0 && (
        <Dato label="Momentos críticos">
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
            {criticos.map((p) => (
              <figure key={p.segundo} className="border-2 border-ink bg-white">
                <img src={p.imagenUrl} alt="" className="aspect-video w-full object-cover" />
                <figcaption className="p-2 text-xs">
                  {p.segundo.toFixed(1)} s · RULA {p.rula ?? '—'} · REBA {p.reba ?? '—'}
                </figcaption>
              </figure>
            ))}
          </div>
        </Dato>
      )}
      <p className="text-xs text-muted">El informe completo con el esqueleto sobre cada fotograma se exporta desde la app.</p>
    </div>
  )
}

function VistaMatriz({ r }: { r: Matriz }) {
  const c = r.cabecera
  return (
    <div className="space-y-6">
      {r.faltantes.length > 0 && (
        <div className="border-2 border-ink bg-yellow p-3 text-sm">
          <p className="font-headline font-bold uppercase">Borrador: faltan {r.faltantes.length} datos</p>
          <Lista items={r.faltantes.map((f) => f.mensaje)} />
        </div>
      )}
      <dl className="grid gap-4 sm:grid-cols-4">
        <Dato label="Departamento">{c.departamento}</Dato>
        <Dato label="Puesto">{c.puesto}</Dato>
        <Dato label="Provincia / cantón">{[c.provincia, c.canton].filter(Boolean).join(' / ')}</Dato>
        <Dato label="Exposición">{c.tiempoExposicionHoras != null ? `${c.tiempoExposicionHoras} h/día` : ''}</Dato>
        <Dato label="Trabajadores">
          H {c.trabajadores.hombres ?? '—'} · M {c.trabajadores.mujeres ?? '—'} · Disc. {c.trabajadores.discapacitados ?? '—'}
        </Dato>
        <Dato label="Responsable directo">{c.responsableDirecto}</Dato>
        <Dato label="Responsable SSO">{c.responsableSso}</Dato>
      </dl>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato label="Actividades rutinarias">{c.actividadesRutinarias}</Dato>
        <Dato label="Actividades no rutinarias">{c.actividadesNoRutinarias}</Dato>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full border-2 border-ink text-left text-sm">
          <thead className="bg-ink font-headline text-[10px] tracking-widest text-white uppercase">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Peligro</th>
              <th className="p-2">P</th>
              <th className="p-2">C</th>
              <th className="p-2">Estimación</th>
              <th className="p-2">Medida</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-paper-high">
            {r.peligros.map((p) => (
              <tr key={p.codigo} className="align-top">
                <td className="p-2 font-headline font-bold">{p.codigo}</td>
                <td className="p-2">
                  {p.nombre}
                  {p.especificacion && <span className="block text-xs text-muted">{p.especificacion}</span>}
                </td>
                <td className="p-2">{p.probabilidad}</td>
                <td className="p-2">{p.consecuencia}</td>
                <td className="p-2">
                  <MatrizTag nivel={p.nivel} />
                </td>
                <td className="p-2">{p.medida}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(NIVEL_MATRIZ).map(([s, n]) => (
          <span key={s} className="flex items-center gap-1">
            <Tag className={n.css}>{s}</Tag> {n.nombre}
          </span>
        ))}
      </div>
      {r.planAccion.length > 0 && (
        <Dato label="Plan de acción">
          <table className="mt-2 w-full border-2 border-ink text-left text-sm">
            <thead className="bg-paper-high font-headline text-[10px] tracking-widest uppercase">
              <tr>
                <th className="p-2">Código</th>
                <th className="p-2">Acción</th>
                <th className="p-2">Responsable</th>
                <th className="p-2">Plazo</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-paper-high">
              {r.planAccion.map((a) => (
                <tr key={a.codigo} className="align-top">
                  <td className="p-2 font-headline font-bold">{a.codigo}</td>
                  <td className="p-2">{a.accion}</td>
                  <td className="p-2">{a.responsable}</td>
                  <td className="p-2 whitespace-nowrap">
                    {fecha(a.fechaInicio)} → {fecha(a.fechaFin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dato>
      )}
    </div>
  )
}

function VistaPermiso({ r }: { r: Permiso }) {
  const d = r.datos ?? {}
  const personal = (d.personal ?? []).filter((p) => p.nombre?.trim())
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Dato label="Inicio">{fecha(r.fechaInicio, true)}</Dato>
        <Dato label="Fin">{fecha(r.fechaFin, true)}</Dato>
        <Dato label="Trabajos especiales">
          <div className="flex flex-wrap gap-1">
            {r.especiales.map((e) => (
              <Tag key={e} className="bg-yellow">
                {e}
              </Tag>
            ))}
          </div>
        </Dato>
      </dl>
      <Dato label="Descripción del trabajo">
        <p className="whitespace-pre-line">{r.descripcion}</p>
      </Dato>
      <Dato label="Personal involucrado">
        <Lista items={personal.map((p) => [p.nombre, p.cedula, p.cargo].filter(Boolean).join(' · '))} />
      </Dato>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Dato label="Jefe / encargado">{d.aprobacion?.jefe}</Dato>
        <Dato label="Administrador">{d.aprobacion?.administrador}</Dato>
        <Dato label="Responsable SSO">{d.aprobacion?.responsableSso}</Dato>
        <Dato label="Autorizado">{r.autorizadoEn ? `${fecha(r.autorizadoEn, true)} · ${nombre(r.autorizadoPor)}` : ''}</Dato>
        <Dato label="Cerrado">{r.cerradoEn ? `${fecha(r.cerradoEn, true)} · ${nombre(r.cerradoPor)}` : ''}</Dato>
        <Dato label="Área limpia">{d.cierre?.areaLimpia == null ? '' : d.cierre.areaLimpia ? 'Sí' : 'No'}</Dato>
      </dl>
      <Dato label="Informe de trabajos realizados">
        <p className="whitespace-pre-line">{d.informe}</p>
      </Dato>
      <p className="text-xs text-muted">El formato completo RSE-16-00-01 con el ART se exporta desde la app.</p>
    </div>
  )
}

const Seccion = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <section>
    <h2 className="mb-2 bg-ink px-2 py-1 font-headline text-xs font-bold tracking-widest text-white uppercase">{titulo}</h2>
    {children}
  </section>
)

function VistaAccidente({ r }: { r: Accidente }) {
  const d = r.datos
  const evento = d.tipoEvento === 'incidente' ? 'incidente' : 'accidente'
  return (
    <div className="space-y-6">
      {r.faltantes.length > 0 && (
        <div className="border-2 border-ink bg-yellow p-3 text-sm">
          <p className="font-headline font-bold uppercase">Borrador: faltan {r.faltantes.length} datos</p>
          <Lista items={r.faltantes.map((f) => f.mensaje)} />
        </div>
      )}
      <Seccion titulo="1. Datos de la investigación">
        <p className="mb-3 text-xs text-muted">La investigación se ha dirigido a fines exclusivamente preventivos y no a la determinación de responsabilidades legales o de cualquier otra índole.</p>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato label="Técnico que investiga">{d.investigador.nombre}</Dato>
          <Dato label="Cédula">{d.investigador.cedula}</Dato>
          <Dato label="Competencia">{d.investigador.competencia}</Dato>
          <Dato label="Fecha de investigación">{fecha(d.fechaInvestigacion)}</Dato>
          <Dato label="Personas entrevistadas">
            <Lista items={d.entrevistados} />
          </Dato>
          <Dato label="Técnicas y aparatos">{d.tecnicas}</Dato>
        </dl>
      </Seccion>
      <Seccion titulo="2. Datos del trabajador/es accidentado">
        <div className="grid gap-3 sm:grid-cols-2">
          {d.trabajadores.map((t, i) => (
            <dl key={i} className="grid gap-2 border-2 border-ink p-3">
              <p className="font-headline text-xs font-bold uppercase">Trabajador {i + 1}</p>
              <Dato label="Nombre y apellidos">{t.nombre}</Dato>
              <Dato label="Fecha de nacimiento">{fecha(t.fechaNacimiento)}</Dato>
              <Dato label="Ocupación">{t.ocupacion}</Dato>
              <Dato label="Resultado">{t.resultado}</Dato>
            </dl>
          ))}
        </div>
      </Seccion>
      <Seccion titulo="3. Introducción">
        <p className="mb-3 text-sm whitespace-pre-line">{d.introduccion || '—'}</p>
        <dl className="grid gap-4 sm:grid-cols-4">
          <Dato label="Empresa">{r.empresa.razonSocial}</Dato>
          <Dato label="Lugar">{d.lugar}</Dato>
          <Dato label="Fecha">{fecha(d.fecha)}</Dato>
          <Dato label="Hora">{d.hora && `Aprox. ${d.hora}`}</Dato>
        </dl>
      </Seccion>
      <Seccion titulo={`4. Consecuencia del ${evento}`}>
        <p className="text-sm font-semibold">{d.consecuencia || '—'}</p>
      </Seccion>
      <Seccion titulo={`5. Descripción del ${evento}`}>
        <p className="text-sm leading-relaxed whitespace-pre-line">{d.descripcion || '—'}</p>
      </Seccion>
      <Seccion titulo={`Causalidad del ${evento}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Dato label="Actos subestándar">
            <Lista items={d.actos} />
          </Dato>
          <Dato label="Condiciones subestándar">
            <Lista items={d.condiciones} />
          </Dato>
          <Dato label="Factores del trabajador">
            <Lista items={d.factoresTrabajador} />
          </Dato>
          <Dato label="Factores del trabajo">
            <Lista items={d.factoresTrabajo} />
          </Dato>
        </div>
        <div className="mt-4">
          <Dato label="Causas básicas">
            <p className="whitespace-pre-line">{d.causasBasicas}</p>
          </Dato>
        </div>
      </Seccion>
      <Seccion titulo="6. Acciones correctivas">
        <Lista items={d.acciones} />
      </Seccion>
      <div className="pt-6">
        <p className="text-sm">Atentamente:</p>
        <div className="mt-10 w-72 border-t-2 border-ink pt-1">
          <p className="font-semibold">{d.firma.nombre || '—'}</p>
          <p className="text-xs text-muted uppercase">{d.firma.cargo}</p>
        </div>
      </div>
      <p className="text-xs text-muted">El formato RSE-04-00-02 en PDF se exporta desde la app.</p>
    </div>
  )
}

const TITULO: Record<string, (x: Registro) => string> = {
  reporte: (x) => ((x.r as Reporte).tipo === 'condicion' ? 'Condición subestándar' : 'Acto subestándar'),
  ergo: () => 'Evaluación ergonómica',
  matriz: () => 'Matriz de riesgos F-PSSO-IMEC-02',
  permiso: () => 'Permiso de trabajo',
  accidente: (x) => ((x.r as Accidente).datos.tipoEvento === 'incidente' ? 'Investigación de incidente' : 'Investigación de accidente'),
}

/** Detalle de un registro del archivo, listo para imprimir o guardar como PDF desde el navegador. */
export default function Registro() {
  const p = useParams()
  const tipo = p.tipo as TipoArchivo
  const { datos: x, error } = useCarga(() => cargar(tipo, Number(p.id)), [tipo, p.id])

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to={`/archivo/${p.empresaId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline">
          <Icon name="arrow_back" /> Volver a la carpeta
        </Link>
        {x && (
          <Btn variant="dark" icon="print" onClick={() => window.print()}>
            Imprimir / PDF
          </Btn>
        )}
      </div>
      <ErrorBox error={error} />
      {!x && !error && <Spinner />}
      {x && (
        <Card className="print-plain min-w-0 [overflow-wrap:anywhere]">
          <header className="mb-6 flex items-start gap-4 border-b-4 border-ink pb-4">
            {x.r.empresa.logoUrl && <img src={x.r.empresa.logoUrl} alt="" className="size-16 border-2 border-ink object-contain" />}
            <div className="min-w-0 flex-1">
              <p className="font-headline text-xs font-bold tracking-[0.2em] text-muted uppercase">{x.r.empresa.razonSocial}</p>
              <h1 className="font-headline text-3xl leading-tight font-bold uppercase">{TITULO[x.tipo](x)}</h1>
              <p className="mt-1 text-sm text-muted">
                {[x.r.codigo, fecha(x.r.createdAt, true), x.r.area?.nombre, `Registró: ${nombre(x.r.creadoPor)}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={cx('flex size-12 items-center justify-center border-2 border-ink', TIPO[x.tipo].css)}>
              <Icon name={TIPO[x.tipo].icon} className="text-[28px]" />
            </span>
          </header>
          {x.tipo === 'reporte' && <VistaReporte r={x.r} />}
          {x.tipo === 'ergo' && <VistaErgo r={x.r} />}
          {x.tipo === 'matriz' && <VistaMatriz r={x.r} />}
          {x.tipo === 'permiso' && <VistaPermiso r={x.r} />}
          {x.tipo === 'accidente' && <VistaAccidente r={x.r} />}
        </Card>
      )}
    </>
  )
}
