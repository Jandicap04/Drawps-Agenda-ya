import "dotenv/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || "UTC";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

if (JWT_SECRET && JWT_SECRET.length < 32) throw new Error("JWT_SECRET debe tener al menos 32 caracteres aleatorios.");
try {
  new Intl.DateTimeFormat("es", { timeZone: BUSINESS_TIME_ZONE });
} catch {
  throw new Error("BUSINESS_TIME_ZONE no es una zona horaria válida.");
}

const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
}) : null;

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(async (req, _res, next) => {
  const header = req.headers.cookie || "";
  const cookie = header.split(";").map((part) => part.trim()).find((part) => part.startsWith("motoforma_sesion="));
  const token = cookie ? cookie.slice("motoforma_sesion=".length) : "";
  if (!token || !JWT_SECRET) return next();
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
  } catch {
    req.usuario = null;
  }
  next();
});
app.use("/api", (req, res, next) => {
  if (!DATABASE_URL) return res.status(503).json({ error: "Configura DATABASE_URL en .env para conectar PostgreSQL." });
  if (!JWT_SECRET) return res.status(503).json({ error: "Configura JWT_SECRET en .env para habilitar las sesiones seguras." });
  next();
});

const limitadorAcceso = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos y vuelve a intentar." },
});

function enviarSesion(res, usuario) {
  const token = jwt.sign(
    { sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre, telefono: usuario.telefono, correo: usuario.correo },
    JWT_SECRET,
    { expiresIn: "12h", issuer: "motoforma" },
  );
  res.cookie("motoforma_sesion", token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function usuarioPublico(usuario) {
  return { id: usuario.id, nombre: usuario.nombre, telefono: usuario.telefono || null, correo: usuario.correo || null, rol: usuario.rol };
}

function validarTelefono(valor) {
  const telefono = String(valor || "").replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(telefono) ? telefono : null;
}

function validarFecha(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))) return false;
  const date = new Date(`${fecha}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === fecha;
}

function fechaActualNegocio() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function horaActualNegocio() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function exigirRol(rol) {
  return (req, res, next) => {
    if (req.usuario?.rol !== rol) return res.status(401).json({ error: "Inicia sesión para continuar." });
    next();
  };
}

function validarUuid(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor || ""));
}

async function consultarHorarios(db, servicioId, fecha) {
  const servicio = await db.query(
    "SELECT duracion_minutos FROM servicios WHERE id = $1 AND activo = TRUE",
    [servicioId],
  );
  if (!servicio.rowCount) return null;

  const diaSemana = ((new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const horario = await db.query(
    "SELECT hora_apertura, hora_cierre, activo FROM horarios_atencion WHERE dia_semana = $1",
    [diaSemana],
  );
  if (!horario.rowCount || !horario.rows[0].activo) return [];

  const { hora_apertura: apertura, hora_cierre: cierre } = horario.rows[0];
  const minutoApertura = Number(apertura.slice(0, 2)) * 60 + Number(apertura.slice(3, 5));
  const minutoCierre = Number(cierre.slice(0, 2)) * 60 + Number(cierre.slice(3, 5));
  const duracion = servicio.rows[0].duracion_minutos;
  const ocupadas = await db.query(
    `SELECT
       to_char(inicio AT TIME ZONE $2, 'HH24:MI') AS hora_inicio,
       to_char(fin AT TIME ZONE $2, 'HH24:MI') AS hora_fin
     FROM citas
     WHERE estado IN ('pendiente', 'confirmada')
       AND inicio < (($1::date + 1)::timestamp AT TIME ZONE $2)
       AND fin > ($1::date::timestamp AT TIME ZONE $2)`,
    [fecha, BUSINESS_TIME_ZONE],
  );

  const hoy = fechaActualNegocio();
  const ahora = horaActualNegocio().split(":").map(Number);
  const minutoActual = ahora[0] * 60 + ahora[1];
  const intervalosOcupados = ocupadas.rows.map((cita) => {
    const [horaInicio, minutoInicio] = cita.hora_inicio.split(":").map(Number);
    const [horaFin, minutoFin] = cita.hora_fin.split(":").map(Number);
    return [horaInicio * 60 + minutoInicio, horaFin * 60 + minutoFin];
  });
  const disponibles = [];
  for (let inicio = minutoApertura; inicio + duracion <= minutoCierre; inicio += 30) {
    if (fecha === hoy && inicio <= minutoActual) continue;
    const fin = inicio + duracion;
    const traslapa = intervalosOcupados.some(([ocupadoDesde, ocupadoHasta]) =>
      inicio < ocupadoHasta && ocupadoDesde < fin);
    if (!traslapa) {
      disponibles.push(`${String(Math.floor(inicio / 60)).padStart(2, "0")}:${String(inicio % 60).padStart(2, "0")}`);
    }
  }
  return disponibles;
}

app.get("/api/estado", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ base_de_datos: "conectada", usuario: req.usuario ? usuarioPublico(req.usuario) : null });
});

app.get("/api/servicios", async (_req, res) => {
  const result = await pool.query(
    `SELECT id, nombre, descripcion, duracion_minutos, precio_desde, activo
     FROM servicios WHERE activo = TRUE ORDER BY nombre`,
  );
  res.json(result.rows);
});

app.get("/api/disponibilidad", async (req, res) => {
  const { servicioId, fecha } = req.query;
  if (!validarUuid(servicioId) || !validarFecha(fecha)) {
    return res.status(400).json({ error: "Selecciona un servicio y una fecha válidos." });
  }
  const horarios = await consultarHorarios(pool, servicioId, fecha);
  if (horarios === null) return res.status(404).json({ error: "El servicio ya no está disponible." });
  res.json({ fecha, horarios });
});

app.post("/api/auth/clientes/registro", limitadorAcceso, async (req, res) => {
  const { nombre, clave } = req.body || {};
  const telefono = validarTelefono(req.body?.telefono);
  if (!telefono) return res.status(400).json({ error: "Escribe tu celular con código de país, por ejemplo +1234567890." });
  if (typeof nombre !== "string" || nombre.trim().length < 2 || nombre.trim().length > 120) {
    return res.status(400).json({ error: "Escribe tu nombre completo." });
  }
  if (typeof clave !== "string" || clave.length < 8 || clave.length > 128) {
    return res.status(400).json({ error: "La clave debe tener entre 8 y 128 caracteres." });
  }
  const claveHash = await bcrypt.hash(clave, 12);
  try {
    const result = await pool.query(
      `INSERT INTO clientes (nombre, telefono, telefono_normalizado, clave_hash)
       VALUES ($1, $2, $2, $3)
       RETURNING id, nombre, telefono`,
      [nombre.trim(), telefono, claveHash],
    );
    const cliente = { ...result.rows[0], rol: "cliente" };
    enviarSesion(res, cliente);
    res.status(201).json({ usuario: usuarioPublico(cliente) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Ese celular ya tiene una cuenta. Ingresa con tu clave." });
    throw error;
  }
});

app.post("/api/auth/clientes/ingreso", limitadorAcceso, async (req, res) => {
  const telefono = validarTelefono(req.body?.telefono);
  const clave = req.body?.clave;
  if (!telefono || typeof clave !== "string" || !clave) {
    return res.status(400).json({ error: "Escribe un celular válido y tu clave." });
  }
  const result = await pool.query(
    `SELECT id, nombre, telefono, clave_hash FROM clientes
     WHERE telefono_normalizado = $1 AND activo = TRUE`,
    [telefono],
  );
  if (!result.rowCount || !(await bcrypt.compare(clave, result.rows[0].clave_hash))) {
    return res.status(401).json({ error: "El celular o la clave no coinciden." });
  }
  const cliente = { ...result.rows[0], rol: "cliente" };
  enviarSesion(res, cliente);
  res.json({ usuario: usuarioPublico(cliente) });
});

app.post("/api/auth/administradores/ingreso", limitadorAcceso, async (req, res) => {
  const correo = String(req.body?.correo || "").trim().toLowerCase();
  const clave = req.body?.clave;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || typeof clave !== "string" || !clave) {
    return res.status(400).json({ error: "Escribe un correo válido y tu clave." });
  }
  const result = await pool.query(
    `SELECT id, nombre, correo, clave_hash FROM administradores
     WHERE lower(trim(correo)) = $1 AND activo = TRUE`,
    [correo],
  );
  if (!result.rowCount || !(await bcrypt.compare(clave, result.rows[0].clave_hash))) {
    return res.status(401).json({ error: "El correo o la clave no coinciden." });
  }
  const administrador = { ...result.rows[0], rol: "administrador" };
  enviarSesion(res, administrador);
  res.json({ usuario: usuarioPublico(administrador) });
});

app.post("/api/auth/salir", (_req, res) => {
  res.clearCookie("motoforma_sesion", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
  res.status(204).end();
});

app.post("/api/citas", exigirRol("cliente"), async (req, res) => {
  const { servicio_id: servicioId, fecha, hora, motocicleta, notas = "" } = req.body || {};
  if (!validarUuid(servicioId) || !validarFecha(fecha) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(hora || ""))) {
    return res.status(400).json({ error: "Selecciona un servicio, una fecha y una hora válidos." });
  }
  if (typeof motocicleta !== "string" || motocicleta.trim().length < 2 || motocicleta.trim().length > 160) {
    return res.status(400).json({ error: "Escribe la marca, modelo y año de tu moto." });
  }
  if (typeof notas !== "string" || notas.length > 2000) return res.status(400).json({ error: "Las notas son demasiado largas." });

  const conexion = await pool.connect();
  try {
    await conexion.query("BEGIN");
    const horarios = await consultarHorarios(conexion, servicioId, fecha);
    if (horarios === null) {
      await conexion.query("ROLLBACK");
      return res.status(404).json({ error: "El servicio ya no está disponible." });
    }
    if (!horarios.includes(hora)) {
      await conexion.query("ROLLBACK");
      return res.status(409).json({ error: "Ese horario ya no está libre. Selecciona otra hora." });
    }
    const cliente = await conexion.query(
      "SELECT id, nombre, telefono FROM clientes WHERE id = $1 AND activo = TRUE",
      [req.usuario.sub],
    );
    if (!cliente.rowCount) {
      await conexion.query("ROLLBACK");
      return res.status(401).json({ error: "Vuelve a ingresar a tu cuenta para reservar." });
    }
    const result = await conexion.query(
      `INSERT INTO citas
         (cliente_id, servicio_id, nombre_cliente, telefono_cliente, motocicleta,
          nombre_servicio, duracion_minutos, inicio, fin, notas)
       SELECT $1, s.id, $2, $3, $4, s.nombre, s.duracion_minutos,
          (($5::date + $6::time) AT TIME ZONE $7),
          (($5::date + $6::time) AT TIME ZONE $7) + make_interval(mins => s.duracion_minutos),
          $8
       FROM servicios s WHERE s.id = $9 AND s.activo = TRUE
       RETURNING id, estado`,
      [cliente.rows[0].id, cliente.rows[0].nombre, cliente.rows[0].telefono, motocicleta.trim(), fecha, hora, BUSINESS_TIME_ZONE, notas.trim(), servicioId],
    );
    if (!result.rowCount) {
      await conexion.query("ROLLBACK");
      return res.status(404).json({ error: "El servicio ya no está disponible." });
    }
    await conexion.query("COMMIT");
    res.status(201).json({ id: result.rows[0].id, estado: result.rows[0].estado });
  } catch (error) {
    await conexion.query("ROLLBACK");
    if (error.code === "23P01") return res.status(409).json({ error: "Ese horario acaba de ocuparse. Selecciona otra hora." });
    throw error;
  } finally {
    conexion.release();
  }
});

app.post("/api/valoraciones", async (req, res) => {
  const { nombre, motocicleta, detalle } = req.body || {};
  const telefono = validarTelefono(req.body?.telefono);
  const servicioId = req.body?.servicio_id;
  if (typeof nombre !== "string" || nombre.trim().length < 2 || nombre.trim().length > 120 ||
      !telefono || typeof motocicleta !== "string" || motocicleta.trim().length < 2 || motocicleta.trim().length > 160 ||
      typeof detalle !== "string" || detalle.trim().length < 5 || detalle.trim().length > 3000) {
    return res.status(400).json({ error: "Revisa tu nombre, celular, moto y descripción del proyecto." });
  }
  if (servicioId && servicioId !== "otro" && !validarUuid(servicioId)) {
    return res.status(400).json({ error: "Selecciona un servicio válido." });
  }
  const servicio = servicioId && servicioId !== "otro"
    ? await pool.query("SELECT id, nombre FROM servicios WHERE id = $1", [servicioId])
    : { rowCount: 0, rows: [] };
  if (servicioId && servicioId !== "otro" && !servicio.rowCount) {
    return res.status(404).json({ error: "El servicio seleccionado ya no existe." });
  }
  const clienteId = req.usuario?.rol === "cliente" ? req.usuario.sub : null;
  const result = await pool.query(
    `INSERT INTO solicitudes_valoracion
       (cliente_id, nombre_cliente, telefono_cliente, motocicleta, servicio_id, nombre_servicio, detalle)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, estado`,
    [clienteId, nombre.trim(), telefono, motocicleta.trim(), servicio.rows[0]?.id || null, servicio.rows[0]?.nombre || "Otro / necesito orientación", detalle.trim()],
  );
  res.status(201).json({ id: result.rows[0].id, estado: result.rows[0].estado });
});

app.get("/api/admin/resumen", exigirRol("administrador"), async (_req, res) => {
  const [citas, valoraciones, servicios] = await Promise.all([
    pool.query(`SELECT
      count(*) FILTER (WHERE estado = 'pendiente')::int AS citas_pendientes,
      count(*) FILTER (WHERE estado IN ('pendiente', 'confirmada') AND inicio >= NOW())::int AS citas_proximas
      FROM citas`),
    pool.query("SELECT count(*)::int AS valoraciones_nuevas FROM solicitudes_valoracion WHERE estado = 'nueva'"),
    pool.query("SELECT count(*)::int AS servicios_activos FROM servicios WHERE activo = TRUE"),
  ]);
  res.json({ ...citas.rows[0], ...valoraciones.rows[0], ...servicios.rows[0] });
});

app.get("/api/admin/citas", exigirRol("administrador"), async (_req, res) => {
  const result = await pool.query(
    `SELECT id, nombre_cliente, telefono_cliente, motocicleta, nombre_servicio,
       duracion_minutos,
       to_char(inicio AT TIME ZONE $1, 'YYYY-MM-DD') AS fecha,
       to_char(inicio AT TIME ZONE $1, 'HH24:MI') AS hora,
       estado, notas
     FROM citas ORDER BY inicio DESC LIMIT 500`,
    [BUSINESS_TIME_ZONE],
  );
  res.json(result.rows);
});

app.get("/api/admin/valoraciones", exigirRol("administrador"), async (_req, res) => {
  const result = await pool.query(
    `SELECT id, nombre_cliente, telefono_cliente, motocicleta, nombre_servicio,
       detalle, estado, creada_en
     FROM solicitudes_valoracion ORDER BY creada_en DESC LIMIT 500`,
  );
  res.json(result.rows);
});

app.patch("/api/admin/citas/:id", exigirRol("administrador"), async (req, res) => {
  const estados = ["pendiente", "confirmada", "completada", "cancelada"];
  if (!validarUuid(req.params.id) || !estados.includes(req.body?.estado)) {
    return res.status(400).json({ error: "El estado de la cita no es válido." });
  }
  const result = await pool.query("UPDATE citas SET estado = $1 WHERE id = $2 RETURNING id, estado", [req.body.estado, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: "No encontramos esa cita." });
  res.json(result.rows[0]);
});

app.patch("/api/admin/valoraciones/:id", exigirRol("administrador"), async (req, res) => {
  const estados = ["nueva", "contactada", "cerrada", "rechazada"];
  if (!validarUuid(req.params.id) || !estados.includes(req.body?.estado)) {
    return res.status(400).json({ error: "El estado de la valoración no es válido." });
  }
  const result = await pool.query(
    "UPDATE solicitudes_valoracion SET estado = $1 WHERE id = $2 RETURNING id, estado",
    [req.body.estado, req.params.id],
  );
  if (!result.rowCount) return res.status(404).json({ error: "No encontramos esa solicitud." });
  res.json(result.rows[0]);
});

app.use("/api", (_req, res) => res.status(404).json({ error: "No encontramos esa ruta de la API." }));
const carpetaDist = fileURLToPath(new URL("../dist", import.meta.url));
if (existsSync(carpetaDist)) {
  app.use(express.static(carpetaDist));
  app.get(/.*/, (req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(resolve(carpetaDist, "index.html"));
  });
}
app.use((error, _req, res, _next) => {
  console.error("Error en la API:", error);
  res.status(500).json({ error: "Ocurrió un problema del servidor. Intenta de nuevo más tarde." });
});

const servidor = app.listen(PORT, () => console.log(`API MotoForma disponible en http://localhost:${PORT}`));

async function apagar() {
  servidor.close();
  await pool?.end();
}

process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
