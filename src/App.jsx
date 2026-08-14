import Cuenta from './pages/Cuenta'

import Estadisticas from './pages/Estadisticas'

import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Servicio from './pages/Servicio'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarSesion = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setSession(session)
      setLoading(false)
    }

    cargarSesion()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return null
  }

  if (!session) {
    return <Login />
  }

  return (
    <Routes>

      <Route
        path="/estadisticas"
        element={<Estadisticas />}
      />
      
      <Route
        path="/cuenta/:id"
        element={<Cuenta />}
      />
      <Route
        path="/"
        element={<Dashboard />}
      />

      <Route
        path="/servicio/:id"
        element={<Servicio />}
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  )
}

export default App