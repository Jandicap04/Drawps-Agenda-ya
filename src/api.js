import { exigirSupabase, supabase } from "./supabase.js";

const BUCKET_BORRADORES = "galeria-borradores";
const BUCKET_PUBLICO = "galeria-publica";
const BUCKET_IMAGENES_SITIO = "imagenes-sitio";
const ZONA_HORARIA = import.meta.env.VITE_BUSINESS_TIME_ZONE || "America/Bogota";
const MAX_BYTES_MEDIA = 100 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
const CONFIGURACION_INICIAL = {
  color_primario: "#c9fa58",
  color_acento: "#a2d83b",
  color_fondo_oscuro: "#0d1317",
  whatsapp_numero: "573214066140",
  imagen_portada_url: "",
};

function comprobar(error) {
  if (error) throw new Error(error.message || "No se pudo completar la operación en Supabase.");
}

async function obtenerPerfil(user) {
  if (!user) return null;
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, telefono, rol")
    .eq("id", user.id)
    .single();
  comprobar(error);
  return data;
}

function aplicarZonaHorario(cita) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(cita.inicio));
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  const reloj = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(cita.inicio));
  return {
    ...cita,
    fecha: `${valores.year}-${valores.month}-${valores.day}`,
    hora: reloj,
    nombre_cliente: cita.perfiles?.nombre || "Cliente",
    telefono_cliente: cita.perfiles?.telefono || "",
    nombre_servicio: cita.servicios?.nombre || "Servicio",
    duracion_minutos: cita.servicios?.duracion_minutos || 0,
  };
}

function nombreArchivoSeguro(nombre) {
  return nombre.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90) || "archivo";
}

async function urlDeRegistro(registro) {
  const bucket = registro.estado === "publicada" ? BUCKET_PUBLICO : BUCKET_BORRADORES;
  const ruta = registro.ruta_publica || registro.ruta_borrador;
  if (!ruta && registro.estado === "publicada" && registro.imagen_url) {
    return { ...registro, url: registro.imagen_url };
  }
  if (!ruta) return { ...registro, url: "" };
  if (registro.estado === "publicada") {
    const { data } = exigirSupabase().storage.from(bucket).getPublicUrl(ruta);
    return { ...registro, url: data.publicUrl };
  }
  const { data, error } = await exigirSupabase().storage.from(bucket).createSignedUrl(ruta, 60 * 30);
  comprobar(error);
  return { ...registro, url: data.signedUrl };
}

