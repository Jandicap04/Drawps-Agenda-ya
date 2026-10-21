# DWRAPS: agenda para personalizar motos

Aplicación en **React + Vite** conectada directamente con **Supabase**. Supabase administra las cuentas, citas, servicios, horarios y galería; los archivos se guardan en Supabase Storage.

## Preparar la aplicación

Necesitas Node.js 20 o superior.

1. En Supabase, abre **SQL Editor**, pega el contenido de `base_datos.sql` y pulsa **Run**. El script crea las tablas, funciones, permisos y buckets que necesita la aplicación. También completa las columnas que faltan en la tabla existente `galeria_forrados` y conserva sus filas.
2. Copia `.env.example` como `.env.local`. Confirma que la URL y la clave publicable correspondan a tu proyecto Supabase.
3. En la terminal, dentro de esta carpeta, ejecuta:

   ```bash
   npm install
   npm run dev
   ```

4. Abre la dirección local que muestra Vite.

El SQL se puede ejecutar de nuevo si necesitas aplicar una actualización: no elimina las tablas ni sus datos. La clave publicable puede estar en el frontend. **No uses ni publiques una clave `service_role`.**

## Crear la cuenta administradora

1. En **Supabase → Authentication → Users**, crea el usuario con correo y contraseña.
2. Abre **SQL Editor**, cambia `CORREO_DEL_ADMIN` por el correo real y ejecuta:

   ```sql
   UPDATE public.perfiles AS p
   SET rol = 'administrador'
   FROM auth.users AS u
   WHERE p.id = u.id
     AND lower(u.email) = lower('CORREO_DEL_ADMIN');
   ```

3. Entra al sitio y usa **Acceso administrador**, al final de la página.

Las cuentas de clientes usan celular y clave. Para registrar y verificar clientes, habilita un proveedor SMS en **Supabase → Authentication**.

## Configurar WhatsApp del taller

1. Ingresa al sitio con la cuenta administradora.
2. Abre **Administración → Diseño de página**.
3. En **WhatsApp del taller**, escribe el código de país y el número, solo con dígitos. Para Colombia, escribe `57` seguido del número celular, por ejemplo `573001234567`.
4. Pulsa **Guardar diseño y WhatsApp**. El número inicial ya queda configurado como `573214066140`; puedes cambiarlo desde este mismo campo si el taller usa otro.

Las cotizaciones abren WhatsApp con los datos del proyecto listos para enviar y también se guardan en el panel cuando Supabase está disponible. El enlace de WhatsApp aparece además en el pie de página y como botón flotante.

## Lo que se puede administrar

- **Servicios y precios:** crear servicios, editar precios, descripción y duración, o esconder servicios sin borrar su historial.
- **Diseño de página:** cambiar los colores, subir una imagen de portada y configurar el WhatsApp del taller. `MODELO 2.png` es la imagen inicial.
- **Galería:** subir fotos o videos desde computadora o celular. Cada archivo queda privado como borrador hasta marcar la autorización para publicarlo.
- La portada también muestra los modelos de moto disponibles en la carpeta del proyecto al final de **Hechos para rodar**.
- **Citas y cotizaciones:** revisar las solicitudes y actualizar sus estados.

La galería acepta JPG, PNG, WebP, MP4 y WebM de hasta 100 MB por archivo. La base de datos conserva las imágenes antiguas de `galeria_forrados`; si una fila existente tiene `imagen_url`, el sitio la muestra como contenido publicado sin obligarte a volver a cargar el archivo.

## Publicar el sitio

1. Ejecuta `npm run build`. Vite crea el sitio listo para producción en `dist`.
2. Publica el proyecto en un hosting estático como Vercel o Netlify.
3. Añade en el hosting las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, y despliega otra vez.
4. En **Supabase → Authentication → URL Configuration**, configura la dirección pública del sitio como URL de redirección permitida.

`base_datos.sql` también carga horarios de ejemplo y servicios iniciales. Después de ejecutarlo, revisa y ajusta estos datos para que coincidan con el horario y los servicios reales del taller.
