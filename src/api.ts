// Cliente de la API Nest (../../backend). Es el único módulo que conoce las rutas y las
// entidades en español; las pantallas solo usan estas funciones y tipos.
// Toda la seguridad (empresa, perfil, autoría) la aplica el backend: el panel solo oculta
// lo que el usuario no puede usar.

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const CLAVE_TOKEN = 'sst.panel.token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let alExpirar: (() => void) | null = null
/** La sesión registra aquí qué hacer ante un 401 (cerrar sesión). */
export const onSesionExpirada = (fn: () => void) => {
  alExpirar = fn
}

export const token = {
  get: () => localStorage.getItem(CLAVE_TOKEN),
  set: (t: string | null) => (t ? localStorage.setItem(CLAVE_TOKEN, t) : localStorage.removeItem(CLAVE_TOKEN)),
}

async function request<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const t = token.get()
  if (t) headers.Authorization = `Bearer ${t}`
  let body: BodyInit | undefined
  if (cuerpo instanceof FormData) body = cuerpo
  else if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(cuerpo)
  }
  let r: Response
  try {
    r = await fetch(`${BASE}${ruta}`, { method: metodo, headers, body })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }
  if (r.status === 401 && t) alExpirar?.()
  const texto = await r.text()
  const datos = texto ? JSON.parse(texto) : null
  if (!r.ok) {
    const m = datos?.message
    throw new ApiError(r.status, Array.isArray(m) ? m.join('. ') : (m ?? `Error ${r.status}`))
  }
  return datos as T
}

const get = <T>(ruta: string) => request<T>('GET', ruta)
const post = <T>(ruta: string, cuerpo?: unknown) => request<T>('POST', ruta, cuerpo)
const patch = <T>(ruta: string, cuerpo?: unknown) => request<T>('PATCH', ruta, cuerpo)
const del = <T>(ruta: string) => request<T>('DELETE', ruta)

/* --------------------------------- Tipos --------------------------------- */

export type Perfil = 'ADMINISTRADOR' | 'ADMIN_EMPRESA' | 'USUARIO'
export type NivelRiesgo = 'bajo' | 'medio' | 'alto' | 'critico'
export type TipoReporte = 'acto' | 'condicion'

export interface Yo {
  id: number
  nombres: string
  apellidos: string
  email: string
  cargo: string | null
  perfil: Perfil
  legal: { version: string; aceptada: boolean }
  features: { codigo: string; nombre: string }[]
}

export interface Persona {
  id: number
  nombres: string
  apellidos: string
}

export interface Area {
  id: number
  nombre: string
  descripcion: string | null
  ubicacion: string | null
  responsable: string | null
  nivelRiesgo: NivelRiesgo | null
  activo: boolean
}

export interface Puesto {
  id: number
  nombre: string
  descripcion: string | null
  funciones: string | null
  cicloTrabajo: string | null
  jornadaHoras: number | null
  numeroTrabajadores: number
  nivelRiesgo: NivelRiesgo | null
  eppRequerido: string[] | null
  activo: boolean
  area: Area | null
}

export interface Empresa {
  id: number
  razonSocial: string
  nombreComercial: string | null
  ruc: string
  actividadEconomica: string | null
  sector: string | null
  representanteLegalNombre: string
  representanteLegalCedula: string
  representanteLegalCargo: string | null
  representanteLegalEmail: string | null
  representanteLegalTelefono: string | null
  responsableSstNombre: string | null
  responsableSstCedula: string | null
  responsableSstEmail: string | null
  responsableSstTelefono: string | null
  logoUrl: string | null
  pais: string
  provincia: string | null
  ciudad: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  numeroEmpleados: number
  nivelRiesgo: NivelRiesgo
  fechaUltimoAccidente: string | null
  metaDiasSinAccidentes: number
  activo: boolean
  areas: Area[]
  puestos: Puesto[]
  resumen?: {
    reportesHoy: number
    reportesAyer: number
    hallazgosPendientes: number
    ultimaActividad: string | null
  }
}

