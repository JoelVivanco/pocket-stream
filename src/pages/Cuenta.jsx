import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Cuenta() {
    const { id } = useParams()
    const navigate = useNavigate()

    const [mostrarRenovar, setMostrarRenovar] = useState(false)
    const [perfilRenovar, setPerfilRenovar] = useState(null)
    const [guardandoRenovacion, setGuardandoRenovacion] = useState(false)
    const [errorRenovacion, setErrorRenovacion] = useState('')

    const [datosRenovacion, setDatosRenovacion] = useState({
        fecha_pago: '',
        proxima_fecha_cobro: '',
        monto: '',
    })

    const [mostrarEditarCliente, setMostrarEditarCliente] = useState(false)
    const [perfilEditar, setPerfilEditar] = useState(null)
    const [guardandoCliente, setGuardandoCliente] = useState(false)
    const [errorEditarCliente, setErrorEditarCliente] = useState('')

    const [datosClienteEditar, setDatosClienteEditar] = useState({
        nombre: '',
        telefono: '',
        fecha_inicio: '',
        fecha_cobro: '',
        precio: '',
    })

    const [mostrarEditarCuenta, setMostrarEditarCuenta] = useState(false)
    const [guardandoCuenta, setGuardandoCuenta] = useState(false)
    const [errorEditarCuenta, setErrorEditarCuenta] = useState('')

    const [datosCuenta, setDatosCuenta] = useState({
        nombre: '',
        correo: '',
        contrasena: '',
        fecha_inicio: '',
        fecha_facturacion: '',
        observaciones: '',
    })

    const [cuenta, setCuenta] = useState(null)
    const [perfiles, setPerfiles] = useState([])
    const [loading, setLoading] = useState(true)

    const [perfilSeleccionado, setPerfilSeleccionado] = useState(null)
    const [mostrarFormulario, setMostrarFormulario] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [errorFormulario, setErrorFormulario] = useState('')

    const [nuevoCliente, setNuevoCliente] = useState({
        nombre: '',
        telefono: '',
        fecha_inicio: '',
        fecha_cobro: '',
        precio: '',
    })

    useEffect(() => {
        cargarCuenta()
    }, [id])

    const cargarCuenta = async () => {
        setLoading(true)

        const { data: cuentaData, error: cuentaError } =
            await supabase
                .from('cuentas')
                .select(`
          *,
          servicios (
            id,
            nombre,
            color_principal,
            precio_actual
          )
        `)
                .eq('id', id)
                .single()

        if (cuentaError) {
            console.error(cuentaError)
            setLoading(false)
            return
        }

        const { data: perfilesData, error: perfilesError } =
            await supabase
                .from('perfiles')
                .select(`
          *,
          suscripciones (
            id,
            fecha_inicio,
            fecha_cobro,
            precio,
            estado,
            clientes (
              id,
              nombre,
              telefono
            )
          )
        `)
                .eq('cuenta_id', id)
                .order('numero_perfil')

        if (perfilesError) {
            console.error(perfilesError)
        }

        const procesados = (perfilesData || []).map((perfil) => {
            const suscripcionActiva =
                perfil.suscripciones?.find(
                    (suscripcion) => suscripcion.estado === 'activa'
                ) || null

            return {
                ...perfil,
                suscripcionActiva,
            }
        })

        setCuenta(cuentaData)
        setPerfiles(procesados)
        setLoading(false)
    }

    const abrirAsignacion = (perfil) => {
        setPerfilSeleccionado(perfil)

        const hoy = new Date()
        const siguienteMes = new Date(hoy)
        siguienteMes.setMonth(siguienteMes.getMonth() + 1)

        const formatoFecha = (fecha) =>
            fecha.toISOString().split('T')[0]

        setNuevoCliente({
            nombre: '',
            telefono: '',
            fecha_inicio: formatoFecha(hoy),
            fecha_cobro: formatoFecha(siguienteMes),
            precio: cuenta?.servicios?.precio_actual || '',
        })

        setErrorFormulario('')
        setMostrarFormulario(true)
    }

    const cerrarFormulario = () => {
        if (guardando) return

        setMostrarFormulario(false)
        setPerfilSeleccionado(null)
        setErrorFormulario('')
    }

    const actualizarCampo = (e) => {
        const { name, value } = e.target

        setNuevoCliente((actual) => ({
            ...actual,
            [name]: value,
        }))
    }

    const asignarCliente = async (e) => {
        e.preventDefault()

        setErrorFormulario('')

        if (!nuevoCliente.nombre.trim()) {
            setErrorFormulario('Ingresa el nombre del cliente.')
            return
        }

        if (!nuevoCliente.telefono.trim()) {
            setErrorFormulario('Ingresa el número de celular.')
            return
        }

        if (!nuevoCliente.fecha_inicio || !nuevoCliente.fecha_cobro) {
            setErrorFormulario('Debes indicar las fechas.')
            return
        }

        if (!nuevoCliente.precio || Number(nuevoCliente.precio) <= 0) {
            setErrorFormulario('Ingresa un precio válido.')
            return
        }

        setGuardando(true)

        try {
            let clienteId = null

            const { data: clientesExistentes, error: buscarError } =
                await supabase
                    .from('clientes')
                    .select('id, nombre, telefono')
                    .eq('telefono', nuevoCliente.telefono.trim())
                    .limit(1)

            if (buscarError) {
                throw buscarError
            }

            if (clientesExistentes && clientesExistentes.length > 0) {
                clienteId = clientesExistentes[0].id

                const { error: actualizarClienteError } =
                    await supabase
                        .from('clientes')
                        .update({
                            nombre: nuevoCliente.nombre.trim(),
                        })
                        .eq('id', clienteId)

                if (actualizarClienteError) {
                    throw actualizarClienteError
                }
            } else {
                const { data: clienteCreado, error: clienteError } =
                    await supabase
                        .from('clientes')
                        .insert({
                            nombre: nuevoCliente.nombre.trim(),
                            telefono: nuevoCliente.telefono.trim(),
                        })
                        .select()
                        .single()

                if (clienteError) {
                    throw clienteError
                }

                clienteId = clienteCreado.id
            }

            const { data: suscripcionCreada, error: suscripcionError } =
                await supabase
                    .from('suscripciones')
                    .insert({
                        cliente_id: clienteId,
                        perfil_id: perfilSeleccionado.id,
                        fecha_inicio: nuevoCliente.fecha_inicio,
                        fecha_cobro: nuevoCliente.fecha_cobro,
                        precio: Number(nuevoCliente.precio),
                        estado: 'activa',
                    })
                    .select()
                    .single()

            if (suscripcionError) {
                throw suscripcionError
            }

            const { error: perfilError } =
                await supabase
                    .from('perfiles')
                    .update({
                        estado: 'ocupado',
                    })
                    .eq('id', perfilSeleccionado.id)

            if (perfilError) {
                await supabase
                    .from('suscripciones')
                    .delete()
                    .eq('id', suscripcionCreada.id)

                throw perfilError
            }

            const { error: ventaError } =
                await supabase
                    .from('ventas')
                    .insert({
                        cliente_id: clienteId,
                        servicio_id: cuenta.servicio_id,
                        cuenta_id: cuenta.id,
                        perfil_id: perfilSeleccionado.id,
                        suscripcion_id: suscripcionCreada.id,
                        tipo: 'nueva',
                        monto: Number(nuevoCliente.precio),
                        fecha: nuevoCliente.fecha_inicio,
                    })

            if (ventaError) {
                console.error(
                    'La asignación se realizó, pero no se registró la venta:',
                    ventaError
                )
            }

            setMostrarFormulario(false)
            setPerfilSeleccionado(null)

            await cargarCuenta()
        } catch (error) {
            console.error(error)

            setErrorFormulario(
                'No se pudo asignar el cliente. Revisa los datos.'
            )
        } finally {
            setGuardando(false)
        }
    }

    const liberarPerfil = async (perfil) => {
        const confirmar = window.confirm(
            `¿Deseas liberar el Perfil ${perfil.numero_perfil}?`
        )

        if (!confirmar) return

        const suscripcion = perfil.suscripcionActiva

        if (suscripcion) {
            const { error } =
                await supabase
                    .from('suscripciones')
                    .update({
                        estado: 'finalizada',
                    })
                    .eq('id', suscripcion.id)

            if (error) {
                console.error(error)
                return
            }
        }

        const { error: perfilError } =
            await supabase
                .from('perfiles')
                .update({
                    estado: 'disponible',
                })
                .eq('id', perfil.id)

        if (perfilError) {
            console.error(perfilError)
            return
        }

        await cargarCuenta()
    }

    const copiarTexto = async (texto) => {
        if (!texto) return

        await navigator.clipboard.writeText(texto)
    }
    const abrirEditarCuenta = () => {
        setDatosCuenta({
            nombre: cuenta.nombre || '',
            correo: cuenta.correo || '',
            contrasena: cuenta.contrasena || '',
            fecha_inicio: cuenta.fecha_inicio || '',
            fecha_facturacion: cuenta.fecha_facturacion || '',
            observaciones: cuenta.observaciones || '',
        })

        setErrorEditarCuenta('')
        setMostrarEditarCuenta(true)
    }

    const cerrarEditarCuenta = () => {
        if (guardandoCuenta) return

        setMostrarEditarCuenta(false)
        setErrorEditarCuenta('')
    }

    const actualizarDatosCuenta = (e) => {
        const { name, value } = e.target

        setDatosCuenta((actual) => ({
            ...actual,
            [name]: value,
        }))
    }

    const guardarCambiosCuenta = async (e) => {
        e.preventDefault()

        if (!datosCuenta.nombre.trim()) {
            setErrorEditarCuenta('El nombre de la cuenta es obligatorio.')
            return
        }

        setGuardandoCuenta(true)
        setErrorEditarCuenta('')

        const { error } = await supabase
            .from('cuentas')
            .update({
                nombre: datosCuenta.nombre.trim(),
                correo: datosCuenta.correo.trim() || null,
                contrasena: datosCuenta.contrasena || null,
                fecha_inicio: datosCuenta.fecha_inicio || null,
                fecha_facturacion: datosCuenta.fecha_facturacion || null,
                observaciones: datosCuenta.observaciones.trim() || null,
            })
            .eq('id', cuenta.id)

        if (error) {
            console.error(error)
            setErrorEditarCuenta('No se pudieron guardar los cambios.')
            setGuardandoCuenta(false)
            return
        }

        setMostrarEditarCuenta(false)
        setGuardandoCuenta(false)

        await cargarCuenta()
    }

    const abrirEditarCliente = (perfil) => {
        const suscripcion = perfil.suscripcionActiva
        const cliente = suscripcion?.clientes

        if (!suscripcion || !cliente) return

        setPerfilEditar(perfil)

        setDatosClienteEditar({
            nombre: cliente.nombre || '',
            telefono: cliente.telefono || '',
            fecha_inicio: suscripcion.fecha_inicio || '',
            fecha_cobro: suscripcion.fecha_cobro || '',
            precio: suscripcion.precio || '',
        })

        setErrorEditarCliente('')
        setMostrarEditarCliente(true)
    }

    const cerrarEditarCliente = () => {
        if (guardandoCliente) return

        setMostrarEditarCliente(false)
        setPerfilEditar(null)
        setErrorEditarCliente('')
    }

    const actualizarClienteEditar = (e) => {
        const { name, value } = e.target

        setDatosClienteEditar((actual) => ({
            ...actual,
            [name]: value,
        }))
    }

    const guardarCambiosCliente = async (e) => {
        e.preventDefault()

        if (!perfilEditar?.suscripcionActiva) {
            return
        }

        if (!datosClienteEditar.nombre.trim()) {
            setErrorEditarCliente('El nombre del cliente es obligatorio.')
            return
        }

        if (!datosClienteEditar.telefono.trim()) {
            setErrorEditarCliente('El número de celular es obligatorio.')
            return
        }

        if (
            !datosClienteEditar.fecha_inicio ||
            !datosClienteEditar.fecha_cobro
        ) {
            setErrorEditarCliente('Debes indicar las fechas.')
            return
        }

        if (
            !datosClienteEditar.precio ||
            Number(datosClienteEditar.precio) <= 0
        ) {
            setErrorEditarCliente('Ingresa un precio válido.')
            return
        }

        setGuardandoCliente(true)
        setErrorEditarCliente('')

        const suscripcion = perfilEditar.suscripcionActiva
        const cliente = suscripcion.clientes

        const { error: clienteError } =
            await supabase
                .from('clientes')
                .update({
                    nombre: datosClienteEditar.nombre.trim(),
                    telefono: datosClienteEditar.telefono.trim(),
                })
                .eq('id', cliente.id)

        if (clienteError) {
            console.error(clienteError)

            setErrorEditarCliente(
                'No se pudieron actualizar los datos del cliente.'
            )

            setGuardandoCliente(false)
            return
        }

        const { error: suscripcionError } =
            await supabase
                .from('suscripciones')
                .update({
                    fecha_inicio: datosClienteEditar.fecha_inicio,
                    fecha_cobro: datosClienteEditar.fecha_cobro,
                    precio: Number(datosClienteEditar.precio),
                })
                .eq('id', suscripcion.id)

        if (suscripcionError) {
            console.error(suscripcionError)

            setErrorEditarCliente(
                'No se pudieron actualizar los datos de la suscripción.'
            )

            setGuardandoCliente(false)
            return
        }

        setMostrarEditarCliente(false)
        setPerfilEditar(null)
        setGuardandoCliente(false)

        await cargarCuenta()
    }

    const sumarUnMes = (fechaTexto) => {
        if (!fechaTexto) return ''

        const [anio, mes, dia] = fechaTexto.split('-').map(Number)

        const ultimoDiaSiguienteMes = new Date(
            anio,
            mes + 1,
            0
        ).getDate()

        const diaSeguro = Math.min(dia, ultimoDiaSiguienteMes)

        const nuevaFecha = new Date(
            anio,
            mes,
            diaSeguro
        )

        const nuevoAnio = nuevaFecha.getFullYear()
        const nuevoMes = String(
            nuevaFecha.getMonth() + 1
        ).padStart(2, '0')

        const nuevoDia = String(
            nuevaFecha.getDate()
        ).padStart(2, '0')

        return `${nuevoAnio}-${nuevoMes}-${nuevoDia}`
    }

    const abrirRenovacion = (perfil) => {
        const suscripcion = perfil.suscripcionActiva

        if (!suscripcion) return

        const hoy = new Date()

        const fechaPago = [
            hoy.getFullYear(),
            String(hoy.getMonth() + 1).padStart(2, '0'),
            String(hoy.getDate()).padStart(2, '0'),
        ].join('-')

        setPerfilRenovar(perfil)

        setDatosRenovacion({
            fecha_pago: fechaPago,
            proxima_fecha_cobro: sumarUnMes(
                suscripcion.fecha_cobro
            ),
            monto: suscripcion.precio || '',
        })

        setErrorRenovacion('')
        setMostrarRenovar(true)
    }

    const cerrarRenovacion = () => {
        if (guardandoRenovacion) return

        setMostrarRenovar(false)
        setPerfilRenovar(null)
        setErrorRenovacion('')
    }

    const actualizarRenovacion = (e) => {
        const { name, value } = e.target

        setDatosRenovacion((actual) => ({
            ...actual,
            [name]: value,
        }))
    }

    const guardarRenovacion = async (e) => {
        e.preventDefault()

        const suscripcion =
            perfilRenovar?.suscripcionActiva

        const cliente =
            suscripcion?.clientes

        if (!suscripcion || !cliente) {
            setErrorRenovacion(
                'No se encontró la suscripción activa.'
            )
            return
        }

        if (
            !datosRenovacion.fecha_pago ||
            !datosRenovacion.proxima_fecha_cobro
        ) {
            setErrorRenovacion(
                'Debes indicar las fechas.'
            )
            return
        }

        if (
            !datosRenovacion.monto ||
            Number(datosRenovacion.monto) <= 0
        ) {
            setErrorRenovacion(
                'Ingresa un monto válido.'
            )
            return
        }

        setGuardandoRenovacion(true)
        setErrorRenovacion('')

        const fechaAnterior = suscripcion.fecha_cobro

        const { error: suscripcionError } =
            await supabase
                .from('suscripciones')
                .update({
                    fecha_cobro:
                        datosRenovacion.proxima_fecha_cobro,
                    precio: Number(datosRenovacion.monto),
                })
                .eq('id', suscripcion.id)

        if (suscripcionError) {
            console.error(suscripcionError)

            setErrorRenovacion(
                'No se pudo actualizar la suscripción.'
            )

            setGuardandoRenovacion(false)
            return
        }

        const { error: ventaError } =
            await supabase
                .from('ventas')
                .insert({
                    cliente_id: cliente.id,
                    servicio_id: cuenta.servicio_id,
                    cuenta_id: cuenta.id,
                    perfil_id: perfilRenovar.id,
                    suscripcion_id: suscripcion.id,
                    tipo: 'renovacion',
                    monto: Number(datosRenovacion.monto),
                    fecha: datosRenovacion.fecha_pago,
                })

        if (ventaError) {
            console.error(ventaError)

            // Revertimos la fecha para no dejar una
            // renovación sin su correspondiente venta.
            await supabase
                .from('suscripciones')
                .update({
                    fecha_cobro: fechaAnterior,
                    precio: suscripcion.precio,
                })
                .eq('id', suscripcion.id)

            setErrorRenovacion(
                'No se pudo registrar la venta de renovación.'
            )

            setGuardandoRenovacion(false)
            return
        }

        setMostrarRenovar(false)
        setPerfilRenovar(null)
        setGuardandoRenovacion(false)

        await cargarCuenta()
    }

    if (loading) {
        return (
            <div style={paginaSimple}>
                Cargando cuenta...
            </div>
        )
    }

    if (!cuenta) {
        return (
            <div style={paginaSimple}>
                Cuenta no encontrada.
            </div>
        )
    }

    const ocupados =
        perfiles.filter(
            (perfil) => perfil.estado === 'ocupado'
        ).length

    const color =
        cuenta.servicios?.color_principal || '#0066ff'

    return (
        <div
            style={{
                minHeight: '100vh',
                color: 'white',
                padding: '30px 5% 70px',
                background: `
          radial-gradient(
            circle at 80% 10%,
            ${color}33,
            transparent 30%
          ),
          #030712
        `,
            }}
        >
            <button
                onClick={() =>
                    navigate(`/servicio/${cuenta.servicio_id}`)
                }
                style={botonSecundario}
            >
                ← Volver a {cuenta.servicios?.nombre}
            </button>

            <div
                style={{
                    marginTop: '30px',
                    marginBottom: '30px',
                }}
            >
                <span
                    style={{
                        fontSize: '11px',
                        letterSpacing: '3px',
                        color,
                    }}
                >
                    {cuenta.servicios?.nombre?.toUpperCase()}
                </span>

                <h1
                    style={{
                        margin: '8px 0',
                        fontSize: '38px',
                    }}
                >
                    {cuenta.nombre}
                </h1>

                <p style={{ color: '#94a3b8' }}>
                    Administración de cuenta y perfiles
                </p>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns:
                        'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: '16px',
                    marginBottom: '35px',
                }}
            >
                <div style={resumenCard}>
                    <span style={textoGris}>
                        Perfiles ocupados
                    </span>

                    <strong style={numeroGrande}>
                        {ocupados} / {cuenta.cantidad_maxima}
                    </strong>
                </div>

                <div style={resumenCard}>
                    <span style={textoGris}>
                        Perfiles disponibles
                    </span>

                    <strong style={numeroGrande}>
                        {cuenta.cantidad_maxima - ocupados}
                    </strong>
                </div>

                <div style={resumenCard}>
                    <span style={textoGris}>
                        Estado
                    </span>

                    <strong style={numeroGrande}>
                        {cuenta.estado?.toUpperCase()}
                    </strong>
                </div>
            </div>

            <div style={credencialesCard}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '15px',
                        marginBottom: '20px',
                    }}
                >
                    <h2 style={{ margin: 0 }}>
                        Datos de acceso
                    </h2>

                    <button
                        onClick={abrirEditarCuenta}
                        style={botonSecundario}
                    >
                        ✎ Editar cuenta
                    </button>
                </div>

                <div style={filaCredencial}>
                    <div>
                        <span style={textoGris}>
                            Correo
                        </span>

                        <div style={textoCredencial}>
                            {cuenta.correo || 'Sin correo'}
                        </div>
                    </div>

                    <button
                        onClick={() =>
                            copiarTexto(cuenta.correo)
                        }
                        style={botonSecundario}
                    >
                        Copiar
                    </button>
                </div>

                <div style={filaCredencial}>
                    <div>
                        <span style={textoGris}>
                            Contraseña
                        </span>

                        <div style={textoCredencial}>
                            {cuenta.contrasena || 'Sin contraseña'}
                        </div>
                    </div>

                    <button
                        onClick={() =>
                            copiarTexto(cuenta.contrasena)
                        }
                        style={botonSecundario}
                    >
                        Copiar
                    </button>
                </div>
            </div>

            <div
                style={{
                    marginTop: '40px',
                    marginBottom: '18px',
                }}
            >
                <span
                    style={{
                        fontSize: '11px',
                        letterSpacing: '3px',
                        color,
                    }}
                >
                    PERFILES
                </span>

                <h2 style={{ margin: '8px 0' }}>
                    Usuarios de la cuenta
                </h2>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns:
                        'repeat(auto-fit, minmax(290px, 1fr))',
                    gap: '18px',
                }}
            >
                {perfiles.map((perfil) => {
                    const suscripcion =
                        perfil.suscripcionActiva

                    const cliente =
                        suscripcion?.clientes

                    const ocupado =
                        perfil.estado === 'ocupado'

                    return (
                        <div
                            key={perfil.id}
                            style={{
                                padding: '22px',
                                borderRadius: '16px',
                                border:
                                    ocupado
                                        ? `1px solid ${color}55`
                                        : '1px solid rgba(255,255,255,0.08)',
                                background:
                                    'rgba(8,14,32,0.92)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent:
                                        'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <h3 style={{ margin: 0 }}>
                                    Perfil {perfil.numero_perfil}
                                </h3>

                                <span
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: ocupado
                                            ? '#22c55e'
                                            : '#64748b',
                                    }}
                                >
                                    {ocupado
                                        ? 'OCUPADO'
                                        : 'DISPONIBLE'}
                                </span>
                            </div>

                            {ocupado && suscripcion ? (
                                <>
                                    <div style={datosCliente}>
                                        <div>
                                            <span style={textoGris}>
                                                Cliente
                                            </span>

                                            <strong>
                                                {cliente?.nombre}
                                            </strong>
                                        </div>

                                        <div>
                                            <span style={textoGris}>
                                                Celular
                                            </span>

                                            <strong>
                                                {cliente?.telefono}
                                            </strong>
                                        </div>

                                        <div>
                                            <span style={textoGris}>
                                                Inicio
                                            </span>

                                            <strong>
                                                {suscripcion.fecha_inicio}
                                            </strong>
                                        </div>

                                        <div>
                                            <span style={textoGris}>
                                                Próximo cobro
                                            </span>

                                            <strong>
                                                {suscripcion.fecha_cobro}
                                            </strong>
                                        </div>

                                        <div>
                                            <span style={textoGris}>
                                                Precio
                                            </span>

                                            <strong>
                                                S/ {Number(
                                                    suscripcion.precio
                                                ).toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr 1fr',
                                            gap: '10px',
                                            marginTop: '18px',
                                        }}
                                    >
                                        <button
                                            onClick={() => abrirEditarCliente(perfil)}
                                            style={botonSecundario}
                                        >
                                            ✎ Editar
                                        </button>

                                        <button
                                            onClick={() => abrirRenovacion(perfil)}
                                            style={{
                                                ...botonSecundario,
                                                border: `1px solid ${color}55`,
                                            }}
                                        >
                                            ↻ Renovar
                                        </button>

                                        <button
                                            onClick={() => liberarPerfil(perfil)}
                                            style={botonSecundario}
                                        >
                                            Liberar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <button
                                    onClick={() =>
                                        abrirAsignacion(perfil)
                                    }
                                    style={{
                                        width: '100%',
                                        marginTop: '25px',
                                        padding: '12px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: color,
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    + Asignar cliente
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
            {mostrarEditarCuenta && (
                <div
                    onClick={cerrarEditarCuenta}
                    style={overlay}
                >
                    <form
                        onSubmit={guardarCambiosCuenta}
                        onClick={(e) => e.stopPropagation()}
                        style={modal}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '25px',
                            }}
                        >
                            <div>
                                <span
                                    style={{
                                        color,
                                        fontSize: '10px',
                                        letterSpacing: '3px',
                                    }}
                                >
                                    CONFIGURACIÓN
                                </span>

                                <h2 style={{ margin: '6px 0 0' }}>
                                    Editar cuenta
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarEditarCuenta}
                                style={cerrarModal}
                            >
                                ×
                            </button>
                        </div>

                        <label style={labelStyle}>
                            Nombre de la cuenta
                        </label>

                        <input
                            name="nombre"
                            value={datosCuenta.nombre}
                            onChange={actualizarDatosCuenta}
                            style={inputStyle}
                            required
                        />

                        <label style={labelStyle}>
                            Correo
                        </label>

                        <input
                            name="correo"
                            type="email"
                            value={datosCuenta.correo}
                            onChange={actualizarDatosCuenta}
                            style={inputStyle}
                        />

                        <label style={labelStyle}>
                            Contraseña
                        </label>

                        <input
                            name="contrasena"
                            type="text"
                            value={datosCuenta.contrasena}
                            onChange={actualizarDatosCuenta}
                            style={inputStyle}
                        />

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '15px',
                            }}
                        >
                            <div>
                                <label style={labelStyle}>
                                    Fecha de inicio
                                </label>

                                <input
                                    name="fecha_inicio"
                                    type="date"
                                    value={datosCuenta.fecha_inicio}
                                    onChange={actualizarDatosCuenta}
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>
                                    Fecha de facturación
                                </label>

                                <input
                                    name="fecha_facturacion"
                                    type="date"
                                    value={datosCuenta.fecha_facturacion}
                                    onChange={actualizarDatosCuenta}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <label style={labelStyle}>
                            Observaciones
                        </label>

                        <textarea
                            name="observaciones"
                            value={datosCuenta.observaciones}
                            onChange={actualizarDatosCuenta}
                            rows="3"
                            placeholder="Información adicional de esta cuenta"
                            style={{
                                ...inputStyle,
                                resize: 'vertical',
                            }}
                        />

                        {errorEditarCuenta && (
                            <div style={errorStyle}>
                                {errorEditarCuenta}
                            </div>
                        )}

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                            }}
                        >
                            <button
                                type="button"
                                onClick={cerrarEditarCuenta}
                                disabled={guardandoCuenta}
                                style={botonSecundario}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={guardandoCuenta}
                                style={{
                                    padding: '13px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    background: color,
                                    color: 'white',
                                    cursor:
                                        guardandoCuenta
                                            ? 'wait'
                                            : 'pointer',
                                    fontWeight: 'bold',
                                }}
                            >
                                {guardandoCuenta
                                    ? 'Guardando...'
                                    : 'Guardar cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {mostrarEditarCliente && perfilEditar && (
                <div
                    onClick={cerrarEditarCliente}
                    style={overlay}
                >
                    <form
                        onSubmit={guardarCambiosCliente}
                        onClick={(e) => e.stopPropagation()}
                        style={modal}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '25px',
                            }}
                        >
                            <div>
                                <span
                                    style={{
                                        color,
                                        fontSize: '10px',
                                        letterSpacing: '3px',
                                    }}
                                >
                                    PERFIL {perfilEditar.numero_perfil}
                                </span>

                                <h2 style={{ margin: '6px 0 0' }}>
                                    Editar cliente
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarEditarCliente}
                                style={cerrarModal}
                            >
                                ×
                            </button>
                        </div>

                        <label style={labelStyle}>
                            Nombre del cliente
                        </label>

                        <input
                            name="nombre"
                            value={datosClienteEditar.nombre}
                            onChange={actualizarClienteEditar}
                            style={inputStyle}
                            required
                        />

                        <label style={labelStyle}>
                            Número de celular
                        </label>

                        <input
                            name="telefono"
                            value={datosClienteEditar.telefono}
                            onChange={actualizarClienteEditar}
                            style={inputStyle}
                            required
                        />

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '15px',
                            }}
                        >
                            <div>
                                <label style={labelStyle}>
                                    Fecha de inicio
                                </label>

                                <input
                                    name="fecha_inicio"
                                    type="date"
                                    value={datosClienteEditar.fecha_inicio}
                                    onChange={actualizarClienteEditar}
                                    style={inputStyle}
                                    required
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>
                                    Fecha de cobro
                                </label>

                                <input
                                    name="fecha_cobro"
                                    type="date"
                                    value={datosClienteEditar.fecha_cobro}
                                    onChange={actualizarClienteEditar}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                        </div>

                        <label style={labelStyle}>
                            Precio
                        </label>

                        <input
                            name="precio"
                            type="number"
                            min="0"
                            step="0.01"
                            value={datosClienteEditar.precio}
                            onChange={actualizarClienteEditar}
                            style={inputStyle}
                            required
                        />

                        {errorEditarCliente && (
                            <div style={errorStyle}>
                                {errorEditarCliente}
                            </div>
                        )}

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                            }}
                        >
                            <button
                                type="button"
                                onClick={cerrarEditarCliente}
                                disabled={guardandoCliente}
                                style={botonSecundario}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={guardandoCliente}
                                style={{
                                    padding: '13px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    background: color,
                                    color: 'white',
                                    cursor:
                                        guardandoCliente
                                            ? 'wait'
                                            : 'pointer',
                                    fontWeight: 'bold',
                                }}
                            >
                                {guardandoCliente
                                    ? 'Guardando...'
                                    : 'Guardar cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {mostrarRenovar && perfilRenovar && (
                <div
                    onClick={cerrarRenovacion}
                    style={overlay}
                >
                    <form
                        onSubmit={guardarRenovacion}
                        onClick={(e) => e.stopPropagation()}
                        style={modal}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '25px',
                            }}
                        >
                            <div>
                                <span
                                    style={{
                                        color,
                                        fontSize: '10px',
                                        letterSpacing: '3px',
                                    }}
                                >
                                    PERFIL {perfilRenovar.numero_perfil}
                                </span>

                                <h2 style={{ margin: '6px 0 0' }}>
                                    Renovar servicio
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarRenovacion}
                                style={cerrarModal}
                            >
                                ×
                            </button>
                        </div>

                        <div
                            style={{
                                padding: '14px',
                                marginBottom: '20px',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                border:
                                    '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            <span style={textoGris}>
                                Cliente
                            </span>

                            <strong>
                                {
                                    perfilRenovar
                                        .suscripcionActiva
                                        ?.clientes
                                        ?.nombre
                                }
                            </strong>

                            <span
                                style={{
                                    ...textoGris,
                                    marginTop: '12px',
                                }}
                            >
                                Vencimiento actual
                            </span>

                            <strong>
                                {
                                    perfilRenovar
                                        .suscripcionActiva
                                        ?.fecha_cobro
                                }
                            </strong>
                        </div>

                        <label style={labelStyle}>
                            Fecha del pago
                        </label>

                        <input
                            name="fecha_pago"
                            type="date"
                            value={datosRenovacion.fecha_pago}
                            onChange={actualizarRenovacion}
                            style={inputStyle}
                            required
                        />

                        <label style={labelStyle}>
                            Próxima fecha de cobro
                        </label>

                        <input
                            name="proxima_fecha_cobro"
                            type="date"
                            value={
                                datosRenovacion.proxima_fecha_cobro
                            }
                            onChange={actualizarRenovacion}
                            style={inputStyle}
                            required
                        />

                        <label style={labelStyle}>
                            Monto pagado
                        </label>

                        <input
                            name="monto"
                            type="number"
                            min="0"
                            step="0.01"
                            value={datosRenovacion.monto}
                            onChange={actualizarRenovacion}
                            style={inputStyle}
                            required
                        />

                        {errorRenovacion && (
                            <div style={errorStyle}>
                                {errorRenovacion}
                            </div>
                        )}

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px',
                            }}
                        >
                            <button
                                type="button"
                                onClick={cerrarRenovacion}
                                disabled={guardandoRenovacion}
                                style={botonSecundario}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={guardandoRenovacion}
                                style={{
                                    padding: '13px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    background: color,
                                    color: 'white',
                                    cursor: guardandoRenovacion
                                        ? 'wait'
                                        : 'pointer',
                                    fontWeight: 'bold',
                                }}
                            >
                                {guardandoRenovacion
                                    ? 'Renovando...'
                                    : 'Confirmar renovación'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {mostrarFormulario && perfilSeleccionado && (
                <div
                    onClick={cerrarFormulario}
                    style={overlay}
                >
                    <form
                        onSubmit={asignarCliente}
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                        style={modal}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent:
                                    'space-between',
                                alignItems: 'center',
                                marginBottom: '25px',
                            }}
                        >
                            <div>
                                <span
                                    style={{
                                        color,
                                        fontSize: '10px',
                                        letterSpacing: '3px',
                                    }}
                                >
                                    PERFIL{' '}
                                    {perfilSeleccionado.numero_perfil}
                                </span>

                                <h2
                                    style={{
                                        margin: '6px 0 0',
                                    }}
                                >
                                    Asignar cliente
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarFormulario}
                                style={cerrarModal}
                            >
                                ×
                            </button>
                        </div>

                        <label style={labelStyle}>
                            Nombre del cliente
                        </label>

                        <input
                            name="nombre"
                            value={nuevoCliente.nombre}
                            onChange={actualizarCampo}
                            style={inputStyle}
                            required
                        />

                        <label style={labelStyle}>
                            Número de celular
                        </label>

                        <input
                            name="telefono"
                            value={nuevoCliente.telefono}
                            onChange={actualizarCampo}
                            placeholder="999999999"
                            style={inputStyle}
                            required
                        />

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    '1fr 1fr',
                                gap: '15px',
                            }}
                        >
                            <div>
                                <label style={labelStyle}>
                                    Fecha de inicio
                                </label>

                                <input
                                    name="fecha_inicio"
                                    type="date"
                                    value={
                                        nuevoCliente.fecha_inicio
                                    }
                                    onChange={actualizarCampo}
                                    style={inputStyle}
                                    required
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>
                                    Fecha de cobro
                                </label>

                                <input
                                    name="fecha_cobro"
                                    type="date"
                                    value={
                                        nuevoCliente.fecha_cobro
                                    }
                                    onChange={actualizarCampo}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                        </div>

                        <label style={labelStyle}>
                            Precio cobrado
                        </label>

                        <input
                            name="precio"
                            type="number"
                            min="0"
                            step="0.01"
                            value={nuevoCliente.precio}
                            onChange={actualizarCampo}
                            style={inputStyle}
                            required
                        />

                        {errorFormulario && (
                            <div style={errorStyle}>
                                {errorFormulario}
                            </div>
                        )}

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    '1fr 1fr',
                                gap: '12px',
                            }}
                        >
                            <button
                                type="button"
                                onClick={cerrarFormulario}
                                disabled={guardando}
                                style={botonSecundario}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={guardando}
                                style={{
                                    padding: '13px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    background: color,
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                }}
                            >
                                {guardando
                                    ? 'Guardando...'
                                    : 'Asignar cliente'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

const paginaSimple = {
    minHeight: '100vh',
    padding: '40px',
    color: 'white',
    background: '#030712',
}

const resumenCard = {
    padding: '20px',
    borderRadius: '14px',
    border:
        '1px solid rgba(255,255,255,0.08)',
    background:
        'rgba(255,255,255,0.03)',
}

const credencialesCard = {
    padding: '24px',
    borderRadius: '16px',
    border:
        '1px solid rgba(255,255,255,0.08)',
    background:
        'rgba(8,14,32,0.92)',
}

const filaCredencial = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginTop: '16px',
}

