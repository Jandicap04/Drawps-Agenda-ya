import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import logo from "../LOGO1.jpg";
import imagenModeloUno from "../MODELO 1.png";
import imagenModeloDos from "../MODELO 2.png";
import imagenModeloTres from "../MODELO 3.png";
import imagenModeloCuatro from "../MODELO 4.png";

const configuracionInicial = {
  color_primario: "#c9fa58",
  color_acento: "#a2d83b",
  color_fondo_oscuro: "#0d1317",
  whatsapp_numero: "573214066140",
  imagen_portada_url: "",
};

function enlaceWhatsApp(numero, mensaje = "Hola, me interesa conocer los servicios de DWRAPS.") {
  const numeroLimpio = String(numero || "").replace(/\D/g, "");
  if (numeroLimpio.length < 8 || numeroLimpio.length > 15) return "";
  return `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
}

const motosDeMuestra = [
  { id: "modelo-1", titulo: "Diseño personalizado", tipo_mime: "image/png", url: imagenModeloUno },
  { id: "modelo-3", titulo: "Estilo para rodar", tipo_mime: "image/png", url: imagenModeloTres },
  { id: "modelo-4", titulo: "Detalles que destacan", tipo_mime: "image/png", url: imagenModeloCuatro },
];

const serviciosDeMuestra = [
  { id: "forrado-completo", nombre: "Forrado completo", descripcion: "Un cambio total de color y personalidad para tu moto.", duracion_minutos: 240, precio_desde: null },
  { id: "detalles-personalizados", nombre: "Detalles personalizados", descripcion: "Acentos, gráficos y detalles que hacen la diferencia.", duracion_minutos: 90, precio_desde: null },
  { id: "proteccion-acabado", nombre: "Protección y acabado", descripcion: "Protege las zonas más expuestas con un acabado impecable.", duracion_minutos: 120, precio_desde: null },
];

const semana = [
  { indice: 1, nombre: "Lun" }, { indice: 2, nombre: "Mar" }, { indice: 3, nombre: "Mié" },
  { indice: 4, nombre: "Jue" }, { indice: 5, nombre: "Vie" }, { indice: 6, nombre: "Sáb" }, { indice: 0, nombre: "Dom" },
];

function fechaLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fechaDesdeLocal(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function sumarDias(date, cantidad) {
  const resultado = new Date(date);
  resultado.setDate(resultado.getDate() + cantidad);
  return resultado;
}

function textoFecha(fecha, opciones = { day: "numeric", month: "long", year: "numeric" }) {
  if (!fecha) return "Selecciona una fecha";
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es", opciones);
}

function duracionTexto(minutos = 0) {
  return minutos >= 60
    ? `${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ""}`
    : `${minutos} min`;
}

function precioTexto(precio) {
  return precio === null || precio === undefined
    ? "Precio por confirmar"
    : `Desde ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(precio))} (por confirmar)`;
}

function Calendario({ mes, fechaSeleccionada, alCambiarMes, alElegirFecha }) {
  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const espacios = (primerDia.getDay() + 6) % 7;
  const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const hoy = fechaLocal(new Date());
  const mesTitulo = mes.toLocaleDateString("es", { month: "long", year: "numeric" });
  const mesAnteriorBloqueado = mes.getFullYear() < new Date().getFullYear() ||
    (mes.getFullYear() === new Date().getFullYear() && mes.getMonth() <= new Date().getMonth());

  return (
    <>
      <div className="calendar-toolbar">
        <button className="icon-button" type="button" aria-label="Mes anterior" disabled={mesAnteriorBloqueado} onClick={() => alCambiarMes(-1)}>←</button>
        <strong>{mesTitulo.charAt(0).toLocaleUpperCase("es") + mesTitulo.slice(1)}</strong>
        <button className="icon-button" type="button" aria-label="Mes siguiente" onClick={() => alCambiarMes(1)}>→</button>
      </div>
      <div className="calendar-grid">
        {semana.map((dia) => <span className="calendar-weekday" key={dia.nombre}>{dia.nombre}</span>)}
        {Array.from({ length: espacios }, (_, indice) => <span key={`espacio-${indice}`} />)}
        {Array.from({ length: dias }, (_, indice) => {
          const numero = indice + 1;
          const fecha = fechaLocal(new Date(mes.getFullYear(), mes.getMonth(), numero));
          return (
            <button
              className={`calendar-day ${fecha === fechaSeleccionada ? "selected" : ""} ${fecha === hoy ? "today" : ""}`}
              type="button"
              key={fecha}
              disabled={fecha < hoy}
              aria-label={textoFecha(fecha, { weekday: "long", day: "numeric", month: "long" })}
              aria-pressed={fecha === fechaSeleccionada}
              onClick={() => alElegirFecha(fecha)}
            >
              {numero}
            </button>
          );
        })}
      </div>
    </>
  );
}

function TablaVacia({ texto }) {
  return <div className="empty-state">{texto}</div>;
}

function AgendaAdmin({ citas, fecha, modo, alCambiarFecha, alCambiarModo }) {
  const fechaActual = fechaDesdeLocal(fecha);
  const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  const inicioSemana = sumarDias(fechaActual, -((fechaActual.getDay() + 6) % 7));
  let diasVisibles;

  if (modo === "dia") {
    diasVisibles = [fechaActual];
  } else if (modo === "semana") {
    diasVisibles = Array.from({ length: 7 }, (_, indice) => sumarDias(inicioSemana, indice));
  } else {
    const desplazamiento = (primerDiaMes.getDay() + 6) % 7;
    const cantidadDias = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
    const cantidadCeldas = Math.ceil((desplazamiento + cantidadDias) / 7) * 7;
    const inicioCalendario = sumarDias(primerDiaMes, -desplazamiento);
    diasVisibles = Array.from({ length: cantidadCeldas }, (_, indice) => sumarDias(inicioCalendario, indice));
  }

  const citasPorFecha = new Map();
  citas.forEach((cita) => {
    const delDia = citasPorFecha.get(cita.fecha) || [];
    delDia.push(cita);
    citasPorFecha.set(cita.fecha, delDia);
  });
  citasPorFecha.forEach((delDia) => delDia.sort((a, b) => a.hora.localeCompare(b.hora)));

  const titulo = modo === "dia"
    ? textoFecha(fecha, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : modo === "semana"
      ? `${textoFecha(fechaLocal(inicioSemana), { day: "numeric", month: "short" })} – ${textoFecha(fechaLocal(sumarDias(inicioSemana, 6)), { day: "numeric", month: "short", year: "numeric" })}`
      : textoFecha(fecha, { month: "long", year: "numeric" });
  const tituloCapitalizado = titulo.charAt(0).toLocaleUpperCase("es") + titulo.slice(1);
  const cambiarPeriodo = (cantidad) => {
    if (modo === "dia") {
      alCambiarFecha(fechaLocal(sumarDias(fechaActual, cantidad)));
      return;
    }
    if (modo === "semana") {
      alCambiarFecha(fechaLocal(sumarDias(fechaActual, cantidad * 7)));
      return;
    }
    const siguienteMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + cantidad, 1);
    const ultimoDia = new Date(siguienteMes.getFullYear(), siguienteMes.getMonth() + 1, 0).getDate();
    alCambiarFecha(fechaLocal(new Date(siguienteMes.getFullYear(), siguienteMes.getMonth(), Math.min(fechaActual.getDate(), ultimoDia))));
  };

  return (
    <div className="admin-agenda">
      <div className="agenda-toolbar">
        <div className="agenda-navigation">
          <button className="icon-button" type="button" aria-label="Periodo anterior" onClick={() => cambiarPeriodo(-1)}>←</button>
          <button className="table-action agenda-today" type="button" onClick={() => alCambiarFecha(fechaLocal(new Date()))}>Hoy</button>
          <button className="icon-button" type="button" aria-label="Periodo siguiente" onClick={() => cambiarPeriodo(1)}>→</button>
          <h3>{tituloCapitalizado}</h3>
        </div>
        <div className="agenda-modes" aria-label="Vista del calendario">
          {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([valor, etiqueta]) => (
            <button
              className={`agenda-mode ${modo === valor ? "active" : ""}`}
              type="button"
              key={valor}
              aria-pressed={modo === valor}
              onClick={() => alCambiarModo(valor)}
            >{etiqueta}</button>
          ))}
        </div>
      </div>
      {modo === "mes" ? (
        <div className="admin-month-grid">
          {semana.map((dia) => <span className="admin-calendar-weekday" key={dia.nombre}>{dia.nombre}</span>)}
          {diasVisibles.map((dia) => {
            const clave = fechaLocal(dia);
            const citasDelDia = citasPorFecha.get(clave) || [];
            return (
              <button
                className={`admin-month-day ${dia.getMonth() !== fechaActual.getMonth() ? "outside" : ""} ${clave === fecha ? "selected" : ""}`}
                type="button"
                key={clave}
                onClick={() => { alCambiarFecha(clave); alCambiarModo("dia"); }}
              >
                <span className="admin-day-number">{dia.getDate()}</span>
                <span className="admin-day-events">
                  {citasDelDia.slice(0, 3).map((cita) => (
                    <span className={`admin-calendar-event ${cita.estado}`} key={cita.id}>
                      <strong>{cita.hora}</strong> {cita.nombre_cliente}
                    </span>
                  ))}
                  {citasDelDia.length > 3 ? <span className="admin-more-events">+{citasDelDia.length - 3} más</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={`admin-agenda-days ${modo === "dia" ? "single-day" : ""}`}>
          {diasVisibles.map((dia) => {
            const clave = fechaLocal(dia);
            const citasDelDia = citasPorFecha.get(clave) || [];
            return (
              <section className={`admin-agenda-day ${clave === fecha ? "current" : ""}`} key={clave}>
                <button className="admin-agenda-date" type="button" onClick={() => { alCambiarFecha(clave); alCambiarModo("dia"); }}>
                  <span>{dia.toLocaleDateString("es", { weekday: "short" })}</span>
                  <strong>{dia.getDate()}</strong>
                  <span>{dia.toLocaleDateString("es", { month: "short" })}</span>
                </button>
                <div className="admin-agenda-events">
                  {citasDelDia.map((cita) => (
                    <article className={`admin-agenda-event ${cita.estado}`} key={cita.id}>
                      <strong>{cita.hora} · {cita.nombre_cliente}</strong>
                      <span>{cita.nombre_servicio} · {cita.motocicleta}</span>
                      {cita.telefono_cliente ? <span>{cita.telefono_cliente}</span> : null}
                    </article>
                  ))}
                  {!citasDelDia.length ? <span className="admin-no-events">Sin citas</span> : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [vista, setVista] = useState("inicio");
  const [servicios, setServicios] = useState(serviciosDeMuestra);
  const [apiConectada, setApiConectada] = useState(false);
  const [mensajeApi, setMensajeApi] = useState("Conectando con el servidor…");
  const [usuario, setUsuario] = useState(null);
  const [telefonoPendiente, setTelefonoPendiente] = useState("");
  const [servicioId, setServicioId] = useState(serviciosDeMuestra[0].id);
  const [mes, setMes] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [horarios, setHorarios] = useState([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [errorHorarios, setErrorHorarios] = useState("");
  const [tipoAcceso, setTipoAcceso] = useState("ingreso");
  const [aviso, setAviso] = useState("");
  const [pestanaAdmin, setPestanaAdmin] = useState("resumen");
  const [resumenAdmin, setResumenAdmin] = useState(null);
  const [citasAdmin, setCitasAdmin] = useState([]);
  const [fechaAgendaAdmin, setFechaAgendaAdmin] = useState(() => fechaLocal(new Date()));
  const [vistaAgendaAdmin, setVistaAgendaAdmin] = useState("mes");
  const [valoracionesAdmin, setValoracionesAdmin] = useState([]);
  const [galeria, setGaleria] = useState([]);
  const [galeriaAdmin, setGaleriaAdmin] = useState([]);
  const [configuracion, setConfiguracion] = useState(configuracionInicial);
  const [serviciosAdmin, setServiciosAdmin] = useState([]);
  const [servicioEditando, setServicioEditando] = useState(null);
  const [guardandoServicio, setGuardandoServicio] = useState(false);
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [permisosPublicacion, setPermisosPublicacion] = useState({});
  const [subiendoMedia, setSubiendoMedia] = useState(false);
  const [cargandoAdmin, setCargandoAdmin] = useState(false);
  const [servicioCotizacion, setServicioCotizacion] = useState("");
  const [motoCotizacion, setMotoCotizacion] = useState("");
  const [ideaCotizacion, setIdeaCotizacion] = useState("");

  const servicioActual = useMemo(
    () => servicios.find((servicio) => servicio.id === servicioId),
    [servicios, servicioId],
  );

  useEffect(() => {
    let vigente = true;
    let subscription;
    async function iniciar() {
      try {
        const estado = await api.estado();
        if (!vigente) return;
        setApiConectada(true);
        setUsuario(estado.usuario || null);
        subscription = api.observarSesion((perfil, error) => {
          if (!vigente) return;
          if (error) mostrarAviso(error.message);
          setUsuario(perfil);
        }).data.subscription;
        const resultados = await Promise.allSettled([
          api.servicios(),
          api.galeriaPublica(),
          api.configuracionSitio(),
        ]);
        if (!vigente) return;
        const errores = [];
        const [catalogo, trabajos, ajustes] = resultados;
        if (catalogo.status === "fulfilled" && catalogo.value.length) {
          setServicios(catalogo.value);
          if (!catalogo.value.some((servicio) => servicio.id === servicioId)) setServicioId(catalogo.value[0].id);
        } else if (catalogo.status === "rejected") {
          errores.push(`servicios: ${catalogo.reason.message}`);
        }
        if (trabajos.status === "fulfilled") setGaleria(trabajos.value);
        else errores.push(`galería: ${trabajos.reason.message}`);
        if (ajustes.status === "fulfilled") setConfiguracion(ajustes.value);
        else errores.push(`diseño: ${ajustes.reason.message}`);
        setMensajeApi(errores.length
          ? `Supabase está conectado, pero faltan tablas o columnas (${errores.join("; ")}). Actualiza el esquema con base_datos.sql.`
          : "");
      } catch (error) {
        if (!vigente) return;
        setApiConectada(false);
        setMensajeApi(`Supabase aún no está listo: ${error.message}. Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Vercel (o en .env.local para desarrollo) y confirma que base_datos.sql esté aplicado en Supabase.`);
      }
    }
    iniciar();
    return () => {
      vigente = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!apiConectada || !servicioId || !fecha) {
      setHorarios([]);
      return undefined;
    }
    let vigente = true;
    setCargandoHorarios(true);
    setErrorHorarios("");
    api.disponibilidad(servicioId, fecha)
      .then((resultado) => {
        if (!vigente) return;
        setHorarios(resultado.horarios || []);
        setHora((actual) => (resultado.horarios || []).includes(actual) ? actual : "");
      })
      .catch((error) => {
        if (vigente) {
          setHorarios([]);
          setHora("");
          setErrorHorarios(error.message);
        }
      })
      .finally(() => { if (vigente) setCargandoHorarios(false); });
    return () => { vigente = false; };
  }, [apiConectada, servicioId, fecha]);

  useEffect(() => {
    if (vista !== "administracion" || usuario?.rol !== "administrador") return;
    let vigente = true;
    setCargandoAdmin(true);
    Promise.allSettled([
      api.resumenAdmin(),
      api.citasAdmin(),
      api.valoracionesAdmin(),
      api.galeriaAdmin(),
      api.serviciosAdmin(),
      api.configuracionSitio(),
    ])
      .then((resultados) => {
        if (!vigente) return;
        const errores = [];
        const asignar = (indice, etiqueta, setter) => {
          const resultado = resultados[indice];
          if (resultado.status === "fulfilled") setter(resultado.value);
          else errores.push(`${etiqueta}: ${resultado.reason.message}`);
        };
        asignar(0, "resumen", setResumenAdmin);
        asignar(1, "citas", setCitasAdmin);
        asignar(2, "valoraciones", setValoracionesAdmin);
        asignar(3, "galería", setGaleriaAdmin);
        asignar(4, "servicios", setServiciosAdmin);
        asignar(5, "diseño", setConfiguracion);
        if (errores.length) mostrarAviso(`Algunas secciones necesitan actualizar Supabase: ${errores.join("; ")}`);
      })
      .finally(() => { if (vigente) setCargandoAdmin(false); });
    return () => { vigente = false; };
  }, [vista, usuario]);

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty("--lime", configuracion.color_primario);
    raiz.style.setProperty("--accent", configuracion.color_acento);
    raiz.style.setProperty("--night", configuracion.color_fondo_oscuro);
    raiz.style.setProperty("--hero-bg", configuracion.color_fondo_oscuro);
  }, [configuracion.color_primario, configuracion.color_acento, configuracion.color_fondo_oscuro]);

  useEffect(() => {
    if (vista !== "galeria" || !apiConectada) return;
    let vigente = true;
    api.galeriaPublica()
      .then((trabajos) => { if (vigente) setGaleria(trabajos); })
      .catch((error) => { if (vigente) mostrarAviso(error.message); });
    return () => { vigente = false; };
  }, [vista, apiConectada]);

  function mostrarAviso(mensaje) {
    setAviso(mensaje);
    window.setTimeout(() => setAviso(""), 4000);
  }

  function irAVista(nombre) {
    setVista(nombre);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cambiarMes(cantidad) {
    setMes((actual) => new Date(actual.getFullYear(), actual.getMonth() + cantidad, 1));
    setFecha("");
    setHora("");
  }

  function cambiarServicio(id) {
    setServicioId(id);
    setFecha("");
    setHora("");
  }

  function navegarSeccion(id) {
    if (vista !== "inicio") setVista("inicio");
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  async function enviarAcceso(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const datos = {
      telefono: String(form.get("telefono") || "").trim(),
      clave: String(form.get("clave") || ""),
      nombre: String(form.get("nombre") || "").trim(),
    };
    try {
      if (tipoAcceso === "registro") {
        const cuenta = await api.registrarCliente(datos);
        if (cuenta.requiereVerificacion) {
          setTelefonoPendiente(cuenta.telefono);
          mostrarAviso("Revisa tus mensajes: te enviamos un código para verificar tu celular.");
          return;
        }
        setUsuario(cuenta.usuario);
      } else {
        const cuenta = await api.ingresarCliente(datos);
        setUsuario(cuenta.usuario);
      }
      irAVista("reservar");
      mostrarAviso("Ya puedes continuar con tu cita.");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function enviarReserva(event) {
    event.preventDefault();
    if (!apiConectada) {
      mostrarAviso("Conecta Supabase para registrar una cita.");
      return;
    }
    if (!fecha || !hora || !servicioActual) {
      mostrarAviso("Elige el servicio, la fecha y la hora disponibles.");
      return;
    }
    const formulario = event.currentTarget;
    const datos = new FormData(formulario);
    const nombre = String(datos.get("nombre") || "").trim();
    const telefono = String(datos.get("telefono") || "").trim();
    const motocicleta = String(datos.get("motocicleta") || "").trim();
    const notas = String(datos.get("notas") || "").trim();
    const mensajeWhatsApp = [
      "Hola, quiero solicitar una cita en DWRAPS.",
      `Nombre: ${nombre}`,
      `Celular: ${telefono}`,
      `Moto: ${motocicleta}`,
      `Servicio: ${servicioActual.nombre}`,
      `Día: ${textoFecha(fecha, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
      `Hora: ${hora}`,
      `Trabajo que necesito: ${notas}`,
    ].join("\n");
    const enlace = enlaceWhatsApp(configuracion.whatsapp_numero, mensajeWhatsApp);
    if (enlace) window.open(enlace, "_blank", "noopener,noreferrer");
    try {
      await api.solicitarCita({
        nombre,
        telefono,
        servicio_id: servicioId,
        fecha,
        hora,
        motocicleta,
        notas,
      });
      formulario.reset();
      setHora("");
      setFecha("");
      mostrarAviso(enlace
        ? "La cita quedó guardada y enviamos el mensaje preparado por WhatsApp."
        : "La cita quedó guardada. El taller se comunicará contigo.");
      irAVista("inicio");
    } catch (error) {
      mostrarAviso(error.message);
      if (error.message.toLowerCase().includes("horario")) {
        setHora("");
        setFecha("");
      }
    }
  }

  async function enviarValoracion(event) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const datos = new FormData(formulario);
    const servicioSeleccionado = servicios.find((servicio) => servicio.id === String(datos.get("servicio_id") || ""));
    const mensajeWhatsApp = [
      "Hola, quiero cotizar un trabajo con DWRAPS.",
      `Nombre: ${String(datos.get("nombre") || "").trim()}`,
      `Celular: ${String(datos.get("telefono") || "").trim()}`,
      `Moto: ${String(datos.get("motocicleta") || "").trim()}`,
      `Servicio: ${servicioSeleccionado?.nombre || "Necesito orientación"}`,
      `Idea: ${String(datos.get("detalle") || "").trim()}`,
    ].join("\n");
    window.open(enlaceWhatsApp(configuracion.whatsapp_numero, mensajeWhatsApp), "_blank", "noopener,noreferrer");
    try {
      await api.crearValoracion({
        nombre: String(datos.get("nombre") || "").trim(),
        telefono: String(datos.get("telefono") || "").trim(),
        motocicleta: String(datos.get("motocicleta") || "").trim(),
        servicio_id: String(datos.get("servicio_id") || ""),
        detalle: String(datos.get("detalle") || "").trim(),
      });
      formulario.reset();
      setMotoCotizacion("");
      setIdeaCotizacion("");
      mostrarAviso("Cotización enviada por WhatsApp y guardada para que el taller le dé seguimiento.");
      irAVista("inicio");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function ingresarAdmin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const resultado = await api.ingresarAdmin({
        correo: String(form.get("correo") || "").trim(),
        clave: String(form.get("clave") || ""),
      });
      setUsuario(resultado.usuario);
      irAVista("administracion");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function verificarCelular(event) {
    event.preventDefault();
    const codigo = String(new FormData(event.currentTarget).get("codigo") || "").trim();
    try {
      const resultado = await api.verificarTelefono({ telefono: telefonoPendiente, codigo });
      setUsuario(resultado.usuario);
      setTelefonoPendiente("");
      irAVista("reservar");
      mostrarAviso("Celular verificado. Ya puedes reservar.");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function cerrarSesion() {
    try {
      await api.salir();
      setUsuario(null);
      irAVista("inicio");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function actualizarEstadoCita(id, estado) {
    try {
      await api.cambiarEstadoCita(id, estado);
      setCitasAdmin(await api.citasAdmin());
      setResumenAdmin(await api.resumenAdmin());
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function reprogramarCita(id, nuevaFecha, nuevaHora) {
    try {
      await api.reprogramarCitaAdmin(id, nuevaFecha, nuevaHora);
      setCitasAdmin(await api.citasAdmin());
      setResumenAdmin(await api.resumenAdmin());
      mostrarAviso("Fecha y hora de la cita actualizadas.");
      return true;
    } catch (error) {
      mostrarAviso(error.message);
      return false;
    }
  }

  async function actualizarEstadoValoracion(id, estado) {
    try {
      await api.cambiarEstadoValoracion(id, estado);
      setValoracionesAdmin(await api.valoracionesAdmin());
      setResumenAdmin(await api.resumenAdmin());
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function subirTrabajo(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const datos = new FormData(form);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || !archivo.size) {
      mostrarAviso("Selecciona una foto o video antes de subir.");
      return;
    }
    setSubiendoMedia(true);
    try {
      await api.subirMedia({
        archivo,
        titulo: String(datos.get("titulo") || ""),
        descripcion: String(datos.get("descripcion") || ""),
      });
      form.reset();
      setGaleriaAdmin(await api.galeriaAdmin());
      mostrarAviso("Subimos el archivo como borrador privado. Confirma la autorización para publicarlo.");
    } catch (error) {
      mostrarAviso(error.message);
    } finally {
      setSubiendoMedia(false);
    }
  }

  async function cambiarPublicacionMedia(item, publicar) {
    if (publicar && !permisosPublicacion[item.id]) {
      mostrarAviso("Marca la casilla de autorización para publicar este trabajo.");
      return;
    }
    try {
      await api.cambiarEstadoMedia(item, publicar);
      setPermisosPublicacion((actual) => ({ ...actual, [item.id]: false }));
      const [admin, publico] = await Promise.all([api.galeriaAdmin(), api.galeriaPublica()]);
      setGaleriaAdmin(admin);
      setGaleria(publico);
      mostrarAviso(publicar ? "Trabajo publicado en la galería." : "Trabajo retirado de la galería pública.");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function eliminarTrabajo(item) {
    if (!window.confirm(`¿Eliminar "${item.titulo}" y su archivo? Esta acción no se puede deshacer.`)) return;
    try {
      await api.eliminarMedia(item);
      setGaleriaAdmin(await api.galeriaAdmin());
      setGaleria(await api.galeriaPublica());
      mostrarAviso("Trabajo eliminado.");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function guardarServicio(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const datos = new FormData(form);
    const precio = String(datos.get("precio_desde") || "").trim();
    setGuardandoServicio(true);
    try {
      await api.guardarServicio({
        ...(servicioEditando?.id ? { id: servicioEditando.id } : {}),
        nombre: String(datos.get("nombre") || "").trim(),
        descripcion: String(datos.get("descripcion") || "").trim(),
        duracion_minutos: Number(datos.get("duracion_minutos")),
        precio_desde: precio ? Number(precio) : null,
        activo: servicioEditando?.activo ?? true,
      });
      setServiciosAdmin(await api.serviciosAdmin());
      const catalogo = await api.servicios();
      setServicios(catalogo);
      if (!servicioId && catalogo.length) setServicioId(catalogo[0].id);
      setServicioEditando(null);
      form.reset();
      mostrarAviso("Servicio guardado correctamente.");
      if (vista === "administracion") setResumenAdmin(await api.resumenAdmin());
    } catch (error) {
      mostrarAviso(error.message);
    } finally {
      setGuardandoServicio(false);
    }
  }

  async function cambiarEstadoServicio(servicio) {
    try {
      await api.guardarServicio({ ...servicio, activo: !servicio.activo });
      const [administracion, catalogo] = await Promise.all([api.serviciosAdmin(), api.servicios()]);
      setServiciosAdmin(administracion);
      setServicios(catalogo);
      if (!catalogo.some((item) => item.id === servicioId)) {
        setServicioId(catalogo[0]?.id || "");
        setFecha("");
        setHora("");
      }
      setResumenAdmin(await api.resumenAdmin());
      mostrarAviso(servicio.activo ? "Servicio ocultado del catálogo." : "Servicio activado en el catálogo.");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function guardarDiseno(event) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const whatsappNumero = String(datos.get("whatsapp_numero") || configuracion.whatsapp_numero).replace(/\D/g, "");
    if (whatsappNumero && (whatsappNumero.length < 8 || whatsappNumero.length > 15)) {
      mostrarAviso("Ingresa el WhatsApp con código de país y entre 8 y 15 dígitos.");
      return;
    }
    const nuevoDiseno = {
      ...configuracion,
      color_primario: String(datos.get("color_primario")),
      color_acento: String(datos.get("color_acento")),
      color_fondo_oscuro: String(datos.get("color_fondo_oscuro")),
      whatsapp_numero: whatsappNumero,
    };
    try {
      await api.guardarConfiguracionSitio(nuevoDiseno);
      setConfiguracion(nuevoDiseno);
      mostrarAviso("Diseño y contacto de WhatsApp guardados.");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function cambiarImagenPortada(event) {
    const input = event.currentTarget;
    const archivo = input.files?.[0];
    if (!archivo) return;
    setSubiendoPortada(true);
    try {
      const nuevoDiseno = await api.subirImagenPortada(archivo, configuracion);
      setConfiguracion(nuevoDiseno);
      mostrarAviso("Imagen principal actualizada.");
    } catch (error) {
      mostrarAviso(error.message);
    } finally {
      setSubiendoPortada(false);
      input.value = "";
    }
  }

  const contenidoCalendario = () => (
    <section className="form-card calendar-card">
      <p className="eyebrow"><span className="status-dot" /> AGENDA TU CITA</p>
      <h2>Selecciona fecha y hora</h2>
      <p>Las horas ocupadas no aparecerán disponibles.</p>
      <label className="calendar-service-select">
        Servicio
        <select value={servicioId} onChange={(event) => cambiarServicio(event.target.value)} aria-label="Servicio para consultar horarios">
          {servicios.filter((servicio) => servicio.activo !== false).map((servicio) =>
            <option key={servicio.id} value={servicio.id}>{servicio.nombre} · {duracionTexto(servicio.duracion_minutos)}</option>)}
        </select>
      </label>
      <div className="availability-layout">
        <div className="availability-month">
          <Calendario mes={mes} fechaSeleccionada={fecha} alCambiarMes={cambiarMes} alElegirFecha={(nuevaFecha) => { setFecha(nuevaFecha); setHora(""); }} />
        </div>
        <div className="availability-time-list">
          <strong>{fecha ? textoFecha(fecha, { day: "numeric", month: "short" }) : "Horarios disponibles"}</strong>
          {cargandoHorarios ? <span className="empty-slots">Buscando horarios…</span> : null}
          {!cargandoHorarios && errorHorarios ? <span className="empty-slots">{errorHorarios}</span> : null}
          {!cargandoHorarios && !errorHorarios && (
            <div className="time-slots">
              {horarios.map((disponible) =>
                <button className={`time-slot ${hora === disponible ? "selected" : ""}`} type="button" key={disponible} onClick={() => setHora(disponible)}>{disponible}</button>)}
              {fecha && horarios.length === 0 ? <span className="empty-slots">{apiConectada ? "No hay horarios libres ese día." : "Conecta el servidor para consultar horarios."}</span> : null}
              {!fecha ? <span className="empty-slots">Elige una fecha para consultar horarios.</span> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); irAVista("inicio"); }}>
          <img className="brand-logo" src={logo} alt="DWRAPS" />
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <button className={`nav-link ${vista === "inicio" ? "active" : ""}`} onClick={() => irAVista("inicio")}>Inicio</button>
          <button className="nav-link" onClick={() => navegarSeccion("servicios")}>Servicios</button>
          <button className={`nav-link ${vista === "galeria" ? "active" : ""}`} onClick={() => irAVista("galeria")}>Galería</button>
          <button className={`nav-link ${vista === "cotizar" ? "active" : ""}`} onClick={() => irAVista("cotizar")}>Cotiza</button>
          <button className={`nav-link ${vista === "reservar" ? "active" : ""}`} onClick={() => irAVista("reservar")}>Agenda</button>
          {usuario?.rol === "administrador" ? <button className={`nav-link ${vista === "administracion" ? "active" : ""}`} onClick={() => irAVista("administracion")}>Administración</button> : null}
        </nav>
        <div className="top-actions">
          {usuario ? <span className="user-greeting">Hola, {usuario.nombre?.split(" ")[0] || "bienvenido"}</span> : null}
          {usuario ? <button className="button button-quiet" onClick={cerrarSesion}>Salir</button> : <button className="account-icon" aria-label="Ingresar" onClick={() => { setTipoAcceso("ingreso"); irAVista("cuenta"); }}>♙</button>}
          <button className="button button-primary button-small" onClick={() => irAVista("reservar")}>▣ &nbsp; Reservar <span aria-hidden="true">→</span></button>
          <button className="mobile-menu" aria-label="Menú" onClick={(event) => event.currentTarget.parentElement.previousElementSibling.classList.toggle("open")}>☰</button>
        </div>
      </header>

      {mensajeApi ? <div className="connection-banner" role="status">{mensajeApi}</div> : null}

      {vista === "inicio" ? (
        <main>
          <section className="hero" id="inicio">
            <div className="hero-content">
              <p className="eyebrow"><span className="status-dot" /> PERSONALIZACIÓN Y ESTILO</p>
              <h1>Tu moto.<br /><span>Tu estilo.</span><br />Sin límites.</h1>
              <p className="hero-copy">Dale una nueva vida a tu moto con diseños únicos, piezas de calidad y un acabado profesional.</p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={() => irAVista("reservar")}>▣ &nbsp; Agendar cita <span aria-hidden="true">→</span></button>
                <button className="button button-quiet hero-secondary" onClick={() => irAVista("cotizar")}>◇ &nbsp; Solicitar cotización <span aria-hidden="true">→</span></button>
              </div>
              <div className="hero-proof"><span className="proof-line" /> TU MOTO, A TU MANERA</div>
            </div>
            <div className="hero-art">
              <img className="hero-photo" src={configuracion.imagen_portada_url || imagenModeloDos} alt="Motocicleta Suzuki personalizada con wrap de DWRAPS" />
              <div className="art-grid" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
              <img className="hero-watermark" src={logo} alt="" aria-hidden="true" />
              <div className="art-label"><span /><span>HECHA PARA DESTACAR</span></div>
              <div className="art-caption"><span>PERSONALIZACIÓN A OTRO NIVEL</span><span className="caption-line" /></div>
            </div>
          </section>

          <section className="benefits-strip">
            <article><span className="benefit-icon">♧</span><div><strong>Alta calidad</strong><p>Materiales resistentes y duraderos.</p></div></article>
            <article><span className="benefit-icon">✳</span><div><strong>Diseños personalizados</strong><p>Tu idea, nuestro trabajo.</p></div></article>
            <article><span className="benefit-icon">◷</span><div><strong>Entrega a tiempo</strong><p>Comprometidos con tu pasión.</p></div></article>
            <article><span className="benefit-icon">☆</span><div><strong>Experiencia</strong><p>Motos que hablan por ti.</p></div></article>
          </section>

          <section className="quick-start section-wrap">
            <form className="quick-quote" onSubmit={(event) => { event.preventDefault(); irAVista("cotizar"); }}>
              <p className="eyebrow eyebrow-dark">◇ &nbsp; COTIZA TU PROYECTO</p>
              <h2>Cuéntanos qué necesitas</h2>
              <p>Cuéntanos tu idea y te ayudamos a encontrar la mejor opción.</p>
              <label className="quick-field"><input value={motoCotizacion} onChange={(event) => setMotoCotizacion(event.target.value)} placeholder="Tipo de moto (marca, modelo y año)" required /></label>
              <div className="quick-field-row">
                <label className="quick-field"><select value={servicioCotizacion} onChange={(event) => setServicioCotizacion(event.target.value)} required><option value="">Servicio deseado</option>{servicios.map((servicio) => <option value={servicio.id} key={servicio.id}>{servicio.nombre}</option>)}</select></label>
                <label className="quick-field"><select defaultValue=""><option value="" disabled>Tipo de personalización</option><option>Color completo</option><option>Gráficos y detalles</option><option>Protección de pintura</option><option>No estoy seguro</option></select></label>
              </div>
              <label className="quick-field"><textarea value={ideaCotizacion} onChange={(event) => setIdeaCotizacion(event.target.value)} rows="3" placeholder="Cuéntanos más sobre tu proyecto..." required /></label>
              <button className="button button-primary button-full" type="submit">◇ &nbsp; Solicitar cotización <span aria-hidden="true">→</span></button>
              <span className="quick-footnote">ⓘ &nbsp; Nos pondremos en contacto contigo para conocer los detalles.</span>
            </form>
            <aside className="quick-booking">
              <p className="eyebrow"><span className="status-dot" /> AGENDA TU CITA</p>
              <h2>¿Ya sabes cuándo venir?</h2>
              <p>Consulta los horarios disponibles y reserva tu espacio. La cotización no reserva ni bloquea una hora.</p>
              <button className="button button-primary" type="button" onClick={() => irAVista("reservar")}>Ver horarios disponibles <span aria-hidden="true">→</span></button>
            </aside>
          </section>

          <section className="intro-section section-wrap">
            <div><p className="eyebrow eyebrow-dark">DISEÑADA PARA TI</p><h2>No es solo un cambio.<br />Es <span>hacerla tuya.</span></h2></div>
            <p className="intro-copy">Desde un detalle que marca la diferencia hasta un forrado completo. Cuéntanos qué tienes en mente y lo hacemos realidad, cuidando cada curva de tu moto.</p>
          </section>

          <section className="services-section section-wrap" id="servicios">
            <div className="section-heading"><div><p className="eyebrow eyebrow-dark">LO QUE HACEMOS</p><h2>Tu próxima <span>transformación.</span></h2></div><button className="text-button" onClick={() => irAVista("reservar")}>Ver disponibilidad →</button></div>
            <div className="service-cards">
              {servicios.map((servicio, indice) => (
                <article className="service-card" key={servicio.id}>
                  <div className="service-icon" aria-hidden="true">{["↗", "✳", "◇"][indice % 3]}</div>
                  <h3>{servicio.nombre}</h3><p>{servicio.descripcion}</p>
                  <div className="service-meta"><span>{duracionTexto(servicio.duracion_minutos)}</span><strong>{precioTexto(servicio.precio_desde)}</strong></div>
                </article>
              ))}
            </div>
          </section>

          <section className="gallery-section section-wrap" id="galeria">
            <div className="section-heading"><div><p className="eyebrow eyebrow-dark">TRABAJOS REALES</p><h2>Hechos para <span>rodar.</span></h2></div><button className="text-button" onClick={() => irAVista("galeria")}>Ver galería →</button></div>
            <Galeria trabajos={[...galeria.slice(0, 3), ...motosDeMuestra]} />
          </section>
        </main>
      ) : null}

      {vista === "galeria" ? (
        <main className="section-wrap inner-view">
          <div className="page-heading"><p className="eyebrow eyebrow-dark">DWRAPS · BOGOTÁ</p><h1>Trabajos <span>realizados.</span></h1><p>Una muestra de proyectos publicados por el taller.</p></div>
          <Galeria trabajos={galeria} />
        </main>
      ) : null}

      {vista === "reservar" ? (
        <main className="section-wrap inner-view">
          <div className="page-heading"><p className="eyebrow eyebrow-dark">RESERVA EN LÍNEA</p><h1>Agenda tu <span>cita.</span></h1><p>Elige un servicio y un horario disponible. El taller confirmará tu cita por celular.</p></div>
          <div className="booking-layout">
            <div className="booking-main">
              <section className="form-card">
                <div className="step-heading"><span className="step-number">01</span><div><h2>Elige tu servicio</h2><p>Selecciona el tipo de trabajo que quieres realizar.</p></div></div>
                <div className="service-options">{servicios.map((servicio) => <button type="button" key={servicio.id} className={`service-option ${servicio.id === servicioId ? "selected" : ""}`} onClick={() => cambiarServicio(servicio.id)}><strong>{servicio.nombre}</strong><span>{servicio.descripcion}</span><span className="option-meta">{duracionTexto(servicio.duracion_minutos)} · {precioTexto(servicio.precio_desde)}</span></button>)}</div>
              </section>
              {contenidoCalendario()}
              <form className="form-card booking-form" onSubmit={enviarReserva}>
                <div className="step-heading"><span className="step-number">03</span><div><h2>Envía tu solicitud</h2><p>Déjanos tus datos y cuéntanos qué necesitas. No hace falta crear una cuenta.</p></div></div>
                <div className="form-grid">
                  <label>Nombre completo<input name="nombre" autoComplete="name" required minLength="2" maxLength="120" placeholder="¿Cómo te llamas?" /></label>
                  <label>Celular<input name="telefono" type="tel" inputMode="tel" autoComplete="tel" required minLength="8" maxLength="20" placeholder="Tu número de contacto" /></label>
                  <label className="field-wide">Marca, modelo y año de tu moto<input name="motocicleta" placeholder="Ej. Yamaha MT-07, 2023" required minLength="2" maxLength="160" /></label>
                  <label className="field-wide">¿Qué trabajo quieres realizar?<textarea name="notas" rows="3" placeholder="Cuéntanos qué quieres hacerle a tu moto" required minLength="5" maxLength="2000" /></label>
                  <div className="field-wide form-foot"><p>Tu solicitud y horario quedan guardados. El taller confirmará la cita contigo.</p><button className="button button-primary" type="submit" disabled={!apiConectada || !fecha || !hora}>Enviar solicitud por WhatsApp →</button></div>
                </div>
              </form>
            </div>
            <aside className="booking-summary"><p className="eyebrow">RESUMEN</p><h2>Tu cita</h2><div className="summary-divider" />
              <div className="summary-row"><span>Servicio</span><strong>{servicioActual?.nombre || "Elige un servicio"}</strong></div>
              <div className="summary-row"><span>Duración estimada</span><strong>{servicioActual ? duracionTexto(servicioActual.duracion_minutos) : "—"}</strong></div>
              <div className="summary-row"><span>Fecha</span><strong>{fecha ? textoFecha(fecha) : "Selecciona un día"}</strong></div>
              <div className="summary-row"><span>Hora</span><strong>{hora || "—"}</strong></div>
              <div className="summary-note"><span>ⓘ</span><p>Tu solicitud quedará guardada y enviaremos estos datos al taller por WhatsApp. El horario se reservará para evitar cruces.</p></div>
            </aside>
          </div>
        </main>
      ) : null}

      {vista === "cotizar" ? (
        <main className="section-wrap inner-view">
          <div className="page-heading"><p className="eyebrow eyebrow-dark">CUÉNTANOS TU IDEA</p><h1>Solicita una <span>cotización.</span></h1><p>Comparte los datos de contacto y los detalles de tu moto y del trabajo que tienes en mente. Te contactaremos para asesorarte; esta solicitud no reserva una hora.</p></div>
          <form className="quote-form form-card" onSubmit={enviarValoracion}>
            <div className="form-grid">
              <label>Nombre completo<input name="nombre" autoComplete="name" placeholder="¿Cómo te llamas?" required minLength="2" /></label>
              <label>Celular<input name="telefono" inputMode="tel" autoComplete="tel" placeholder="+código de país y número" required /></label>
              <label>Marca, modelo y año<input name="motocicleta" defaultValue={motoCotizacion} placeholder="Ej. Yamaha MT-07, 2023" required /></label>
              <label>¿Qué trabajo te interesa?<select name="servicio_id" defaultValue={servicioCotizacion}><option value="">Otro / necesito orientación</option>{servicios.map((servicio) => <option value={servicio.id} key={servicio.id}>{servicio.nombre}</option>)}</select></label>
              <label className="field-wide">Descríbenos tu idea<textarea name="detalle" defaultValue={ideaCotizacion} rows="5" placeholder="¿Qué te gustaría cambiar? Comparte colores, referencias o cualquier detalle." required minLength="5" /></label>
              <div className="field-wide form-foot"><p>Usaremos tu número solo para responder esta solicitud.</p><button className="button button-primary" type="submit" disabled={!apiConectada}>Enviar solicitud →</button></div>
            </div>
          </form>
        </main>
      ) : null}

      {vista === "cuenta" ? (
        <main className="section-wrap inner-view auth-view">
          <section className="auth-card form-card">
            <p className="eyebrow eyebrow-dark">TU ESPACIO</p><h1>{tipoAcceso === "registro" ? <>Crea tu <span>cuenta.</span></> : <>Ingresa a tu <span>cuenta.</span></>}</h1>
            <p>Usa tu celular y una clave para reservar y gestionar tus citas.</p>
            <form className="auth-form" onSubmit={telefonoPendiente ? verificarCelular : enviarAcceso}>
              {telefonoPendiente ? (
                <>
                  <p className="signed-in-note">Enviamos un código SMS al {telefonoPendiente}. Ingrésalo para verificar tu número.</p>
                  <label>Código de verificación<input name="codigo" inputMode="numeric" autoComplete="one-time-code" required minLength="4" /></label>
                  <button className="button button-primary button-full" type="submit">Verificar celular →</button>
                </>
              ) : (
                <>
                  {tipoAcceso === "registro" ? <label>Nombre completo<input name="nombre" autoComplete="name" required minLength="2" /></label> : null}
                  <label>Celular<input name="telefono" inputMode="tel" autoComplete="tel" placeholder="+código de país y número" required /></label>
                  <label>Clave<input name="clave" type="password" minLength="8" autoComplete={tipoAcceso === "registro" ? "new-password" : "current-password"} required /></label>
                  <button className="button button-primary button-full" type="submit">{tipoAcceso === "registro" ? "Crear cuenta" : "Ingresar"}</button>
                </>
              )}
            </form>
            {!telefonoPendiente ? <p className="auth-switch">{tipoAcceso === "registro" ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"} <button className="inline-button" onClick={() => setTipoAcceso(tipoAcceso === "registro" ? "ingreso" : "registro")}>{tipoAcceso === "registro" ? "Ingresar" : "Crear cuenta"}</button></p> : null}
          </section>
        </main>
      ) : null}

      {vista === "ingreso-admin" ? (
        <main className="section-wrap inner-view auth-view">
          <section className="auth-card form-card">
            <p className="eyebrow eyebrow-dark">ÁREA PRIVADA</p><h1>Administración <span>del taller.</span></h1><p>Ingresa con las credenciales creadas para la persona administradora.</p>
            <form className="auth-form" onSubmit={ingresarAdmin}><label>Correo electrónico<input name="correo" type="email" autoComplete="username" required /></label><label>Clave<input name="clave" type="password" autoComplete="current-password" required /></label><button className="button button-primary button-full" type="submit">Ingresar al panel →</button></form>
          </section>
        </main>
      ) : null}

      {vista === "administracion" ? (
        <main className="admin-view">
          <div className="admin-top"><div><p className="eyebrow">PANEL DE ADMINISTRACIÓN</p><h1>Hola, <span>{usuario?.nombre || "administrador"}.</span></h1><p>Revisa las citas y solicitudes de tu taller.</p></div><button className="button button-quiet admin-logout" onClick={cerrarSesion}>Cerrar sesión</button></div>
          <div className="admin-content">
            <div className="admin-tabs">
              {["resumen", "citas", "valoraciones", "galeria", "servicios", "diseno"].map((tab) => <button key={tab} className={`admin-tab ${pestanaAdmin === tab ? "active" : ""}`} onClick={() => setPestanaAdmin(tab)}>{tab === "resumen" ? "Resumen" : tab === "citas" ? <>Citas <span className="tab-count">{citasAdmin.length}</span></> : tab === "valoraciones" ? <>Cotizaciones <span className="tab-count">{valoracionesAdmin.length}</span></> : tab === "galeria" ? <>Galería <span className="tab-count">{galeriaAdmin.length}</span></> : tab === "servicios" ? "Servicios y precios" : "Diseño de página"}</button>)}
            </div>
            {cargandoAdmin ? <TablaVacia texto="Cargando datos del taller…" /> : null}
            {!cargandoAdmin && pestanaAdmin === "resumen" ? <>
              <div className="stats-grid">
                <article className="stat-card"><span>Citas pendientes</span><strong>{resumenAdmin?.citas_pendientes ?? 0}</strong><small>Por confirmar</small></article>
                <article className="stat-card"><span>Próximas citas</span><strong>{resumenAdmin?.citas_proximas ?? 0}</strong><small>En tu agenda</small></article>
                <article className="stat-card"><span>Cotizaciones nuevas</span><strong>{resumenAdmin?.valoraciones_nuevas ?? 0}</strong><small>Por revisar</small></article>
                <article className="stat-card"><span>Servicios activos</span><strong>{resumenAdmin?.servicios_activos ?? 0}</strong><small>En tu catálogo</small></article>
              </div>
              <div className="admin-card"><div className="admin-card-head"><div><p className="eyebrow eyebrow-dark">AGENDA</p><h2>Próximas citas</h2></div><button className="inline-button" onClick={() => setPestanaAdmin("citas")}>Ver todas →</button></div><TablaCitas citas={citasAdmin.filter((cita) => ["pendiente", "confirmada"].includes(cita.estado)).slice(0, 5)} alCambiar={actualizarEstadoCita} alReprogramar={reprogramarCita} /></div>
            </> : null}
            {!cargandoAdmin && pestanaAdmin === "citas" ? (
              <>
                <section className="admin-card">
                  <p className="eyebrow eyebrow-dark">AGENDA DEL TALLER</p>
                  <h2>Calendario de citas</h2>
                  <AgendaAdmin
                    citas={citasAdmin}
                    fecha={fechaAgendaAdmin}
                    modo={vistaAgendaAdmin}
                    alCambiarFecha={setFechaAgendaAdmin}
                    alCambiarModo={setVistaAgendaAdmin}
                  />
                </section>
                <section className="admin-card">
                  <p className="eyebrow eyebrow-dark">GESTIÓN</p>
                  <h2>Detalle y estado de las citas</h2>
                  <TablaCitas citas={citasAdmin} alCambiar={actualizarEstadoCita} alReprogramar={reprogramarCita} />
                </section>
              </>
            ) : null}
            {!cargandoAdmin && pestanaAdmin === "valoraciones" ? <div className="admin-card"><p className="eyebrow eyebrow-dark">PROYECTOS POR REVISAR</p><h2>Solicitudes de cotización</h2><TablaValoraciones valoraciones={valoracionesAdmin} alCambiar={actualizarEstadoValoracion} /></div> : null}
            {!cargandoAdmin && pestanaAdmin === "galeria" ? (
              <>
                <section className="admin-card">
                  <p className="eyebrow eyebrow-dark">NUEVO TRABAJO</p><h2>Subir foto o video</h2>
                  <p className="gallery-upload-note">Los archivos se guardan como privados. No se muestran públicamente hasta que confirmes la autorización de publicación.</p>
                  <form className="gallery-upload-form" onSubmit={subirTrabajo}>
                    <label>Título<input name="titulo" required minLength="2" maxLength="120" placeholder="Ej. Forrado completo" /></label>
                    <label>Descripción <span className="optional">(opcional)</span><textarea name="descripcion" rows="3" maxLength="1000" placeholder="Detalles del trabajo realizado" /></label>
                    <label>Foto o video<input name="archivo" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required /></label>
                    <button className="button button-primary" type="submit" disabled={subiendoMedia}>{subiendoMedia ? "Subiendo…" : "Guardar como borrador →"}</button>
                  </form>
                </section>
                <section className="admin-card"><p className="eyebrow eyebrow-dark">ARCHIVOS DEL TALLER</p><h2>Publicaciones y borradores</h2>
                  <GaleriaAdmin trabajos={galeriaAdmin} permisos={permisosPublicacion} alCambiarPermiso={(id, autorizado) => setPermisosPublicacion((actual) => ({ ...actual, [id]: autorizado }))} alPublicar={(item) => cambiarPublicacionMedia(item, true)} alRetirar={(item) => cambiarPublicacionMedia(item, false)} alEliminar={eliminarTrabajo} />
                </section>
              </>
            ) : null}
            {!cargandoAdmin && pestanaAdmin === "servicios" ? (
              <>
                <section className="admin-card">
                  <p className="eyebrow eyebrow-dark">{servicioEditando ? "EDITAR SERVICIO" : "NUEVO SERVICIO"}</p>
                  <h2>{servicioEditando ? "Actualiza el catálogo" : "Agrega un servicio"}</h2>
                  <form className="service-edit-form" key={servicioEditando?.id || "nuevo"} onSubmit={guardarServicio}>
                    <label>Nombre<input name="nombre" defaultValue={servicioEditando?.nombre || ""} required minLength="2" maxLength="100" placeholder="Ej. Wrap completo" /></label>
                    <label>Duración en minutos<input name="duracion_minutos" type="number" min="15" max="1440" step="15" defaultValue={servicioEditando?.duracion_minutos || 120} required /></label>
                    <label>Precio desde (COP)<input name="precio_desde" type="number" min="0" step="1000" defaultValue={servicioEditando?.precio_desde ?? ""} placeholder="Vacío para cotizar" /></label>
                    <label className="service-description-field">Descripción<textarea name="descripcion" defaultValue={servicioEditando?.descripcion || ""} rows="3" maxLength="1000" /></label>
                    <div className="service-form-actions"><button className="button button-primary" type="submit" disabled={guardandoServicio}>{guardandoServicio ? "Guardando…" : servicioEditando ? "Guardar cambios" : "Agregar servicio"}</button>{servicioEditando ? <button className="button button-quiet" type="button" onClick={() => setServicioEditando(null)}>Cancelar edición</button> : null}</div>
                  </form>
                </section>
                <section className="admin-card">
                  <p className="eyebrow eyebrow-dark">CATÁLOGO</p><h2>Servicios y precios publicados</h2>
                  <div className="service-admin-list">
                    {serviciosAdmin.map((servicio) => <article className="service-admin-item" key={servicio.id}>
                      <div><h3>{servicio.nombre}</h3><p>{servicio.descripcion || "Sin descripción"}</p><small>{duracionTexto(servicio.duracion_minutos)} · {precioTexto(servicio.precio_desde)}</small></div>
                      <span className={`status-pill ${servicio.activo ? "confirmada" : "cancelada"}`}>{servicio.activo ? "Visible" : "Oculto"}</span>
                      <div className="service-admin-actions">
                        <button className="table-action" type="button" onClick={() => { setServicioEditando(servicio); window.setTimeout(() => document.querySelector(".service-edit-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }}>Editar</button>
                        <button className="table-action" type="button" onClick={() => cambiarEstadoServicio(servicio)}>{servicio.activo ? "Ocultar" : "Activar"}</button>
                      </div>
                    </article>)}
                    {!serviciosAdmin.length ? <TablaVacia texto="Todavía no hay servicios para administrar." /> : null}
                  </div>
                </section>
              </>
            ) : null}
            {!cargandoAdmin && pestanaAdmin === "diseno" ? (
              <>
                <section className="admin-card">
                  <p className="eyebrow eyebrow-dark">IMAGEN DE PORTADA</p><h2>Actualiza la foto principal</h2>
                  <p className="gallery-upload-note">La imagen se verá en el espacio donde antes aparecía la ilustración de la moto. La foto MODELO 2 está configurada como imagen inicial.</p>
                  <img className="design-preview" src={configuracion.imagen_portada_url || imagenModeloDos} alt="Vista previa de la imagen de portada" />
                  <label className="design-image-picker">Subir otra imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={cambiarImagenPortada} disabled={subiendoPortada} /></label>
                  {subiendoPortada ? <p className="signed-in-note">Subiendo imagen…</p> : null}
                </section>
                <section className="admin-card">
                  <p className="eyebrow eyebrow-dark">COLORES DE LA PÁGINA</p><h2>Personaliza el estilo</h2>
                  <form className="design-colors-form" onSubmit={guardarDiseno}>
                    <label>Color principal (botones y detalles)<span className="color-input-row"><input name="color_primario" type="color" value={configuracion.color_primario} onChange={(event) => setConfiguracion((actual) => ({ ...actual, color_primario: event.target.value }))} /><span>{configuracion.color_primario}</span></span></label>
                    <label>Color de acento (títulos y resaltados)<span className="color-input-row"><input name="color_acento" type="color" value={configuracion.color_acento} onChange={(event) => setConfiguracion((actual) => ({ ...actual, color_acento: event.target.value }))} /><span>{configuracion.color_acento}</span></span></label>
                    <label>Fondo oscuro (portada y panel)<span className="color-input-row"><input name="color_fondo_oscuro" type="color" value={configuracion.color_fondo_oscuro} onChange={(event) => setConfiguracion((actual) => ({ ...actual, color_fondo_oscuro: event.target.value }))} /><span>{configuracion.color_fondo_oscuro}</span></span></label>
                    <label className="whatsapp-number-field">WhatsApp del taller (código de país + número)
                      <input name="whatsapp_numero" type="tel" inputMode="numeric" autoComplete="tel" placeholder="Ejemplo Colombia: 573001234567" value={configuracion.whatsapp_numero} onChange={(event) => setConfiguracion((actual) => ({ ...actual, whatsapp_numero: event.target.value }))} />
                      <span className="field-help">Escribe solo dígitos, incluyendo el código de país. Ej.: 57 + número celular.</span>
                    </label>
                    <button className="button button-primary" type="submit">Guardar diseño y WhatsApp →</button>
                  </form>
                </section>
              </>
            ) : null}
          </div>
        </main>
      ) : null}

      <footer className="site-footer">
        <a className="brand footer-brand" href="#inicio" onClick={(event) => { event.preventDefault(); irAVista("inicio"); }}><img className="brand-logo" src={logo} alt="DWRAPS" /></a>
        <span>PPF · WRAP · DISEÑO Y CALCOMANÍAS · BOGOTÁ</span>
        {enlaceWhatsApp(configuracion.whatsapp_numero)
          ? <a className="footer-contact" href={enlaceWhatsApp(configuracion.whatsapp_numero)} target="_blank" rel="noreferrer">Escríbenos por WhatsApp</a>
          : null}
        <button className="footer-admin" onClick={() => irAVista("ingreso-admin")}>Acceso administrador</button>
        <span className="copyright">Carrera 25B #41-35 sur, Bogotá · © {new Date().getFullYear()} DWRAPS.</span>
      </footer>
      {enlaceWhatsApp(configuracion.whatsapp_numero)
        ? <a className="whatsapp-floating" href={enlaceWhatsApp(configuracion.whatsapp_numero)} target="_blank" rel="noreferrer" aria-label="Escríbenos por WhatsApp">WhatsApp <span aria-hidden="true">↗</span></a>
        : null}
      {aviso ? <div className="toast show" role="status">{aviso}</div> : null}
    </>
  );
}

function TablaCitas({ citas, alCambiar, alReprogramar }) {
  const [citaEditando, setCitaEditando] = useState("");
  const [fechaEditada, setFechaEditada] = useState("");
  const [horaEditada, setHoraEditada] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  if (!citas.length) return <TablaVacia texto="Todavía no hay citas para mostrar." />;
  async function guardarProgramacion(id) {
    setGuardandoEdicion(true);
    try {
      const guardado = await alReprogramar(id, fechaEditada, horaEditada);
      if (guardado) setCitaEditando("");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Fecha y hora</th><th>Cliente / moto</th><th>Servicio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
    {citas.map((cita) => {
      const editando = citaEditando === cita.id;
      return (
        <tr key={cita.id}>
          <td>
            {editando ? (
              <div className="reschedule-form">
                <label>Fecha<input type="date" value={fechaEditada} min={fechaLocal(new Date())} required onChange={(event) => setFechaEditada(event.target.value)} /></label>
                <label>Hora<input type="time" value={horaEditada} step="1800" required onChange={(event) => setHoraEditada(event.target.value)} /></label>
              </div>
            ) : <><strong>{textoFecha(cita.fecha, { day: "numeric", month: "short", year: "numeric" })}</strong><br />{cita.hora}</>}
          </td>
          <td><strong>{cita.nombre_cliente}</strong><br />{cita.telefono_cliente}<br />{cita.motocicleta}</td>
          <td>{cita.nombre_servicio}<br /><span>{duracionTexto(cita.duracion_minutos)}</span></td>
          <td><span className={`status-pill ${cita.estado}`}>{cita.estado}</span></td>
          <td><div className="table-actions">
            {editando ? (
              <>
                <button className="table-action" type="button" disabled={guardandoEdicion || !fechaEditada || !horaEditada} onClick={() => guardarProgramacion(cita.id)}>{guardandoEdicion ? "Guardando…" : "Guardar horario"}</button>
                <button className="table-action" type="button" disabled={guardandoEdicion} onClick={() => setCitaEditando("")}>Cancelar edición</button>
              </>
            ) : (
              <>
                {["pendiente", "confirmada"].includes(cita.estado) ? <button className="table-action" type="button" onClick={() => { setCitaEditando(cita.id); setFechaEditada(cita.fecha); setHoraEditada(cita.hora); }}>Cambiar fecha/hora</button> : null}
                {cita.estado === "pendiente" ? <button className="table-action" type="button" onClick={() => alCambiar(cita.id, "confirmada")}>Confirmar</button> : null}
                {["pendiente", "confirmada"].includes(cita.estado) ? <button className="table-action" type="button" onClick={() => alCambiar(cita.id, "cancelada")}>Cancelar</button> : null}
                {cita.estado === "confirmada" ? <button className="table-action" type="button" onClick={() => alCambiar(cita.id, "completada")}>Completar</button> : null}
              </>
            )}
          </div></td>
        </tr>
      );
    })}
  </tbody></table></div>;
}

function TablaValoraciones({ valoraciones, alCambiar }) {
  if (!valoraciones.length) return <TablaVacia texto="Aún no hay solicitudes de cotización." />;
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Cliente / moto</th><th>Proyecto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
    {valoraciones.map((item) => <tr key={item.id}><td><strong>{item.nombre_cliente}</strong><br />{item.telefono_cliente}<br />{item.motocicleta}</td><td>{item.nombre_servicio}<br /><span>{item.detalle}</span></td><td><span className={`status-pill ${item.estado}`}>{item.estado}</span></td><td><div className="table-actions">{item.estado === "nueva" ? <><button className="table-action" onClick={() => alCambiar(item.id, "contactada")}>Marcar contactada</button><button className="table-action" onClick={() => alCambiar(item.id, "rechazada")}>Cerrar</button></> : null}{item.estado === "contactada" ? <button className="table-action" onClick={() => alCambiar(item.id, "cerrada")}>Cerrar solicitud</button> : null}</div></td></tr>)}
  </tbody></table></div>;
}

function ContenidoMedia({ item, clase = "" }) {
  if (!item.url) return <div className={`gallery-media-empty ${clase}`}>Vista previa no disponible</div>;
  return item.tipo_mime.startsWith("video/")
    ? <video className={`gallery-media ${clase}`} src={item.url} controls preload="metadata" />
    : <img className={`gallery-media ${clase}`} src={item.url} alt={item.titulo} loading="lazy" />;
}

function Galeria({ trabajos }) {
  if (!trabajos.length) return <TablaVacia texto="Pronto compartiremos aquí algunos de nuestros trabajos." />;
  return <div className="gallery-grid">
    {trabajos.map((item) => <article className="gallery-card" key={item.id}>
      <ContenidoMedia item={item} />
      <div className="gallery-card-copy"><h3>{item.titulo}</h3>{item.descripcion ? <p>{item.descripcion}</p> : null}</div>
    </article>)}
  </div>;
}

function GaleriaAdmin({ trabajos, permisos, alCambiarPermiso, alPublicar, alRetirar, alEliminar }) {
  if (!trabajos.length) return <TablaVacia texto="Aún no has subido fotos o videos." />;
  return <div className="gallery-admin-list">
    {trabajos.map((item) => <article className="gallery-admin-item" key={item.id}>
      <ContenidoMedia item={item} clase="gallery-admin-preview" />
      <div className="gallery-admin-detail">
        <div className="gallery-admin-heading"><h3>{item.titulo}</h3><span className={`status-pill ${item.estado === "publicada" ? "confirmada" : "pendiente"}`}>{item.estado === "publicada" ? "Publicada" : "Borrador privado"}</span></div>
        {item.descripcion ? <p>{item.descripcion}</p> : null}
        <small>{item.nombre_archivo} · {new Date(item.creada_en).toLocaleDateString("es-CO")}</small>
        <div className="gallery-admin-actions">
          {item.estado === "borrador" ? <>
            <label className="publication-consent"><input type="checkbox" checked={Boolean(permisos[item.id])} onChange={(event) => alCambiarPermiso(item.id, event.target.checked)} /> Confirmo que tengo permiso para publicar este contenido.</label>
            <button className="button button-primary button-small" type="button" disabled={!permisos[item.id]} onClick={() => alPublicar(item)}>Autorizar y publicar</button>
          </> : <button className="button button-quiet button-small" type="button" onClick={() => alRetirar(item)}>Retirar publicación</button>}
          <button className="table-action" type="button" onClick={() => alEliminar(item)}>Eliminar</button>
        </div>
      </div>
    </article>)}
  </div>;
}
