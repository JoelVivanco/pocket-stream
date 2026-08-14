import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Servicio() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [servicio, setServicio] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)

  // ==========================================
  // NUEVA CUENTA
  // ==========================================

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')

  const [nuevaCuenta, setNuevaCuenta] = useState({
    nombre: '',
    correo: '',
    contrasena: '',
    cantidad_maxima: 1,
    costo: '',
    fecha_inicio: '',
    fecha_facturacion: '',
    observaciones: '',
  })

  // ==========================================
  // REGISTRAR PAGO / RENOVAR CUENTA
  // ==========================================

  const [mostrarPago, setMostrarPago] = useState(false)
  const [cuentaPago, setCuentaPago] = useState(null)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [errorPago, setErrorPago] = useState('')

  const [datosPago, setDatosPago] = useState({
    monto: '',
    fecha_pago: '',
    nueva_fecha_facturacion: '',
  })

  // ==========================================
  // CARGAR SERVICIO
  // ==========================================

  useEffect(() => {
    cargarServicio()
  }, [id])

  const cargarServicio = async () => {
    setLoading(true)

    const { data: servicioData, error: servicioError } =
      await supabase
        .from('servicios')
        .select('*')
        .eq('id', id)
        .single()

    if (servicioError) {
      console.error(servicioError)
      setLoading(false)
      return
    }

    const { data: cuentasData, error: cuentasError } =
      await supabase
        .from('cuentas')
        .select(`
          *,
          perfiles (
            id,
            numero_perfil,
            estado
          )
        `)
        .eq('servicio_id', id)
        .eq('estado', 'activa')
        .order('id')

    if (cuentasError) {
      console.error(cuentasError)
    }

    setServicio(servicioData)
    setCuentas(cuentasData || [])
    setLoading(false)
  }

  // ==========================================
  // NUEVA CUENTA
  // ==========================================

  const abrirFormulario = () => {
    const siguienteNumero = cuentas.length + 1

    setNuevaCuenta({
      nombre: `Cuenta ${siguienteNumero}`,
      correo: '',
      contrasena: '',
      cantidad_maxima: servicio?.perfiles_por_cuenta || 1,
      costo: '',
      fecha_inicio: '',
      fecha_facturacion: '',
      observaciones: '',
    })

    setErrorFormulario('')
    setMostrarFormulario(true)
  }

  const cerrarFormulario = () => {
    if (guardando) return

    setMostrarFormulario(false)
    setErrorFormulario('')
  }

  const actualizarCampo = (e) => {
    const { name, value } = e.target

    setNuevaCuenta((actual) => ({
      ...actual,

      [name]:
        name === 'cantidad_maxima'
          ? Number(value)
          : value,
    }))
  }

  const guardarCuenta = async (e) => {
    e.preventDefault()

    setErrorFormulario('')

    if (!nuevaCuenta.nombre.trim()) {
      setErrorFormulario(
        'Debes colocar un nombre para la cuenta.'
      )
      return
    }

    if (nuevaCuenta.cantidad_maxima < 1) {
      setErrorFormulario(
        'La cantidad máxima de perfiles debe ser mayor a 0.'
      )
      return
    }

    setGuardando(true)

    // ==========================================
    // 1. CREAR CUENTA
    // ==========================================

    const { data: cuentaCreada, error: errorCuenta } =
      await supabase
        .from('cuentas')
        .insert({
          servicio_id: Number(id),

          nombre:
            nuevaCuenta.nombre.trim(),

          correo:
            nuevaCuenta.correo.trim() || null,

          contrasena:
            nuevaCuenta.contrasena || null,

          cantidad_maxima:
            nuevaCuenta.cantidad_maxima,

          costo:
            Number(nuevaCuenta.costo) || 0,

          fecha_inicio:
            nuevaCuenta.fecha_inicio || null,

          fecha_facturacion:
            nuevaCuenta.fecha_facturacion || null,

          estado:
            'activa',

          observaciones:
            nuevaCuenta.observaciones.trim() || null,
        })
        .select()
        .single()

    if (errorCuenta) {
      console.error(errorCuenta)

      setErrorFormulario(
        'No se pudo crear la cuenta. Revisa los datos.'
      )

      setGuardando(false)
      return
    }

    // ==========================================
    // 2. CREAR PERFILES
    // ==========================================

    const perfilesNuevos = Array.from(
      {
        length: nuevaCuenta.cantidad_maxima,
      },

      (_, index) => ({
        cuenta_id: cuentaCreada.id,
        numero_perfil: index + 1,
        nombre_perfil: `Perfil ${index + 1}`,
        estado: 'disponible',
      })
    )

    const { error: errorPerfiles } =
      await supabase
        .from('perfiles')
        .insert(perfilesNuevos)

    if (errorPerfiles) {
      console.error(errorPerfiles)

      await supabase
        .from('cuentas')
        .delete()
        .eq('id', cuentaCreada.id)

      setErrorFormulario(
        'La cuenta no pudo completarse porque hubo un error creando los perfiles.'
      )

      setGuardando(false)
      return
    }

    // ==========================================
    // 3. REGISTRAR GASTO INICIAL
    // ==========================================

    if (Number(nuevaCuenta.costo) > 0) {
      const fechaGasto =
        nuevaCuenta.fecha_inicio ||
        formatoFechaLocal(new Date())

      const { error: errorGasto } =
        await supabase
          .from('gastos_cuentas')
          .insert({
            cuenta_id: cuentaCreada.id,

            monto:
              Number(nuevaCuenta.costo),

            fecha_pago:
              fechaGasto,

            tipo:
              'compra',

            observaciones:
              'Compra inicial de la cuenta',
          })

      if (errorGasto) {
        console.error(
          'La cuenta se creó pero no se pudo registrar el gasto inicial:',
          errorGasto
        )
      }
    }

    // ==========================================
    // 4. FINALIZAR
    // ==========================================

    setMostrarFormulario(false)
    setGuardando(false)

    await cargarServicio()
  }

  // ==========================================
  // UTILIDADES DE FECHA
  // ==========================================

  const formatoFechaLocal = (fecha) => {
    const anio = fecha.getFullYear()

    const mes = String(
      fecha.getMonth() + 1
    ).padStart(2, '0')

    const dia = String(
      fecha.getDate()
    ).padStart(2, '0')

    return `${anio}-${mes}-${dia}`
  }

  const sumarUnMes = (fechaTexto) => {
    if (!fechaTexto) return ''

    const [anio, mes, dia] =
      fechaTexto
        .split('-')
        .map(Number)

    const ultimoDiaSiguienteMes =
      new Date(
        anio,
        mes + 1,
        0
      ).getDate()

    const diaSeguro =
      Math.min(
        dia,
        ultimoDiaSiguienteMes
      )

    return formatoFechaLocal(
      new Date(
        anio,
        mes,
        diaSeguro
      )
    )
  }

  // ==========================================
  // REGISTRAR PAGO
  // ==========================================

  const abrirPago = (cuenta) => {
    const hoy = new Date()

    setCuentaPago(cuenta)

    setDatosPago({
      monto:
        cuenta.costo || '',

      fecha_pago:
        formatoFechaLocal(hoy),

      nueva_fecha_facturacion:
        cuenta.fecha_facturacion
          ? sumarUnMes(
              cuenta.fecha_facturacion
            )
          : '',
    })

    setErrorPago('')
    setMostrarPago(true)
  }

  const cerrarPago = () => {
    if (guardandoPago) return

    setMostrarPago(false)
    setCuentaPago(null)
    setErrorPago('')
  }

  const actualizarPago = (e) => {
    const { name, value } = e.target

    setDatosPago((actual) => ({
      ...actual,
      [name]: value,
    }))
  }

  const registrarPago = async (e) => {
    e.preventDefault()

    if (!cuentaPago) return

    if (
      !datosPago.monto ||
      Number(datosPago.monto) <= 0
    ) {
      setErrorPago(
        'Ingresa un monto válido.'
      )
      return
    }

    if (!datosPago.fecha_pago) {
      setErrorPago(
        'Debes indicar la fecha del pago.'
      )
      return
    }

    if (
      !datosPago.nueva_fecha_facturacion
    ) {
      setErrorPago(
        'Debes indicar la nueva fecha de facturación.'
      )
      return
    }

    setGuardandoPago(true)
    setErrorPago('')

    // ==========================================
    // COMPROBAR DUPLICADO
    // ==========================================

    const {
      data: gastoExistente,
      error: errorBusqueda,
    } =
      await supabase
        .from('gastos_cuentas')
        .select('id')
        .eq(
          'cuenta_id',
          cuentaPago.id
        )
        .eq(
          'fecha_pago',
          datosPago.fecha_pago
        )
        .eq(
          'tipo',
          'renovacion'
        )
        .limit(1)

    if (errorBusqueda) {
      console.error(
        errorBusqueda
      )

      setErrorPago(
        'No se pudo verificar el historial de pagos.'
      )

      setGuardandoPago(false)
      return
    }

    if (
      gastoExistente &&
      gastoExistente.length > 0
    ) {
      setErrorPago(
        'Ya existe una renovación registrada para esta cuenta en esa fecha.'
      )

      setGuardandoPago(false)
      return
    }

    // ==========================================
    // 1. REGISTRAR GASTO
    // ==========================================

    const {
      data: gastoCreado,
      error: errorGasto,
    } =
      await supabase
        .from('gastos_cuentas')
        .insert({
          cuenta_id:
            cuentaPago.id,

          monto:
            Number(datosPago.monto),

          fecha_pago:
            datosPago.fecha_pago,

          tipo:
            'renovacion',

          observaciones:
            `Renovación de ${cuentaPago.nombre}`,
        })
        .select()
        .single()

    if (errorGasto) {
      console.error(
        errorGasto
      )

      setErrorPago(
        'No se pudo registrar el pago.'
      )

      setGuardandoPago(false)
      return
    }

    // ==========================================
    // 2. ACTUALIZAR CUENTA
    // ==========================================

    const {
      error: errorActualizarCuenta,
    } =
      await supabase
        .from('cuentas')
        .update({
          costo:
            Number(datosPago.monto),

          fecha_facturacion:
            datosPago.nueva_fecha_facturacion,
        })
        .eq(
          'id',
          cuentaPago.id
        )

    if (errorActualizarCuenta) {
      console.error(
        errorActualizarCuenta
      )

      // Revertir gasto si falla
      await supabase
        .from('gastos_cuentas')
        .delete()
        .eq(
          'id',
          gastoCreado.id
        )

      setErrorPago(
        'No se pudo actualizar la fecha de facturación.'
      )

      setGuardandoPago(false)
      return
    }

    // ==========================================
    // 3. FINALIZAR
    // ==========================================

    setMostrarPago(false)
    setCuentaPago(null)
    setGuardandoPago(false)

    await cargarServicio()
  }

  // ==========================================
  // CARGANDO
  // ==========================================

  if (loading) {
    return (
      <div style={paginaSimple}>
        Cargando servicio...
      </div>
    )
  }

  if (!servicio) {
    return (
      <div style={paginaSimple}>
        Servicio no encontrado.
      </div>
    )
  }

  const color =
    servicio.color_principal ||
    '#0066ff'

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div
      style={{
        minHeight: '100vh',
        color: 'white',

        background: `
          radial-gradient(
            circle at 80% 10%,
            ${color}33,
            transparent 30%
          ),
          #030712
        `,

        padding: '30px 5%',
      }}
    >
      {/* VOLVER */}

      <button
        onClick={() =>
          navigate('/')
        }
        style={botonSecundario}
      >
        ← Volver
      </button>

      {/* ENCABEZADO */}

      <div
        style={{
          marginTop: '30px',
          marginBottom: '35px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '3px',
            color,
          }}
        >
          SERVICIO
        </span>

        <h1
          style={{
            margin: '8px 0',
          }}
        >
          {servicio.nombre}
        </h1>

        <p
          style={{
            color: '#94a3b8',
          }}
        >
          Administración de cuentas y perfiles
        </p>
      </div>

      {/* RESUMEN */}

      <div style={resumenGrid}>
        <div className="service-summary-card">
          <span>
            Precio actual
          </span>

          <strong>
            S/{' '}
            {Number(
              servicio.precio_actual
            ).toFixed(2)}
          </strong>
        </div>

        <div className="service-summary-card">
          <span>
            Perfiles por cuenta
          </span>

          <strong>
            {
              servicio.perfiles_por_cuenta
            }
          </strong>
        </div>

        <div className="service-summary-card">
          <span>
            Cuentas registradas
          </span>

          <strong>
            {cuentas.length}
          </strong>
        </div>
      </div>

      {/* TITULO CUENTAS */}

      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '15px',
        }}
      >
        <h2
          style={{
            margin: 0,
          }}
        >
          Cuentas
        </h2>

        <button
          onClick={
            abrirFormulario
          }
          style={{
            padding:
              '12px 18px',

            borderRadius:
              '8px',

            border:
              'none',

            background:
              color,

            color:
              'white',

            cursor:
              'pointer',

            fontWeight:
              'bold',
          }}
        >
          + Nueva cuenta
        </button>
      </div>

      {/* CUENTAS */}

      {cuentas.length === 0 ? (
        <div style={sinDatos}>
          Todavía no hay cuentas registradas para{' '}
          {servicio.nombre}.
        </div>
      ) : (
        <div style={cuentasGrid}>
          {cuentas.map(
            (cuenta) => {
              const ocupados =
                cuenta.perfiles?.filter(
                  (perfil) =>
                    perfil.estado ===
                    'ocupado'
                ).length || 0

              const total =
                cuenta.cantidad_maxima ||
                0

              return (
                <div
                  key={cuenta.id}
                  style={cuentaCard}
                >
                  <h3>
                    {cuenta.nombre}
                  </h3>

                  <p
                    style={{
                      color:
                        '#94a3b8',
                    }}
                  >
                    {ocupados} /{' '}
                    {total}{' '}
                    perfiles ocupados
                  </p>

                  <p>
                    <strong>
                      Correo:
                    </strong>{' '}

                    {cuenta.correo ||
                      'Sin correo'}
                  </p>

                  <p>
                    <strong>
                      Contraseña:
                    </strong>{' '}

                    {cuenta.contrasena ||
                      'Sin contraseña'}
                  </p>

                  <p>
                    <strong>
                      Costo:
                    </strong>{' '}

                    S/{' '}
                    {Number(
                      cuenta.costo || 0
                    ).toFixed(2)}
                  </p>

                  <p>
                    <strong>
                      Próximo pago:
                    </strong>{' '}

                    {cuenta.fecha_facturacion ||
                      'Sin fecha'}
                  </p>

                  {/* PERFILES */}

                  <div
                    style={{
                      marginTop:
                        '15px',

                      paddingTop:
                        '15px',

                      borderTop:
                        '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {[...(cuenta.perfiles || [])]
                      .sort(
                        (a, b) =>
                          a.numero_perfil -
                          b.numero_perfil
                      )
                      .map(
                        (perfil) => (
                          <div
                            key={
                              perfil.id
                            }
                            style={{
                              display:
                                'flex',

                              justifyContent:
                                'space-between',

                              marginBottom:
                                '7px',

                              fontSize:
                                '13px',
                            }}
                          >
                            <span>
                              Perfil{' '}
                              {
                                perfil.numero_perfil
                              }
                            </span>

                            <span
                              style={{
                                color:
                                  perfil.estado ===
                                  'ocupado'
                                    ? '#22c55e'
                                    : '#64748b',
                              }}
                            >
                              {perfil.estado ===
                              'ocupado'
                                ? 'OCUPADO'
                                : 'DISPONIBLE'}
                            </span>
                          </div>
                        )
                      )}
                  </div>

                  {/* BOTONES */}

                  <div
                    style={{
                      display:
                        'grid',

                      gridTemplateColumns:
                        '1fr 1fr',

                      gap:
                        '10px',

                      marginTop:
                        '15px',
                    }}
                  >
                    <button
                      onClick={() =>
                        abrirPago(
                          cuenta
                        )
                      }
                      style={{
                        ...botonSecundario,

                        border:
                          `1px solid ${color}55`,
                      }}
                    >
                      Registrar pago
                    </button>

                    <button
                      onClick={() =>
                        navigate(
                          `/cuenta/${cuenta.id}`
                        )
                      }
                      style={
                        botonSecundario
                      }
                    >
                      Administrar cuenta →
                    </button>
                  </div>
                </div>
              )
            }
          )}
        </div>
      )}

      {/* ======================================
          MODAL REGISTRAR PAGO
      ====================================== */}

      {mostrarPago &&
        cuentaPago && (
          <div
            onClick={
              cerrarPago
            }
            style={{
              ...overlay,
              zIndex: 1100,
            }}
          >
            <form
              onSubmit={
                registrarPago
              }
              onClick={(e) =>
                e.stopPropagation()
              }
              style={modal}
            >
              <div style={modalHeader}>
                <div>
                  <span
                    style={{
                      color,
                      fontSize:
                        '10px',
                      letterSpacing:
                        '3px',
                    }}
                  >
                    RENOVAR CUENTA
                  </span>

                  <h2
                    style={{
                      margin:
                        '6px 0 0',
                    }}
                  >
                    {
                      cuentaPago.nombre
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    cerrarPago
                  }
                  style={
                    botonCerrar
                  }
                >
                  ×
                </button>
              </div>

              <div style={infoPago}>
                <span
                  style={textoGris}
                >
                  Fecha actual de facturación
                </span>

                <strong>
                  {cuentaPago.fecha_facturacion ||
                    'Sin fecha'}
                </strong>

                <span
                  style={{
                    ...textoGris,
                    marginTop:
                      '12px',
                  }}
                >
                  Costo actual
                </span>

                <strong>
                  S/{' '}
                  {Number(
                    cuentaPago.costo ||
                      0
                  ).toFixed(2)}
                </strong>
              </div>

              <label
                style={labelStyle}
              >
                Monto pagado (S/)
              </label>

              <input
                name="monto"
                type="number"
                min="0"
                step="0.01"

                value={
                  datosPago.monto
                }

                onChange={
                  actualizarPago
                }

                style={inputStyle}

                required
              />

              <label
                style={labelStyle}
              >
                Fecha del pago
              </label>

              <input
                name="fecha_pago"
                type="date"

                value={
                  datosPago.fecha_pago
                }

                onChange={
                  actualizarPago
                }

                style={inputStyle}

                required
              />

              <label
                style={labelStyle}
              >
                Nueva fecha de facturación
              </label>

              <input
                name="nueva_fecha_facturacion"
                type="date"

                value={
                  datosPago.nueva_fecha_facturacion
                }

                onChange={
                  actualizarPago
                }

                style={inputStyle}

                required
              />

              {errorPago && (
                <div style={errorStyle}>
                  {errorPago}
                </div>
              )}

              <div style={botonesModal}>
                <button
                  type="button"

                  onClick={
                    cerrarPago
                  }

                  disabled={
                    guardandoPago
                  }

                  style={
                    botonSecundario
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"

                  disabled={
                    guardandoPago
                  }

                  style={{
                    ...botonPrincipal,
                    background:
                      color,
                  }}
                >
                  {guardandoPago
                    ? 'Registrando...'
                    : 'Confirmar pago'}
                </button>
              </div>
            </form>
          </div>
        )}

      {/* ======================================
          MODAL NUEVA CUENTA
      ====================================== */}

      {mostrarFormulario && (
        <div
          onClick={
            cerrarFormulario
          }
          style={overlay}
        >
          <form
            onSubmit={
              guardarCuenta
            }

            onClick={(e) =>
              e.stopPropagation()
            }

            style={modal}
          >
            <div style={modalHeader}>
              <div>
                <span
                  style={{
                    color,
                    fontSize:
                      '10px',

                    letterSpacing:
                      '3px',
                  }}
                >
                  {servicio.nombre.toUpperCase()}
                </span>

                <h2
                  style={{
                    margin:
                      '6px 0 0',
                  }}
                >
                  Nueva cuenta
                </h2>
              </div>

              <button
                type="button"

                onClick={
                  cerrarFormulario
                }

                style={
                  botonCerrar
                }
              >
                ×
              </button>
            </div>

            <label
              style={labelStyle}
            >
              Nombre de la cuenta
            </label>

            <input
              name="nombre"

              value={
                nuevaCuenta.nombre
              }

              onChange={
                actualizarCampo
              }

              style={inputStyle}

              required
            />

            <label
              style={labelStyle}
            >
              Correo
            </label>

            <input
              name="correo"
              type="email"

              value={
                nuevaCuenta.correo
              }

              onChange={
                actualizarCampo
              }

              placeholder="correo@ejemplo.com"

              style={inputStyle}
            />

            <label
              style={labelStyle}
            >
              Contraseña
            </label>

            <input
              name="contrasena"
              type="text"

              value={
                nuevaCuenta.contrasena
              }

              onChange={
                actualizarCampo
              }

              placeholder="Contraseña de la cuenta"

              style={inputStyle}
            />

            <label
              style={labelStyle}
            >
              Cantidad máxima de perfiles
            </label>

            <input
              name="cantidad_maxima"
              type="number"
              min="1"

              value={
                nuevaCuenta.cantidad_maxima
              }

              onChange={
                actualizarCampo
              }

              style={inputStyle}

              required
            />

            <label
              style={labelStyle}
            >
              Costo de la cuenta (S/)
            </label>

            <input
              name="costo"
              type="number"
              min="0"
              step="0.01"

              value={
                nuevaCuenta.costo
              }

              onChange={
                actualizarCampo
              }

              placeholder="Ejemplo: 35.00"

              style={inputStyle}
            />

            <div style={fechasGrid}>
              <div>
                <label
                  style={labelStyle}
                >
                  Fecha de inicio
                </label>

                <input
                  name="fecha_inicio"
                  type="date"

                  value={
                    nuevaCuenta.fecha_inicio
                  }

                  onChange={
                    actualizarCampo
                  }

                  style={
                    inputStyle
                  }
                />
              </div>

              <div>
                <label
                  style={labelStyle}
                >
                  Fecha de facturación
                </label>

                <input
                  name="fecha_facturacion"
                  type="date"

                  value={
                    nuevaCuenta.fecha_facturacion
                  }

                  onChange={
                    actualizarCampo
                  }

                  style={
                    inputStyle
                  }
                />
              </div>
            </div>

            <label
              style={labelStyle}
            >
              Observaciones
            </label>

            <textarea
              name="observaciones"

              value={
                nuevaCuenta.observaciones
              }

              onChange={
                actualizarCampo
              }

              rows="3"

              placeholder="Opcional"

              style={{
                ...inputStyle,
                resize:
                  'vertical',
              }}
            />

            {errorFormulario && (
              <div style={errorStyle}>
                {errorFormulario}
              </div>
            )}

            <div style={botonesModal}>
              <button
                type="button"

                onClick={
                  cerrarFormulario
                }

                disabled={
                  guardando
                }

                style={
                  botonSecundario
                }
              >
                Cancelar
              </button>

              <button
                type="submit"

                disabled={
                  guardando
                }

                style={{
                  ...botonPrincipal,
                  background:
                    color,
                }}
              >
                {guardando
                  ? 'Guardando...'
                  : 'Crear cuenta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ==========================================
// ESTILOS
// ==========================================

const paginaSimple = {
  minHeight: '100vh',
  padding: '40px',
  color: 'white',
  background: '#030712',
}

const resumenGrid = {
  display: 'grid',

  gridTemplateColumns:
    'repeat(auto-fit, minmax(220px, 1fr))',

  gap: '16px',
  marginBottom: '35px',
}

const cuentasGrid = {
  display: 'grid',

  gridTemplateColumns:
    'repeat(auto-fit, minmax(300px, 1fr))',

  gap: '20px',
}

const cuentaCard = {
  padding: '22px',

  borderRadius: '16px',

  border:
    '1px solid rgba(255,255,255,0.08)',

  background:
    'rgba(8,14,32,0.90)',
}

const sinDatos = {
  padding: '40px',

  textAlign: 'center',

  borderRadius: '14px',

  border:
    '1px solid rgba(255,255,255,0.08)',

  background:
    'rgba(255,255,255,0.03)',

  color: '#64748b',
}

const overlay = {
  position: 'fixed',
  inset: 0,

  zIndex: 1000,

  background:
    'rgba(0,0,0,0.72)',

  backdropFilter:
    'blur(8px)',

  display: 'flex',

  alignItems: 'center',

  justifyContent: 'center',

  padding: '20px',
}

const modal = {
  width: '100%',

  maxWidth: '560px',

  maxHeight: '90vh',

  overflowY: 'auto',

  padding: '28px',

  borderRadius: '18px',

  border:
    '1px solid rgba(255,255,255,0.10)',

  background: '#070d1d',

  boxShadow:
    '0 30px 100px rgba(0,0,0,0.60)',
}

const modalHeader = {
  display: 'flex',

  justifyContent:
    'space-between',

  alignItems:
    'center',

  marginBottom:
    '25px',
}

const labelStyle = {
  display: 'block',

  marginBottom:
    '7px',

  color:
    '#cbd5e1',

  fontSize:
    '12px',
}

const inputStyle = {
  width: '100%',

  marginBottom:
    '18px',

  padding:
    '12px 13px',

  borderRadius:
    '8px',

  border:
    '1px solid rgba(255,255,255,0.10)',

  background:
    'rgba(255,255,255,0.04)',

  color:
    'white',

  outline:
    'none',

  boxSizing:
    'border-box',
}

const botonSecundario = {
  padding:
    '11px',

  borderRadius:
    '8px',

  border:
    '1px solid rgba(255,255,255,0.10)',

  background:
    'rgba(255,255,255,0.04)',

  color:
    'white',

  cursor:
    'pointer',
}

const botonPrincipal = {
  padding:
    '13px',

  borderRadius:
    '9px',

  border:
    'none',

  color:
    'white',

  cursor:
    'pointer',

  fontWeight:
    'bold',
}

const botonCerrar = {
  border:
    'none',

  background:
    'transparent',

  color:
    '#94a3b8',

  fontSize:
    '22px',

  cursor:
    'pointer',
}

const botonesModal = {
  display:
    'grid',

  gridTemplateColumns:
    '1fr 1fr',

  gap:
    '12px',
}

const fechasGrid = {
  display:
    'grid',

  gridTemplateColumns:
    '1fr 1fr',

  gap:
    '15px',
}

const errorStyle = {
  marginBottom:
    '15px',

  padding:
    '12px',

  borderRadius:
    '8px',

  color:
    '#fca5a5',

  background:
    'rgba(239,68,68,0.10)',

  border:
    '1px solid rgba(239,68,68,0.20)',

  fontSize:
    '13px',
}

const infoPago = {
  padding:
    '14px',

  borderRadius:
    '10px',

  marginBottom:
    '20px',

  background:
    'rgba(255,255,255,0.03)',

  border:
    '1px solid rgba(255,255,255,0.08)',
}

const textoGris = {
  display:
    'block',

  color:
    '#64748b',

  fontSize:
    '11px',

  marginBottom:
    '5px',
}

export default Servicio