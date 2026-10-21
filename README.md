# MotoForma: agenda para personalizar motos

Proyecto inicial en **React + Vite** con una API **Node.js/Express** y un
esquema **PostgreSQL**. El navegador habla con la API; la API es la única parte
que accede a la base de datos.

## Ejecutar en tu computadora

Requisitos: Node.js 20 o superior y PostgreSQL 13 o superior.

1. Abre una terminal en la carpeta del proyecto.
2. Instala las dependencias con `npm install`.
3. Crea una base de datos llamada `motoforma` y ejecuta `base_datos.sql`.
4. Copia `.env.example` a `.env` y completa:
   - `DATABASE_URL`: la dirección de tu PostgreSQL.
   - `JWT_SECRET`: un secreto aleatorio largo, de al menos 32 caracteres.
   - `BUSINESS_TIME_ZONE`: zona horaria del taller, por ejemplo `America/Mexico_City`.
   - `COOKIE_SECURE=false` para desarrollo local. Usa `true` detrás de HTTPS.
5. Ejecuta `npm run dev` y abre la dirección que indique Vite.

El esquema trae ejemplos de servicios y horarios. Las claves de clientes y
administradores se guardan como hashes, no en texto legible. Para crear el
primer administrador, añade temporalmente `ADMIN_NAME`, `ADMIN_EMAIL` y
`ADMIN_PASSWORD` a `.env`, usa una clave única de al menos 12 caracteres y
ejecuta `npm run admin:create`. Luego elimina `ADMIN_PASSWORD` del archivo.

## Qué incluye

- Portada adaptable a computadora y celular, basada en la referencia visual.
- Calendario interno con horarios consultados a PostgreSQL.
- Registro e ingreso de clientes por celular y clave.
- Solicitud de valoración del proyecto.
- Ingreso separado de administrador y panel de citas/solicitudes.
- Restricción de base de datos para impedir citas que se traslapen.

Si falta `.env` o PostgreSQL no está conectado, la interfaz muestra un aviso y
desactiva las reservas; no guarda citas ficticias.

## Preparar para publicar

1. Sube el proyecto a un repositorio privado o al repositorio de tu equipo.
2. Elige un hosting que permita ejecutar Node.js y otro servicio PostgreSQL.
3. En el hosting, crea las variables de entorno indicadas arriba; no subas `.env`.
4. Ejecuta `npm run build` para crear la carpeta `dist`.
5. Configura HTTPS y `COOKIE_SECURE=true`.
6. Apunta tu dominio al hosting cuando tengas el dominio.

No compartas contraseñas de hosting, dominio ni base de datos por el chat.
Si quieres ayuda para publicar, basta con decir qué proveedor usarás; puedes
configurar los secretos directamente en su panel siguiendo estas instrucciones.