const textoGris = {
    display: 'block',
    color: '#64748b',
    fontSize: '11px',
    marginBottom: '5px',
}

const numeroGrande = {
    display: 'block',
    fontSize: '25px',
    marginTop: '7px',
}

const textoCredencial = {
    fontSize: '16px',
}

const datosCliente = {
    display: 'grid',
    gap: '15px',
    marginTop: '22px',
}

const botonSecundario = {
    padding: '10px 14px',
    borderRadius: '8px',
    border:
        '1px solid rgba(255,255,255,0.10)',
    background:
        'rgba(255,255,255,0.04)',
    color: 'white',
    cursor: 'pointer',
}

const overlay = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
}

const modal = {
    width: '100%',
    maxWidth: '530px',
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

const cerrarModal = {
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '22px',
    cursor: 'pointer',
}

const labelStyle = {
    display: 'block',
    marginBottom: '7px',
    color: '#cbd5e1',
    fontSize: '12px',
}

const inputStyle = {
    width: '100%',
    marginBottom: '18px',
    padding: '12px 13px',
    borderRadius: '8px',
    border:
        '1px solid rgba(255,255,255,0.10)',
    background:
        'rgba(255,255,255,0.04)',
    color: 'white',
    outline: 'none',
}

const errorStyle = {
    marginBottom: '15px',
    padding: '12px',
    borderRadius: '8px',
    color: '#fca5a5',
    background:
        'rgba(239,68,68,0.10)',
    border:
        '1px solid rgba(239,68,68,0.20)',
    fontSize: '13px',
}

export default Cuenta