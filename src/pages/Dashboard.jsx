import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

function Dashboard() {
    const navigate = useNavigate()

    const [servicios, setServicios] = useState([])
    const [loading, setLoading] = useState(true)
    const [vencimientos, setVencimientos] = useState([])

    useEffect(() => {
        cargarDashboard()
    }, [])

    const cargarDashboard = async () => {
        setLoading(true)

        const { data: serviciosData, error: serviciosError } =
            await supabase
                .from('servicios')
                .select('*')
                .eq('activo', true)
                .order('nombre')

        if (serviciosError) {
            console.error(serviciosError)
            setLoading(false)
            return
        }

        const { data: cuentasData } =
            await supabase
                .from('cuentas')
                .select('id, servicio_id, estado')

        const { data: perfilesData } =
            await supabase
                .from('perfiles')
                .select('id, cuenta_id, estado')

        const { data: suscripcionesData } =
            await supabase
                .from('suscripciones')
                .select(`
          id,
          cliente_id,
          perfil_id,
          fecha_cobro,
          estado,
          clientes (
            nombre,
            telefono
          ),
          perfiles (
            numero_perfil,
            cuentas (
              id,
              nombre,
              servicio_id,
              servicios (
                nombre
              )
            )
          )
        `)
                .eq('estado', 'activa')

        const serviciosProcesados = serviciosData.map((servicio) => {
            const cuentasServicio =
                cuentasData?.filter(
                    (cuenta) =>
                        cuenta.servicio_id === servicio.id &&
                        cuenta.estado === 'activa'
                ) || []

            const idsCuentas = cuentasServicio.map(
                (cuenta) => cuenta.id
            )

            const perfilesServicio =
                perfilesData?.filter(
                    (perfil) =>
                        idsCuentas.includes(perfil.cuenta_id)
                ) || []

            const perfilesActivos =
                perfilesServicio.filter(
                    (perfil) => perfil.estado === 'ocupado'
                ).length

            const perfilesDisponibles =
                perfilesServicio.filter(
                    (perfil) => perfil.estado === 'disponible'
                ).length

            return {
                ...servicio,
                cuentasActivas: cuentasServicio.length,
                perfilesActivos,
                perfilesDisponibles,
            }
        })

        setServicios(serviciosProcesados)

        procesarVencimientos(suscripcionesData || [])

        setLoading(false)
    }

    const procesarVencimientos = (suscripciones) => {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)

        const resultado = suscripciones
            .map((suscripcion) => {
                const fechaCobro = new Date(
                    `${suscripcion.fecha_cobro}T00:00:00`
                )

                fechaCobro.setHours(0, 0, 0, 0)

                const diferenciaMs =
                    fechaCobro.getTime() - hoy.getTime()

                const diasRestantes = Math.round(
                    diferenciaMs / (1000 * 60 * 60 * 24)
                )

                let categoria = null

                if (diasRestantes < 0) {
                    categoria = 'vencido'
                } else if (diasRestantes === 0) {
                    categoria = 'hoy'
                } else if (diasRestantes === 1) {
                    categoria = 'manana'
                } else if (diasRestantes <= 7) {
                    categoria = 'proximo'
                }

                return {
                    ...suscripcion,
                    diasRestantes,
                    categoria,
                }
            })
            .filter((suscripcion) => suscripcion.categoria !== null)
            .sort((a, b) => {
                return (
                    new Date(a.fecha_cobro) -
                    new Date(b.fecha_cobro)
                )
            })

        setVencimientos(resultado)
    }

    const obtenerTextoVencimiento = (item) => {
        if (item.categoria === 'vencido') {
            const dias = Math.abs(item.diasRestantes)

            return dias === 1
                ? 'Venció ayer'
                : `Venció hace ${dias} días`
        }

        if (item.categoria === 'hoy') {
            return 'Vence hoy'
        }

        if (item.categoria === 'manana') {
            return 'Vence mañana'
        }

        return `Vence en ${item.diasRestantes} días`
    }

    const abrirWhatsApp = (item) => {
        const telefono = item.clientes?.telefono

        if (!telefono) return

        let numero = telefono.replace(/\D/g, '')

        if (!numero.startsWith('51')) {
            numero = `51${numero}`
        }

        const servicio =
            item.perfiles?.cuentas?.servicios?.nombre || 'tu servicio'

        const mensaje =
            `Hola ${item.clientes?.nombre || ''}, ` +
            `te escribo para recordarte que tu servicio de ${servicio} ` +
            `vence el ${item.fecha_cobro}.`

        const url =
            `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`

        window.open(url, '_blank')
    }

    const cerrarSesion = async () => {
        const { error } = await supabase.auth.signOut()

        if (error) {
            console.error('Error al cerrar sesión:', error)
            return
        }

    }

    return (
        <div className="dashboard-page">

            <header className="topbar">
                <div>
                    <h2>POCKET STREAM</h2>
                    <span>Panel de administración</span>
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: '10px',
                    }}
                >
                    <button
                        className="logout-button"
                        onClick={() =>
                            navigate('/estadisticas')
                        }
                    >
                        Ventas y estadísticas
                    </button>

                    <button
                        className="logout-button"
                        onClick={cerrarSesion}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </header>

            <main className="dashboard-content">

                <section className="banner-container">
                    <img
                        src="/banner.jpg"
                        alt="Pocket Stream"
                        className="dashboard-banner"
                    />
                </section>

                <section className="welcome-section">
                    <div>
                        <span className="section-eyebrow">
                            PANEL GENERAL
                        </span>

                        <h1>Resumen de Pocket Stream</h1>

                        <p>
                            Administra tus cuentas, perfiles,
                            clientes y próximos vencimientos.
                        </p>
                    </div>
                </section>

                {vencimientos.length > 0 && (
                    <section className="alerts-section">

                        <div className="section-header">
                            <div>
                                <span className="section-eyebrow warning">
                                    VENCIMIENTOS
                                </span>

                                <h2>Clientes próximos a vencer</h2>
                            </div>

                            <span className="alert-counter">
                                {vencimientos.length}
                            </span>
                        </div>

                        <div className="alerts-grid">
                            {vencimientos.map((item) => {
                                const servicio =
                                    item.perfiles?.cuentas?.servicios?.nombre

                                const cuenta =
                                    item.perfiles?.cuentas?.nombre

                                const perfil =
                                    item.perfiles?.numero_perfil

                                return (
                                    <div
                                        className={`alert-card alert-${item.categoria}`}
                                        key={item.id}
                                    >
                                        <div className="alert-icon">
                                            {item.categoria === 'vencido'
                                                ? '!'
                                                : item.categoria === 'hoy'
                                                    ? '●'
                                                    : item.categoria === 'manana'
                                                        ? '1'
                                                        : item.diasRestantes}
                                        </div>

                                        <div className="alert-info">

                                            <div className="alert-status">
                                                {obtenerTextoVencimiento(item)}
                                            </div>

                                            <strong>
                                                {item.clientes?.nombre || 'Sin nombre'}
                                            </strong>

                                            <span>
                                                {servicio}
                                                {' · '}
                                                {cuenta}
                                                {' · '}
                                                Perfil {perfil}
                                            </span>

                                            <span>
                                                Celular: {item.clientes?.telefono}
                                            </span>

                                            <small>
                                                Cobro: {item.fecha_cobro}
                                            </small>

                                        </div>

                                        <div className="alert-actions">

                                            <button
                                                className="whatsapp-button"
                                                onClick={() => abrirWhatsApp(item)}
                                            >
                                                WhatsApp
                                            </button>

                                            <button
                                                className="view-account-button"
                                                onClick={() =>
                                                    navigate(
                                                        `/cuenta/${item.perfiles?.cuentas?.id}`
                                                    )
                                                }
                                            >
                                                Ver cuenta
                                            </button>

                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                    </section>
                )}

                <section className="services-section">

                    <div className="section-header">
                        <div>
                            <span className="section-eyebrow">
                                SERVICIOS
                            </span>

                            <h2>Plataformas</h2>
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading-box">
                            Cargando plataformas...
                        </div>
                    ) : (
                        <div className="services-grid">

                            {servicios.map((servicio) => (

                                <article
                                    className="service-card"
                                    key={servicio.id}
                                    style={{
                                        '--service-color':
                                            servicio.color_principal ||
                                            '#0066ff',
                                    }}
                                >

                                    <div className="service-top">
                                        <div
                                            className="service-dot"
                                        ></div>

                                        <span>
                                            {servicio.activo
                                                ? 'ACTIVO'
                                                : 'INACTIVO'}
                                        </span>
                                    </div>

                                    <h3>{servicio.nombre}</h3>

                                    <div className="service-price">
                                        <span>Precio actual</span>

                                        <strong>
                                            S/ {Number(
                                                servicio.precio_actual
                                            ).toFixed(2)}
                                        </strong>
                                    </div>

                                    <div className="service-stats">

                                        <div>
                                            <span>Cuentas</span>
                                            <strong>
                                                {servicio.cuentasActivas}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Ocupados</span>
                                            <strong>
                                                {servicio.perfilesActivos}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Libres</span>
                                            <strong>
                                                {servicio.perfilesDisponibles}
                                            </strong>
                                        </div>

                                    </div>

                                    <button
                                        className="open-service"
                                        onClick={() => navigate(`/servicio/${servicio.id}`)}
                                    >
                                        Administrar servicio →
                                    </button>

                                </article>
                            ))}

                        </div>
                    )}

                </section>

            </main>
        </div>
    )
}

export default Dashboard