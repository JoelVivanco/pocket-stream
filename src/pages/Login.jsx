import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Login.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const iniciarSesion = async (e) => {
    e.preventDefault()

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-glow glow-1"></div>
      <div className="login-glow glow-2"></div>

      <div className="login-container">
        <div className="brand">
          <div className="brand-title">POCKET STREAM</div>

          <div className="brand-subtitle">
            Panel de Administración
          </div>
        </div>

        <form className="login-card" onSubmit={iniciarSesion}>
          <h1>Bienvenido</h1>
          <p>Ingresa a tu panel privado</p>

          <label>Correo electrónico</label>

          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Contraseña</label>

          <input
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'INGRESANDO...' : 'INGRESAR'}
          </button>
        </form>

        <div className="login-footer">
          Administración privada • Pocket Stream
        </div>
      </div>
    </div>
  )
}

export default Login