/** Campos editables de la empresa (CrearEmpresaDto del backend). */
export type EmpresaInput = Partial<Omit<Empresa, 'id' | 'areas' | 'puestos' | 'resumen' | 'logoUrl'>>
export type AreaInput = Partial<Omit<Area, 'id'>>
export type PuestoInput = Partial<Omit<Puesto, 'id' | 'area'>> & { areaId?: number | null }

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  email: string
  cedula: string | null
  telefono: string | null
  cargo: string | null
  licencia: string | null
  perfil: Perfil
  activo: boolean
  ultimoAcceso: string | null
  empresas: { id: number; razonSocial: string }[]
  featureCodigos: string[]
  /** También trabaja con empresas que quien consulta no administra. */
  compartido: boolean
}

export interface UsuarioInput {
  nombres?: string
  apellidos?: string
  email?: string
  password?: string
  cedula?: string
  telefono?: string
  cargo?: string
  licencia?: string
  perfil?: Perfil
  activo?: boolean
  empresaIds?: number[]
  featureCodigos?: string[]
}

export interface Feature {
  codigo: string
  nombre: string
  descripcion: string | null
}

export interface Clasificacion {
  id: number
  tipo: TipoReporte
  nombre: string
  medida: string | null
  orden: number
  activo: boolean
}

export type TipoArchivo = 'matriz' | 'reporte' | 'ergo' | 'permiso' | 'accidente'

export interface ItemArchivo {
  tipo: TipoArchivo
  id: number
  codigo: string | null
  titulo: string
  detalle: string
  area: string | null
  fecha: string
  estado: string
  nivel: string | null
  autor: string | null
}

interface RegistroBase {
  id: number
  codigo: string | null
  createdAt: string
  empresa: { id: number; razonSocial: string; logoUrl: string | null }
  area: { nombre: string } | null
  creadoPor: Persona | null
}

export interface Reporte extends RegistroBase {
  estado: string
  imagenUrl: string
  tipo: TipoReporte | null
  clasificaciones: string[] | null
  severidad: NivelRiesgo | null
  descripcion: string | null
  accionCorrectiva: string | null
  iaMedidas: string[] | null
  registradoEn: string | null
}

export interface Ergo extends RegistroBase {
  puesto: { nombre: string } | null
  medio: 'video' | 'imagen'
  estado: string
  progreso: number
  nombreArchivo: string | null
  duracionSeg: number | null
  puntajeRula: number | null
  puntajeReba: number | null
  puntajeOwas: number | null
  nivelRiesgo: NivelRiesgo | null
  diagnostico: string | null
  recomendaciones: string[] | null
  advertencias: string[] | null
  puntos: { segundo: number; imagenUrl: string; critico: boolean; rula: number | null; reba: number | null }[] | null
  errorMensaje: string | null
}

export type SiglaNivel = 'T' | 'TO' | 'MO' | 'I' | 'IN'

export interface Matriz extends RegistroBase {
  puesto: { nombre: string } | null
  estado: 'BORRADOR' | 'COMPLETA'
  transcripcion: string
  resumen: string | null
  cabecera: {
    departamento: string
    puesto: string
    provincia: string
    canton: string
    tiempoExposicionHoras: number | null
    trabajadores: { hombres: number | null; mujeres: number | null; discapacitados: number | null }
    responsableDirecto: string
    responsableSso: string
    actividadesRutinarias: string
    actividadesNoRutinarias: string
  }
  peligros: {
    codigo: string
    nombre: string
    especificacion: string
    probabilidad: number
    consecuencia: number
    nivel: SiglaNivel
    medida: string
  }[]
  planAccion: { codigo: string; accion: string; responsable: string; fechaInicio: string; fechaFin: string }[]
  faltantes: { campo: string; mensaje: string }[]
}

export interface Permiso extends RegistroBase {
  estado: 'PENDIENTE' | 'AUTORIZADO' | 'CERRADO'
  descripcion: string
  fechaInicio: string
  fechaFin: string
  especiales: string[]
  datos: {
    personal?: { nombre?: string; cedula?: string; cargo?: string }[]
    aprobacion?: { jefe?: string; administrador?: string; responsableSso?: string }
    informe?: string
    cierre?: { jefe?: string; responsableSso?: string; areaLimpia?: boolean | null }
  } & Record<string, unknown>
  autorizadoPor: Persona | null
  autorizadoEn: string | null
  cerradoPor: Persona | null
  cerradoEn: string | null
}

