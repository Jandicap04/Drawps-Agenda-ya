import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

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
    : `Desde ${Number(precio).toLocaleString("es")} (por confirmar)`;
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

export default function App() {
  const [vista, setVista] = useState("inicio");
  const [servicios, setServicios] = useState(serviciosDeMuestra);
  const [apiConectada, setApiConectada] = useState(false);
  const [mensajeApi, setMensajeApi] = useState("Conectando con el servidor…");
  const [usuario, setUsuario] = useState(null);
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
  const [valoracionesAdmin, setValoracionesAdmin] = useState([]);
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
    api.estado()
      .then(async (resultado) => {
        if (!vigente) return;
        setApiConectada(true);
        setMensajeApi("");
        setUsuario(resultado.usuario || null);
        const catalogo = await api.servicios();
        if (!vigente) return;
        setServicios(catalogo);
        if (catalogo.length && !catalogo.some((servicio) => servicio.id === servicioId)) {
          setServicioId(catalogo[0].id);
        }
      })
      .catch((error) => {
        if (!vigente) return;
        setMensajeApi(`Vista previa: el servidor no está conectado (${error.message}). Las reservas se activarán al conectar PostgreSQL.`);
      });
    return () => { vigente = false; };
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
    Promise.all([api.resumenAdmin(), api.citasAdmin(), api.valoracionesAdmin()])
      .then(([resumen, citas, valoraciones]) => {
        if (!vigente) return;
        setResumenAdmin(resumen);
        setCitasAdmin(citas);
        setValoracionesAdmin(valoraciones);
      })
      .catch((error) => mostrarAviso(error.message))
      .finally(() => { if (vigente) setCargandoAdmin(false); });
    return () => { vigente = false; };
  }, [vista, usuario]);

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
      const cuenta = tipoAcceso === "registro"
        ? await api.registrarCliente(datos)
        : await api.ingresarCliente(datos);
      setUsuario(cuenta.usuario);
      irAVista("reservar");
      mostrarAviso("Ya puedes continuar con tu cita.");
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  async function enviarReserva(event) {
    event.preventDefault();
    if (!apiConectada) {
      mostrarAviso("Conecta el servidor y PostgreSQL para registrar una cita.");
      return;
    }
    if (!usuario || usuario.rol !== "cliente") {
      irAVista("cuenta");
      mostrarAviso("Ingresa o crea tu cuenta para reservar.");
      return;
    }
    if (!fecha || !hora || !servicioActual) {
      mostrarAviso("Elige el servicio, la fecha y la hora disponibles.");
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await api.crearCita({
        servicio_id: servicioId,
        fecha,
        hora,
        motocicleta: String(form.get("motocicleta") || "").trim(),
        notas: String(form.get("notas") || "").trim(),
      });
      setHora("");
      mostrarAviso("Solicitud enviada. El taller confirmará tu cita.");
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
    const form = new FormData(event.currentTarget);
    try {
      await api.crearValoracion({
        nombre: String(form.get("nombre") || "").trim(),
        telefono: String(form.get("telefono") || "").trim(),
        motocicleta: String(form.get("motocicleta") || "").trim(),
        servicio_id: String(form.get("servicio_id") || ""),
        detalle: String(form.get("detalle") || "").trim(),
      });
      event.currentTarget.reset();
      setMotoCotizacion("");
      setIdeaCotizacion("");
      mostrarAviso("Recibimos tu solicitud. Te contactaremos para conversar sobre el proyecto.");
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

  async function actualizarEstadoValoracion(id, estado) {
    try {
      await api.cambiarEstadoValoracion(id, estado);
      setValoracionesAdmin(await api.valoracionesAdmin());
      setResumenAdmin(await api.resumenAdmin());
    } catch (error) {
      mostrarAviso(error.message);
    }
  }

  const contenidoCalendario = (compacto) => (
    <section className={compacto ? "quick-calendar" : "form-card calendar-card"}>
      <p className="eyebrow"><span className="status-dot" /> AGENDA TU CITA</p>
      <h2>{compacto ? "Elige la fecha y hora" : "Selecciona fecha y hora"}</h2>
      <p>{compacto ? "Selecciona el día que más te convenga y asegura tu espacio." : "Las horas ocupadas no aparecerán disponibles."}</p>
      <label className="quick-service-select">
        Servicio
        <select value={servicioId} onChange={(event) => cambiarServicio(event.target.value)} aria-label="Servicio para consultar horarios">
          {servicios.filter((servicio) => servicio.activo !== false).map((servicio) =>
            <option key={servicio.id} value={servicio.id}>{servicio.nombre} · {duracionTexto(servicio.duracion_minutos)}</option>)}
        </select>
      </label>
      <div className="quick-calendar-layout">
        <div className="quick-month">
          <Calendario mes={mes} fechaSeleccionada={fecha} alCambiarMes={cambiarMes} alElegirFecha={(nuevaFecha) => { setFecha(nuevaFecha); setHora(""); }} />
        </div>
        <div className="quick-time-list">
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
      {compacto ? (
        <button className="button button-primary button-full" type="button" disabled={!apiConectada} onClick={() => { if (fecha && hora) irAVista("reservar"); else mostrarAviso("Elige una fecha y una hora para continuar."); }}>
          ▣ &nbsp; Confirmar cita <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </section>
  );

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); irAVista("inicio"); }}>
          <span className="brand-mark">M</span><span>MOTO<span className="brand-light">FORMA</span></span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <button className={`nav-link ${vista === "inicio" ? "active" : ""}`} onClick={() => irAVista("inicio")}>Inicio</button>
          <button className="nav-link" onClick={() => navegarSeccion("servicios")}>Servicios</button>
          <button className="nav-link" onClick={() => navegarSeccion("servicios")}>Galería</button>
          <button className={`nav-link ${vista === "cotizar" ? "active" : ""}`} onClick={() => irAVista("cotizar")}>Cotiza</button>
          <button className={`nav-link ${vista === "reservar" ? "active" : ""}`} onClick={() => irAVista("reservar")}>Agenda</button>
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
            <div className="hero-art" role="img" aria-label="Ilustración de una motocicleta personalizada">
              <div className="art-grid" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
              <div className="art-label"><span /><span>HECHA PARA DESTACAR</span></div>
              <div className="bike-placeholder"><div className="wheel wheel-back" /><div className="wheel wheel-front" /><div className="bike-body" /><div className="bike-seat" /><div className="bike-tank" /><div className="bike-fork" /><div className="bike-handle" /><div className="bike-light" /><div className="bike-frame" /><div className="bike-accent" /></div>
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
            {contenidoCalendario(true)}
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
              {contenidoCalendario(false)}
              <form className="form-card booking-form" onSubmit={enviarReserva}>
                <div className="step-heading"><span className="step-number">03</span><div><h2>Tus datos</h2><p>Ingresa con tu celular para crear una cita.</p></div></div>
                {usuario?.rol === "cliente" ? <p className="signed-in-note">Sesión: {usuario.nombre} · {usuario.telefono}</p> : <p className="signed-in-note">Para reservar necesitarás una cuenta de cliente. <button type="button" className="inline-button" onClick={() => { setTipoAcceso("ingreso"); irAVista("cuenta"); }}>Ingresar o crear cuenta</button></p>}
                <div className="form-grid">
                  <label className="field-wide">Marca, modelo y año de tu moto<input name="motocicleta" placeholder="Ej. Yamaha MT-07, 2023" required /></label>
                  <label className="field-wide">Cuéntanos un poco más <span className="optional">(opcional)</span><textarea name="notas" rows="3" placeholder="Colores, referencias o detalles que debamos conocer" /></label>
                  <div className="field-wide form-foot"><p>El precio se confirmará contigo antes de iniciar el trabajo.</p><button className="button button-primary" type="submit" disabled={!apiConectada}>Confirmar cita →</button></div>
                </div>
              </form>
            </div>
            <aside className="booking-summary"><p className="eyebrow">RESUMEN</p><h2>Tu cita</h2><div className="summary-divider" />
              <div className="summary-row"><span>Servicio</span><strong>{servicioActual?.nombre || "Elige un servicio"}</strong></div>
              <div className="summary-row"><span>Duración estimada</span><strong>{servicioActual ? duracionTexto(servicioActual.duracion_minutos) : "—"}</strong></div>
              <div className="summary-row"><span>Fecha</span><strong>{fecha ? textoFecha(fecha) : "Selecciona un día"}</strong></div>
              <div className="summary-row"><span>Hora</span><strong>{hora || "—"}</strong></div>
              <div className="summary-note"><span>ⓘ</span><p>El precio final puede variar según el estado y modelo de tu moto.</p></div>
            </aside>
          </div>
        </main>
      ) : null}

      {vista === "cotizar" ? (
        <main className="section-wrap inner-view">
          <div className="page-heading"><p className="eyebrow eyebrow-dark">CUÉNTANOS TU IDEA</p><h1>Hagamos una <span>valoración.</span></h1><p>Comparte los detalles de tu moto y del trabajo que tienes en mente. Te contactaremos para asesorarte.</p></div>
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
            <form className="auth-form" onSubmit={enviarAcceso}>
              {tipoAcceso === "registro" ? <label>Nombre completo<input name="nombre" autoComplete="name" required minLength="2" /></label> : null}
              <label>Celular<input name="telefono" inputMode="tel" autoComplete="tel" placeholder="+código de país y número" required /></label>
              <label>Clave<input name="clave" type="password" minLength="8" autoComplete={tipoAcceso === "registro" ? "new-password" : "current-password"} required /></label>
              <button className="button button-primary button-full" type="submit">{tipoAcceso === "registro" ? "Crear cuenta" : "Ingresar"}</button>
            </form>
            <p className="auth-switch">{tipoAcceso === "registro" ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"} <button className="inline-button" onClick={() => setTipoAcceso(tipoAcceso === "registro" ? "ingreso" : "registro")}>{tipoAcceso === "registro" ? "Ingresar" : "Crear cuenta"}</button></p>
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
              {["resumen", "citas", "valoraciones"].map((tab) => <button key={tab} className={`admin-tab ${pestanaAdmin === tab ? "active" : ""}`} onClick={() => setPestanaAdmin(tab)}>{tab === "resumen" ? "Resumen" : tab === "citas" ? <>Citas <span className="tab-count">{citasAdmin.length}</span></> : <>Valoraciones <span className="tab-count">{valoracionesAdmin.length}</span></>}</button>)}
            </div>
            {cargandoAdmin ? <TablaVacia texto="Cargando datos del taller…" /> : null}
            {!cargandoAdmin && pestanaAdmin === "resumen" ? <>
              <div className="stats-grid">
                <article className="stat-card"><span>Citas pendientes</span><strong>{resumenAdmin?.citas_pendientes ?? 0}</strong><small>Por confirmar</small></article>
                <article className="stat-card"><span>Próximas citas</span><strong>{resumenAdmin?.citas_proximas ?? 0}</strong><small>En tu agenda</small></article>
                <article className="stat-card"><span>Valoraciones nuevas</span><strong>{resumenAdmin?.valoraciones_nuevas ?? 0}</strong><small>Por revisar</small></article>
                <article className="stat-card"><span>Servicios activos</span><strong>{resumenAdmin?.servicios_activos ?? 0}</strong><small>En tu catálogo</small></article>
              </div>
              <div className="admin-card"><div className="admin-card-head"><div><p className="eyebrow eyebrow-dark">AGENDA</p><h2>Próximas citas</h2></div><button className="inline-button" onClick={() => setPestanaAdmin("citas")}>Ver todas →</button></div><TablaCitas citas={citasAdmin.filter((cita) => ["pendiente", "confirmada"].includes(cita.estado)).slice(0, 5)} alCambiar={actualizarEstadoCita} /></div>
            </> : null}
            {!cargandoAdmin && pestanaAdmin === "citas" ? <div className="admin-card"><p className="eyebrow eyebrow-dark">AGENDA</p><h2>Todas las citas</h2><TablaCitas citas={citasAdmin} alCambiar={actualizarEstadoCita} /></div> : null}
            {!cargandoAdmin && pestanaAdmin === "valoraciones" ? <div className="admin-card"><p className="eyebrow eyebrow-dark">PROYECTOS POR REVISAR</p><h2>Solicitudes de valoración</h2><TablaValoraciones valoraciones={valoracionesAdmin} alCambiar={actualizarEstadoValoracion} /></div> : null}
          </div>
        </main>
      ) : null}

      <footer className="site-footer">
        <a className="brand footer-brand" href="#inicio" onClick={(event) => { event.preventDefault(); irAVista("inicio"); }}><span className="brand-mark">M</span><span>MOTO<span className="brand-light">FORMA</span></span></a>
        <span>TU MOTO EN LAS MEJORES MANOS</span>
        <button className="footer-admin" onClick={() => irAVista("ingreso-admin")}>Acceso administrador</button>
        <span className="copyright">© {new Date().getFullYear()} MotoForma.</span>
      </footer>
      {aviso ? <div className="toast" role="status">{aviso}</div> : null}
    </>
  );
}

