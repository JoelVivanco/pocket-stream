import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Estadisticas() {
  const navigate = useNavigate()

  const hoy = new Date()

  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  const [ventas, setVentas] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarVentas()
  }, [anio, mes])

  const cargarVentas = async () => {
    setLoading(true)

    const inicioMes =
      `${anio}-${String(mes).padStart(2, '0')}-01`

    const ultimoDia = new Date(
      anio,
      mes,
      0
    ).getDate()

    const finMes =
      `${anio}-${String(mes).padStart(2, '0')}-${ultimoDia}`

    // ==========================================
    // CARGAR VENTAS DEL MES
    // ==========================================

    const { data: ventasData, error: ventasError } =
      await supabase
        .from('ventas')
        .select(`
        id,
        tipo,
        monto,
        fecha,
        clientes (
          nombre
        ),
        servicios (
          id,
          nombre
        ),
        cuentas (
          nombre
        ),
        perfiles (
          numero_perfil
        )
      `)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes)
        .order('fecha', {
          ascending: false,
        })

    if (ventasError) {
      console.error(
        'Error cargando ventas:',
        ventasError
      )
      setVentas([])
    } else {
      setVentas(ventasData || [])
    }

    // ==========================================
    // CARGAR GASTOS DEL MES
    // ==========================================

    const { data: gastosData, error: gastosError } =
      await supabase
        .from('gastos_cuentas')
        .select(`
        id,
        cuenta_id,
        monto,
        fecha_pago,
        tipo,
        observaciones
      `)
        .gte('fecha_pago', inicioMes)
        .lte('fecha_pago', finMes)
        .order('fecha_pago', {
          ascending: false,
        })

    if (gastosError) {
      console.error(
        'Error cargando gastos:',
        gastosError
      )
      setGastos([])
    } else {
      setGastos(gastosData || [])
    }

    setLoading(false)
  }

  const resumen = useMemo(() => {
    // ==========================================
    // INGRESOS
    // ==========================================

    const ingresos = ventas.reduce(
      (total, venta) =>
        total + Number(venta.monto || 0),
      0
    )

    // ==========================================
    // COSTOS
    // ==========================================

    const costos = gastos.reduce(
      (total, gasto) =>
        total + Number(gasto.monto || 0),
      0
    )

    // ==========================================
    // GANANCIA
    // ==========================================

    const ganancia =
      ingresos - costos

    // ==========================================
    // MARGEN DE GANANCIA
    // ==========================================

    const margen =
      ingresos > 0
        ? (ganancia / ingresos) * 100
        : 0

    // ==========================================
    // TIPOS DE VENTA
    // ==========================================

    const nuevas =
      ventas.filter(
        (venta) => venta.tipo === 'nueva'
      ).length

    const renovaciones =
      ventas.filter(
        (venta) => venta.tipo === 'renovacion'
      ).length

    // ==========================================
    // VENTAS POR SERVICIO
    // ==========================================

    const porServicio = {}

    ventas.forEach((venta) => {
      const nombre =
        venta.servicios?.nombre ||
        'Sin servicio'

      if (!porServicio[nombre]) {
        porServicio[nombre] = {
          nombre,
          ventas: 0,
          ingresos: 0,
        }
      }

      porServicio[nombre].ventas += 1

      porServicio[nombre].ingresos +=
        Number(venta.monto || 0)
    })

    const servicios = Object.values(
      porServicio
    ).sort((a, b) => {
      return b.ventas - a.ventas
    })

    const servicioMasVendido =
      servicios.length > 0
        ? servicios[0]
        : null

    const servicioMenosVendido =
      servicios.length > 0
        ? [...servicios].sort(
          (a, b) =>
            a.ventas - b.ventas
        )[0]
        : null

    return {
      ingresos,
      costos,
      ganancia,
      margen,

      nuevas,
      renovaciones,

      totalVentas:
        ventas.length,

      servicios,

      servicioMasVendido,
      servicioMenosVendido,
    }
  }, [ventas, gastos])

  const nombresMeses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]

  return (
    <div style={pagina}>
      <div style={contenedor}>

        <button
          onClick={() => navigate('/')}
          style={botonVolver}
        >
          ← Volver al Dashboard
        </button>

        <div style={encabezado}>
          <div>
            <span style={eyebrow}>
              VENTAS Y ESTADÍSTICAS
            </span>

            <h1 style={titulo}>
              Rendimiento mensual
            </h1>

            <p style={subtitulo}>
              Analiza tus ventas,
              renovaciones e ingresos.
            </p>
          </div>

          <div style={filtros}>
            <select
              value={mes}
              onChange={(e) =>
                setMes(Number(e.target.value))
              }
              style={select}
            >
              {nombresMeses.map(
                (nombre, index) => (
                  <option
                    key={nombre}
                    value={index + 1}
                  >
                    {nombre}
                  </option>
                )
              )}
            </select>

            <input
              type="number"
              value={anio}
              onChange={(e) =>
                setAnio(Number(e.target.value))
              }
              style={select}
            />
          </div>
        </div>

        {loading ? (
          <div style={cargando}>
            Cargando estadísticas...
          </div>
        ) : (
          <>
            <div style={resumenGrid}>

              <Tarjeta
                titulo="Ingresos"
                valor={`S/ ${resumen.ingresos.toFixed(2)}`}
              />

              <Tarjeta
                titulo="Costos"
                valor={`S/ ${resumen.costos.toFixed(2)}`}
              />

              <Tarjeta
                titulo="Ganancia"
                valor={`S/ ${resumen.ganancia.toFixed(2)}`}
              />

              <Tarjeta
                titulo="Margen"
                valor={`${resumen.margen.toFixed(1)}%`}
              />

              <div
                style={{
                  ...resumenGrid,
                  marginTop: '16px',
                }}
              >

                <Tarjeta
                  titulo="Ventas"
                  valor={resumen.totalVentas}
                />

                <Tarjeta
                  titulo="Nuevas"
                  valor={resumen.nuevas}
                />

                <Tarjeta
                  titulo="Renovaciones"
                  valor={resumen.renovaciones}
                />

                <Tarjeta
                  titulo="Gastos registrados"
                  valor={gastos.length}
                />

              </div>

            </div>

            <div style={destacadosGrid}>

              <div style={destacadoCard}>
                <span style={textoGris}>
                  Servicio más vendido
                </span>

                <strong style={valorDestacado}>
                  {resumen.servicioMasVendido
                    ?.nombre || 'Sin ventas'}
                </strong>

                {resumen.servicioMasVendido && (
                  <small style={textoGris}>
                    {
                      resumen
                        .servicioMasVendido
                        .ventas
                    } ventas
                  </small>
                )}
              </div>

              <div style={destacadoCard}>
                <span style={textoGris}>
                  Servicio menos vendido
                </span>

                <strong style={valorDestacado}>
                  {resumen.servicioMenosVendido
                    ?.nombre || 'Sin ventas'}
                </strong>

                {resumen.servicioMenosVendido && (
                  <small style={textoGris}>
                    {
                      resumen
                        .servicioMenosVendido
                        .ventas
                    } ventas
                  </small>
                )}
              </div>

            </div>

            <section style={{ marginTop: '40px' }}>
              <span style={eyebrow}>
                PLATAFORMAS
              </span>

              <h2>
                Ventas por servicio
              </h2>

              {resumen.servicios.length === 0 ? (
                <div style={sinDatos}>
                  No hay ventas registradas
                  para este mes.
                </div>
              ) : (
                <div style={tabla}>

                  <div style={filaCabecera}>
                    <span>Servicio</span>
                    <span>Ventas</span>
                    <span>Ingresos</span>
                    <span>Participación</span>
                  </div>

                  {resumen.servicios.map(
                    (servicio) => {
                      const porcentaje =
                        resumen.ingresos > 0
                          ? (
                            servicio.ingresos /
                            resumen.ingresos
                          ) * 100
                          : 0

                      return (
                        <div
                          key={servicio.nombre}
                          style={filaTabla}
                        >
                          <strong>
                            {servicio.nombre}
                          </strong>

                          <span>
                            {servicio.ventas}
                          </span>

                          <span>
                            S/{' '}
                            {servicio.ingresos.toFixed(
                              2
                            )}
                          </span>

                          <span>
                            {porcentaje.toFixed(
                              1
                            )}
                            %
                          </span>
                        </div>
                      )
                    }
                  )}

                </div>
              )}
            </section>

            <section style={{ marginTop: '40px' }}>
              <span style={eyebrow}>
                HISTORIAL
              </span>

              <h2>
                Movimientos del mes
              </h2>

              {ventas.length === 0 ? (
                <div style={sinDatos}>
                  No hay movimientos.
                </div>
              ) : (
                <div style={tabla}>

                  {ventas.map((venta) => (
                    <div
                      key={venta.id}
                      style={ventaFila}
                    >
                      <div>
                        <strong>
                          {
                            venta.clientes
                              ?.nombre
                          }
                        </strong>

                        <div style={textoGris}>
                          {
                            venta.servicios
                              ?.nombre
                          }
                          {' · '}
                          {
                            venta.cuentas
                              ?.nombre
                          }
                          {' · '}
                          Perfil{' '}
                          {
                            venta.perfiles
                              ?.numero_perfil
                          }
                        </div>
                      </div>

                      <div>
                        <span
                          style={{
                            ...tipoVenta,
                            color:
                              venta.tipo ===
                                'renovacion'
                                ? '#60a5fa'
                                : '#22c55e',
                          }}
                        >
                          {venta.tipo ===
                            'renovacion'
                            ? 'RENOVACIÓN'
                            : 'NUEVA'}
                        </span>
                      </div>

                      <div>
                        {venta.fecha}
                      </div>

                      <strong>
                        S/{' '}
                        {Number(
                          venta.monto
                        ).toFixed(2)}
                      </strong>
                    </div>
                  ))}

                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function Tarjeta({ titulo, valor }) {
  return (
    <div style={tarjeta}>
      <span style={textoGris}>
        {titulo}
      </span>

      <strong style={numeroGrande}>
        {valor}
      </strong>
    </div>
  )
}

const pagina = {
  minHeight: '100vh',
  color: 'white',
  background:
    'radial-gradient(circle at 75% 0%, rgba(0,88,255,0.16), transparent 30%), #030712',
  padding: '35px 0 80px',
}

const contenedor = {
  width: 'min(1350px, 92%)',
  margin: 'auto',
}

const botonVolver = {
  padding: '10px 14px',
  borderRadius: '8px',
  border:
    '1px solid rgba(255,255,255,0.10)',
  background:
    'rgba(255,255,255,0.04)',
  color: 'white',
  cursor: 'pointer',
}

const encabezado = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'end',
  gap: '20px',
  marginTop: '35px',
  marginBottom: '35px',
  flexWrap: 'wrap',
}

const eyebrow = {
  color: '#3b82f6',
  fontSize: '11px',
  letterSpacing: '3px',
  fontWeight: 'bold',
}

const titulo = {
  fontSize: '40px',
  margin: '8px 0',
}

const subtitulo = {
  color: '#94a3b8',
}

const filtros = {
  display: 'flex',
  gap: '10px',
}

const select = {
  padding: '11px',
  borderRadius: '8px',
  border:
    '1px solid rgba(255,255,255,0.10)',
  background: '#0b1220',
  color: 'white',
}

const resumenGrid = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '16px',
}

const tarjeta = {
  padding: '22px',
  borderRadius: '14px',
  border:
    '1px solid rgba(255,255,255,0.08)',
  background:
    'rgba(255,255,255,0.03)',
}

const textoGris = {
  color: '#64748b',
  fontSize: '12px',
}

const numeroGrande = {
  display: 'block',
  marginTop: '8px',
  fontSize: '28px',
}

const destacadosGrid = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '16px',
  marginTop: '16px',
}

const destacadoCard = {
  padding: '22px',
  borderRadius: '14px',
  border:
    '1px solid rgba(59,130,246,0.15)',
  background:
    'rgba(59,130,246,0.05)',
}

const valorDestacado = {
  display: 'block',
  fontSize: '22px',
  margin: '8px 0',
}

const tabla = {
  marginTop: '16px',
  border:
    '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  overflow: 'hidden',
}

const filaCabecera = {
  display: 'grid',
  gridTemplateColumns:
    '2fr 1fr 1fr 1fr',
  gap: '15px',
  padding: '15px 18px',
  background:
    'rgba(255,255,255,0.04)',
  color: '#64748b',
  fontSize: '11px',
}

const filaTabla = {
  display: 'grid',
  gridTemplateColumns:
    '2fr 1fr 1fr 1fr',
  gap: '15px',
  padding: '17px 18px',
  borderTop:
    '1px solid rgba(255,255,255,0.06)',
}

const ventaFila = {
  display: 'grid',
  gridTemplateColumns:
    '2fr 1fr 1fr 1fr',
  gap: '15px',
  alignItems: 'center',
  padding: '17px 18px',
  borderTop:
    '1px solid rgba(255,255,255,0.06)',
}

const tipoVenta = {
  fontSize: '10px',
  letterSpacing: '1px',
  fontWeight: 'bold',
}

const sinDatos = {
  padding: '35px',
  marginTop: '15px',
  textAlign: 'center',
  color: '#64748b',
  border:
    '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
}

const cargando = {
  padding: '50px',
  textAlign: 'center',
  color: '#64748b',
}

export default Estadisticas