/** Informe de investigación de accidentes e incidentes (RSE-04-00-02). */
export interface Accidente extends RegistroBase {
  puesto: { nombre: string } | null
  estado: 'BORRADOR' | 'COMPLETA'
  transcripcion: string
  resumen: string | null
  faltantes: { campo: string; mensaje: string }[]
  datos: {
    tipoEvento: 'accidente' | 'incidente'
    investigador: { nombre: string; cedula: string; competencia: string }
    fechaInvestigacion: string
    entrevistados: string[]
    tecnicas: string
    trabajadores: { nombre: string; fechaNacimiento: string; ocupacion: string; resultado: string }[]
    introduccion: string
    lugar: string
    fecha: string
    hora: string
    consecuencia: string
    descripcion: string
    actos: string[]
    condiciones: string[]
    factoresTrabajador: string[]
    factoresTrabajo: string[]
    causasBasicas: string
    acciones: string[]
    firma: { nombre: string; cargo: string }
  }
}

/* -------------------------------- Llamadas -------------------------------- */

export const api = {
  login: (email: string, password: string) => post<{ token: string; usuario: Yo }>('/auth/login', { email, password }),
  yo: () => get<Yo>('/auth/me'),
  aceptarTerminos: () => post<Yo>('/auth/consentimientos', { terminos: true }),

  empresas: (inactivas = false) => get<Empresa[]>(`/empresas${inactivas ? '?inactivas=true' : ''}`),
  empresa: (id: number) => get<Empresa>(`/empresas/${id}`),
  crearEmpresa: (e: EmpresaInput) => post<Empresa>('/empresas', e),
  actualizarEmpresa: (id: number, e: EmpresaInput) => patch<Empresa>(`/empresas/${id}`, e),
  subirLogo: (id: number, archivo: File) => {
    const f = new FormData()
    f.append('logo', archivo)
    return post<{ logoUrl: string }>(`/empresas/${id}/logo`, f)
  },
  crearArea: (empresaId: number, a: AreaInput) => post<Area>(`/empresas/${empresaId}/areas`, a),
  actualizarArea: (empresaId: number, id: number, a: AreaInput) => patch<Area>(`/empresas/${empresaId}/areas/${id}`, a),
  eliminarArea: (empresaId: number, id: number) => del(`/empresas/${empresaId}/areas/${id}`),
  crearPuesto: (empresaId: number, p: PuestoInput) => post<Puesto>(`/empresas/${empresaId}/puestos`, p),
  actualizarPuesto: (empresaId: number, id: number, p: PuestoInput) => patch<Puesto>(`/empresas/${empresaId}/puestos/${id}`, p),
  eliminarPuesto: (empresaId: number, id: number) => del(`/empresas/${empresaId}/puestos/${id}`),

  usuarios: () => get<Usuario[]>('/usuarios'),
  usuario: (id: number) => get<Usuario>(`/usuarios/${id}`),
  crearUsuario: (u: UsuarioInput) => post<Usuario>('/usuarios', u),
  /** `null` cuando el cambio deja al usuario fuera de las empresas de quien edita. */
  actualizarUsuario: (id: number, u: UsuarioInput) => patch<Usuario | null>(`/usuarios/${id}`, u),
  features: () => get<Feature[]>('/features'),

  clasificaciones: () => get<Clasificacion[]>('/clasificaciones?inactivas=true'),
  crearClasificacion: (c: Partial<Clasificacion>) => post<Clasificacion>('/clasificaciones', c),
  actualizarClasificacion: (id: number, c: Partial<Clasificacion>) => patch<Clasificacion>(`/clasificaciones/${id}`, c),
  eliminarClasificacion: (id: number) => del(`/clasificaciones/${id}`),

  archivo: (empresaId: number) => get<ItemArchivo[]>(`/empresas/${empresaId}/archivo`),
  reporte: (id: number) => get<Reporte>(`/reportes/${id}`),
  ergo: (id: number) => get<Ergo>(`/ergo/${id}`),
  matriz: (id: number) => get<Matriz>(`/voz/${id}`),
  permiso: (id: number) => get<Permiso>(`/permisos/${id}`),
  accidente: (id: number) => get<Accidente>(`/accidentes/${id}`),
}

export const nombre = (p: { nombres: string; apellidos: string } | null | undefined) =>
  p ? `${p.nombres} ${p.apellidos}`.trim() : '—'

export const esGestor = (p: Perfil) => p === 'ADMINISTRADOR' || p === 'ADMIN_EMPRESA'
