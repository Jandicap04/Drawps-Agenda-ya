import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const nombre = String(process.env.ADMIN_NAME || "").trim();
const correo = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const clave = process.env.ADMIN_PASSWORD || "";

if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL en .env.");
if (nombre.length < 2 || nombre.length > 120) throw new Error("Configura ADMIN_NAME con el nombre del administrador.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error("Configura ADMIN_EMAIL con un correo válido.");
if (clave.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const hash = await bcrypt.hash(clave, 12);
  await pool.query(
    "INSERT INTO administradores (nombre, correo, clave_hash) VALUES ($1, $2, $3)",
    [nombre, correo, hash],
  );
  console.log(`Administrador creado: ${correo}`);
} catch (error) {
  if (error.code === "23505") {
    console.error("Ya existe un administrador con ese correo. No se cambió su clave.");
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await pool.end();
}
