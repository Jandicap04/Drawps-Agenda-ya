async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });
  const result = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(result?.error || `La solicitud falló (${response.status}).`);
  }

  return result;
}

export const api = {
  estado: () => request("/estado"),
  servicios: () => request("/servicios"),
  disponibilidad: (servicioId, fecha) =>
    request(`/disponibilidad?servicioId=${encodeURIComponent(servicioId)}&fecha=${encodeURIComponent(fecha)}`),
  registrarCliente: (datos) =>
    request("/auth/clientes/registro", { method: "POST", body: JSON.stringify(datos) }),
  ingresarCliente: (datos) =>
    request("/auth/clientes/ingreso", { method: "POST", body: JSON.stringify(datos) }),
  ingresarAdmin: (datos) =>
    request("/auth/administradores/ingreso", { method: "POST", body: JSON.stringify(datos) }),
  salir: () => request("/auth/salir", { method: "POST" }),
  crearCita: (datos) => request("/citas", { method: "POST", body: JSON.stringify(datos) }),
  crearValoracion: (datos) =>
    request("/valoraciones", { method: "POST", body: JSON.stringify(datos) }),
  resumenAdmin: () => request("/admin/resumen"),
  citasAdmin: () => request("/admin/citas"),
  valoracionesAdmin: () => request("/admin/valoraciones"),
  cambiarEstadoCita: (id, estado) =>
    request(`/admin/citas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    }),
  cambiarEstadoValoracion: (id, estado) =>
    request(`/admin/valoraciones/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    }),
};