export const api = {
  async estado() {
    if (!supabase) throw new Error("Agrega las variables de Supabase en .env.local.");
    const { data: { session }, error } = await supabase.auth.getSession();
    comprobar(error);
    const perfil = await obtenerPerfil(session?.user);
    return { base_de_datos: "conectada", usuario: perfil };
  },

  observarSesion(callback) {
    const cliente = exigirSupabase();
    return cliente.auth.onAuthStateChange((_evento, session) => {
      if (!session?.user) {
        callback(null);
        return;
      }
      queueMicrotask(async () => {
        try {
          callback(await obtenerPerfil(session.user));
        } catch (error) {
          console.error("No se pudo cargar el perfil:", error);
          callback(null, error);
        }
      });
    });
  },

  async servicios() {
    const { data, error } = await exigirSupabase()
      .from("servicios")
      .select("id, nombre, descripcion, duracion_minutos, precio_desde, activo")
      .eq("activo", true)
      .order("nombre");
    comprobar(error);
    return data || [];
  },

  async serviciosAdmin() {
    const { data, error } = await exigirSupabase()
      .from("servicios")
      .select("id, nombre, descripcion, duracion_minutos, precio_desde, activo")
      .order("nombre");
    comprobar(error);
    return data || [];
  },

  async guardarServicio(servicio) {
    const cliente = exigirSupabase();
    const consulta = servicio.id
      ? cliente.from("servicios").update(servicio).eq("id", servicio.id)
      : cliente.from("servicios").insert(servicio);
    const { data, error } = await consulta
      .select("id, nombre, descripcion, duracion_minutos, precio_desde, activo")
      .single();
    comprobar(error);
    return data;
  },

  async configuracionSitio() {
    const { data, error } = await exigirSupabase()
      .from("configuracion_sitio")
      .select("color_primario, color_acento, color_fondo_oscuro, whatsapp_numero, imagen_portada_url")
      .eq("id", 1)
      .maybeSingle();
    comprobar(error);
    return {
      ...CONFIGURACION_INICIAL,
      ...data,
      whatsapp_numero: data?.whatsapp_numero || CONFIGURACION_INICIAL.whatsapp_numero,
    };
  },

  async guardarConfiguracionSitio(configuracion) {
    const { error } = await exigirSupabase()
      .from("configuracion_sitio")
      .upsert({ id: 1, ...configuracion }, { onConflict: "id" });
    comprobar(error);
  },

  async subirImagenPortada(archivo, configuracionActual) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
      throw new Error("Selecciona una imagen JPG, PNG o WebP.");
    }
    if (archivo.size > 10 * 1024 * 1024) {
      throw new Error("La imagen de portada debe pesar menos de 10 MB.");
    }
    const cliente = exigirSupabase();
    const { data: { user } } = await cliente.auth.getUser();
    if (!user) throw new Error("Inicia sesión como administrador para cambiar la portada.");
    const ruta = `${user.id}/${crypto.randomUUID()}-${nombreArchivoSeguro(archivo.name)}`;
    const { error } = await cliente.storage.from(BUCKET_IMAGENES_SITIO).upload(ruta, archivo, {
      contentType: archivo.type,
      cacheControl: "31536000",
      upsert: false,
    });
    comprobar(error);
    const { data } = cliente.storage.from(BUCKET_IMAGENES_SITIO).getPublicUrl(ruta);
    const configuracion = { ...configuracionActual, imagen_portada_url: data.publicUrl };
    const { error: errorGuardar } = await cliente
      .from("configuracion_sitio")
      .upsert({ id: 1, ...configuracion }, { onConflict: "id" });
    if (errorGuardar) {
      const { error: errorLimpieza } = await cliente.storage.from(BUCKET_IMAGENES_SITIO).remove([ruta]);
      if (errorLimpieza) {
        throw new Error(`${errorGuardar.message} La imagen que no se pudo guardar tampoco se pudo retirar: ${errorLimpieza.message}`);
      }
      comprobar(errorGuardar);
    }
    return configuracion;
  },

  async disponibilidad(servicioId, fecha) {
    const { data, error } = await exigirSupabase().rpc("obtener_disponibilidad", {
      p_servicio_id: servicioId,
      p_fecha: fecha,
      p_zona_horaria: ZONA_HORARIA,
    });
    comprobar(error);
    return { fecha, horarios: (data || []).map((fila) => fila.hora) };
  },

  async registrarCliente({ telefono, clave, nombre }) {
    const { data, error } = await exigirSupabase().auth.signUp({
      phone: telefono,
      password: clave,
      options: { data: { nombre } },
    });
    comprobar(error);
    if (!data.session) {
      return { requiereVerificacion: true, telefono };
    }
    return { usuario: await obtenerPerfil(data.user) };
  },

  async verificarTelefono({ telefono, codigo }) {
    const { data, error } = await exigirSupabase().auth.verifyOtp({
      phone: telefono,
      token: codigo,
      type: "sms",
    });
    comprobar(error);
    return { usuario: await obtenerPerfil(data.user) };
  },

  async ingresarCliente({ telefono, clave }) {
    const { data, error } = await exigirSupabase().auth.signInWithPassword({ phone: telefono, password: clave });
    comprobar(error);
    return { usuario: await obtenerPerfil(data.user) };
  },

  async ingresarAdmin({ correo, clave }) {
    const { data, error } = await exigirSupabase().auth.signInWithPassword({ email: correo, password: clave });
    comprobar(error);
    const perfil = await obtenerPerfil(data.user);
    if (perfil.rol !== "administrador") {
      await exigirSupabase().auth.signOut();
      throw new Error("Esta cuenta no tiene permisos de administración.");
    }
    return { usuario: perfil };
  },

  async salir() {
    const { error } = await exigirSupabase().auth.signOut();
    comprobar(error);
  },

  async crearCita({ servicio_id, fecha, hora, motocicleta, notas }) {
    const { data, error } = await exigirSupabase().rpc("crear_cita", {
      p_servicio_id: servicio_id,
      p_fecha: fecha,
      p_hora: hora,
      p_motocicleta: motocicleta,
      p_notas: notas || "",
      p_zona_horaria: ZONA_HORARIA,
    });
    comprobar(error);
    return data;
  },

  async crearValoracion({ nombre, telefono, motocicleta, servicio_id, detalle }) {
    const cliente = exigirSupabase();
    const { data: { user } } = await cliente.auth.getUser();
    const { error } = await cliente.from("solicitudes_valoracion").insert({
      cliente_id: user?.id || null,
      nombre_cliente: nombre,
      telefono_cliente: telefono,
      motocicleta,
      servicio_id: servicio_id || null,
      nombre_servicio: servicio_id
        ? (await cliente.from("servicios").select("nombre").eq("id", servicio_id).single()).data?.nombre || "Otro / necesito orientación"
        : "Otro / necesito orientación",
      detalle,
    });
    comprobar(error);
  },

  async resumenAdmin() {
    const cliente = exigirSupabase();
    const [citas, nuevas, servicios] = await Promise.all([
      cliente.from("citas").select("id, estado, inicio"),
      cliente.from("solicitudes_valoracion").select("id", { count: "exact", head: true }).eq("estado", "nueva"),
      cliente.from("servicios").select("id", { count: "exact", head: true }).eq("activo", true),
    ]);
    comprobar(citas.error);
    comprobar(nuevas.error);
    comprobar(servicios.error);
    const futuras = (citas.data || []).filter((cita) =>
      ["pendiente", "confirmada"].includes(cita.estado) && new Date(cita.inicio) >= new Date());
    return {
      citas_pendientes: (citas.data || []).filter((cita) => cita.estado === "pendiente").length,
      citas_proximas: futuras.length,
      valoraciones_nuevas: nuevas.count || 0,
      servicios_activos: servicios.count || 0,
    };
  },

  async citasAdmin() {
    const cliente = exigirSupabase();
    const { data: citas, error } = await cliente
      .from("citas")
      .select("id, cliente_id, servicio_id, inicio, estado, notas, motocicleta")
      .order("inicio", { ascending: true })
      .limit(500);
    comprobar(error);

    const perfilIds = [...new Set((citas || []).map((cita) => cita.cliente_id))];
    const servicioIds = [...new Set((citas || []).map((cita) => cita.servicio_id))];
    const [perfiles, servicios] = await Promise.all([
      perfilIds.length
        ? cliente.from("perfiles").select("id, nombre, telefono").in("id", perfilIds)
        : Promise.resolve({ data: [], error: null }),
      servicioIds.length
        ? cliente.from("servicios").select("id, nombre, duracion_minutos").in("id", servicioIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    comprobar(perfiles.error);
    comprobar(servicios.error);

    const perfilPorId = new Map((perfiles.data || []).map((perfil) => [perfil.id, perfil]));
    const servicioPorId = new Map((servicios.data || []).map((servicio) => [servicio.id, servicio]));
    return (citas || []).map((cita) => aplicarZonaHorario({
      ...cita,
      perfiles: perfilPorId.get(cita.cliente_id) || null,
      servicios: servicioPorId.get(cita.servicio_id) || null,
    }));
  },

  async valoracionesAdmin() {
    const { data, error } = await exigirSupabase()
      .from("solicitudes_valoracion")
      .select("id, nombre_cliente, telefono_cliente, motocicleta, nombre_servicio, detalle, estado, creada_en")
      .order("creada_en", { ascending: false })
      .limit(500);
    comprobar(error);
    return data || [];
  },

  async cambiarEstadoCita(id, estado) {
    const { error } = await exigirSupabase().from("citas").update({ estado }).eq("id", id);
    comprobar(error);
  },

  async cambiarEstadoValoracion(id, estado) {
    const { error } = await exigirSupabase().from("solicitudes_valoracion").update({ estado }).eq("id", id);
    comprobar(error);
  },

  async galeriaPublica() {
    const { data, error } = await exigirSupabase()
      .from("galeria_forrados")
      .select("id, titulo, descripcion, tipo_mime, ruta_publica, imagen_url, estado, creada_en")
      .eq("estado", "publicada")
      .order("creada_en", { ascending: false });
    comprobar(error);
    return Promise.all((data || []).map(urlDeRegistro));
  },

  async galeriaAdmin() {
    const { data, error } = await exigirSupabase()
      .from("galeria_forrados")
      .select("id, titulo, descripcion, tipo_mime, nombre_archivo, ruta_borrador, ruta_publica, imagen_url, creado_por, estado, autorizacion_publicacion, creada_en")
      .order("creada_en", { ascending: false });
    comprobar(error);
    return Promise.all((data || []).map(urlDeRegistro));
  },

  async subirMedia({ archivo, titulo, descripcion }) {
    if (!TIPOS_PERMITIDOS.has(archivo.type)) {
      throw new Error("Usa una imagen JPG, PNG o WebP, o un video MP4 o WebM.");
    }
    if (archivo.size > MAX_BYTES_MEDIA) {
      throw new Error("Cada foto o video debe pesar menos de 100 MB.");
    }
    const cliente = exigirSupabase();
    const { data: { user } } = await cliente.auth.getUser();
    if (!user) throw new Error("Inicia sesión como administrador antes de subir archivos.");
    const ruta = `${user.id}/${crypto.randomUUID()}-${nombreArchivoSeguro(archivo.name)}`;
    const { error: errorArchivo } = await cliente.storage.from(BUCKET_BORRADORES).upload(ruta, archivo, {
      contentType: archivo.type,
      cacheControl: "3600",
      upsert: false,
    });
    comprobar(errorArchivo);
    const { data, error } = await cliente.from("galeria_forrados").insert({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      tipo_mime: archivo.type,
      nombre_archivo: archivo.name,
      ruta_borrador: ruta,
      creado_por: user.id,
      estado: "borrador",
      imagen_url: "",
      categoria: "general",
      activo: false,
      orden: 0,
    }).select("id").single();
    if (error) {
      const { error: errorLimpieza } = await cliente.storage.from(BUCKET_BORRADORES).remove([ruta]);
      if (errorLimpieza) {
        throw new Error(`${error.message} El archivo temporal no se pudo retirar del almacenamiento: ${errorLimpieza.message}`);
      }
      comprobar(error);
    }
    return data;
  },

  async cambiarEstadoMedia(item, publicar) {
    const cliente = exigirSupabase();
    if (publicar) {
      const { data: archivo, error: errorDescarga } = await cliente.storage.from(BUCKET_BORRADORES).download(item.ruta_borrador);
      comprobar(errorDescarga);
      const rutaPublica = `${item.creado_por || item.ruta_borrador.split("/")[0]}/${crypto.randomUUID()}-${nombreArchivoSeguro(item.nombre_archivo || item.ruta_borrador.split("/").at(-1))}`;
      const { error: errorSubida } = await cliente.storage.from(BUCKET_PUBLICO).upload(rutaPublica, archivo, {
        contentType: item.tipo_mime,
        cacheControl: "31536000",
        upsert: false,
      });
      comprobar(errorSubida);
      const { data: archivoPublico } = cliente.storage.from(BUCKET_PUBLICO).getPublicUrl(rutaPublica);
      const { error } = await cliente.from("galeria_forrados")
        .update({
          estado: "publicada",
          ruta_borrador: null,
          ruta_publica: rutaPublica,
          autorizacion_publicacion: true,
          imagen_url: archivoPublico.publicUrl,
          activo: true,
        })
        .eq("id", item.id);
      if (error) {
        const { errorLimpieza } = await cliente.storage.from(BUCKET_PUBLICO).remove([rutaPublica]);
        if (errorLimpieza) {
          throw new Error(`${error.message} El archivo de publicación temporal quedó en Storage: ${errorLimpieza.message}`);
        }
        comprobar(error);
      }
      const { error: errorBorrador } = await cliente.storage.from(BUCKET_BORRADORES).remove([item.ruta_borrador]);
      comprobar(errorBorrador);
    } else {
      if (!item.ruta_publica) throw new Error("No encontramos el archivo publicado para retirarlo.");
      const { data: archivo, error: errorDescarga } = await cliente.storage.from(BUCKET_PUBLICO).download(item.ruta_publica);
      comprobar(errorDescarga);
      const nuevaRutaBorrador = `${item.creado_por}/${crypto.randomUUID()}-${nombreArchivoSeguro(item.nombre_archivo || item.ruta_publica.split("/").at(-1))}`;
      const { error: errorSubida } = await cliente.storage.from(BUCKET_BORRADORES).upload(nuevaRutaBorrador, archivo, {
        contentType: item.tipo_mime,
        cacheControl: "3600",
        upsert: false,
      });
      comprobar(errorSubida);
      const { error } = await cliente.from("galeria_forrados")
        .update({
          estado: "borrador",
          ruta_publica: null,
          ruta_borrador: nuevaRutaBorrador,
          autorizacion_publicacion: false,
          imagen_url: "",
          activo: false,
        })
        .eq("id", item.id);
      if (error) {
        const { errorLimpieza } = await cliente.storage.from(BUCKET_BORRADORES).remove([nuevaRutaBorrador]);
        if (errorLimpieza) {
          throw new Error(`${error.message} El archivo privado temporal quedó en Storage: ${errorLimpieza.message}`);
        }
        comprobar(error);
      }
      const { error: eliminar } = await cliente.storage.from(BUCKET_PUBLICO).remove([item.ruta_publica]);
      comprobar(eliminar);
    }
  },

  async eliminarMedia(item) {
    const cliente = exigirSupabase();
    if (item.ruta_borrador) {
      const { error } = await cliente.storage.from(BUCKET_BORRADORES).remove([item.ruta_borrador]);
      comprobar(error);
    }
    if (item.ruta_publica) {
      const { error } = await cliente.storage.from(BUCKET_PUBLICO).remove([item.ruta_publica]);
      comprobar(error);
    }
    const { error } = await cliente.from("galeria_forrados").delete().eq("id", item.id);
    comprobar(error);
  },
};
