import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { ConModulo, Layout, SoloGestor } from './layout'
import Agenda from './pages/Agenda'
import Archivo from './pages/Archivo'
import ArchivoEmpresa from './pages/ArchivoEmpresa'
import Clasificaciones from './pages/Clasificaciones'
import EmpresaDetalle from './pages/EmpresaDetalle'
import Finanzas from './pages/Finanzas'
import Empresas from './pages/Empresas'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import Registro from './pages/Registro'
import UsuarioDetalle from './pages/UsuarioDetalle'
import Usuarios from './pages/Usuarios'
import { SessionProvider } from './session'
import { Toasts } from './ui'

const router = createBrowserRouter(
  [
    { path: '/login', element: <Login /> },
    {
      element: <Layout />,
      children: [
        { index: true, element: <Inicio /> },
        { path: 'archivo', element: <Archivo /> },
        { path: 'archivo/:empresaId', element: <ArchivoEmpresa /> },
        { path: 'archivo/:empresaId/:tipo/:id', element: <Registro /> },
        { element: <ConModulo codigo="AGENDA" />, children: [{ path: 'agenda', element: <Agenda /> }] },
        { element: <ConModulo codigo="FINANZAS" />, children: [{ path: 'finanzas', element: <Finanzas /> }] },
        {
          element: <SoloGestor />,
          children: [
            { path: 'empresas', element: <Empresas /> },
            { path: 'empresas/:id', element: <EmpresaDetalle /> },
            { path: 'usuarios', element: <Usuarios /> },
            { path: 'usuarios/:id', element: <UsuarioDetalle /> },
          ],
        },
        { element: <SoloGestor admin />, children: [{ path: 'clasificaciones', element: <Clasificaciones /> }] },
        { path: '*', element: <Inicio /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
      <Toasts />
    </SessionProvider>
  </StrictMode>,
)