function TablaCitas({ citas, alCambiar }) {
  if (!citas.length) return <TablaVacia texto="Todavía no hay citas para mostrar." />;
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Fecha y hora</th><th>Cliente / moto</th><th>Servicio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
    {citas.map((cita) => <tr key={cita.id}><td><strong>{textoFecha(cita.fecha, { day: "numeric", month: "short", year: "numeric" })}</strong><br />{cita.hora}</td><td><strong>{cita.nombre_cliente}</strong><br />{cita.telefono_cliente}<br />{cita.motocicleta}</td><td>{cita.nombre_servicio}<br /><span>{duracionTexto(cita.duracion_minutos)}</span></td><td><span className={`status-pill ${cita.estado}`}>{cita.estado}</span></td><td><div className="table-actions">{cita.estado === "pendiente" ? <button className="table-action" onClick={() => alCambiar(cita.id, "confirmada")}>Confirmar</button> : null}{["pendiente", "confirmada"].includes(cita.estado) ? <button className="table-action" onClick={() => alCambiar(cita.id, "cancelada")}>Cancelar</button> : null}{cita.estado === "confirmada" ? <button className="table-action" onClick={() => alCambiar(cita.id, "completada")}>Completar</button> : null}</div></td></tr>)}
  </tbody></table></div>;
}

function TablaValoraciones({ valoraciones, alCambiar }) {
  if (!valoraciones.length) return <TablaVacia texto="Aún no hay solicitudes de valoración." />;
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Cliente / moto</th><th>Proyecto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
    {valoraciones.map((item) => <tr key={item.id}><td><strong>{item.nombre_cliente}</strong><br />{item.telefono_cliente}<br />{item.motocicleta}</td><td>{item.nombre_servicio}<br /><span>{item.detalle}</span></td><td><span className={`status-pill ${item.estado}`}>{item.estado}</span></td><td><div className="table-actions">{item.estado === "nueva" ? <><button className="table-action" onClick={() => alCambiar(item.id, "contactada")}>Marcar contactada</button><button className="table-action" onClick={() => alCambiar(item.id, "rechazada")}>Cerrar</button></> : null}{item.estado === "contactada" ? <button className="table-action" onClick={() => alCambiar(item.id, "cerrada")}>Cerrar solicitud</button> : null}</div></td></tr>)}
  </tbody></table></div>;
}
