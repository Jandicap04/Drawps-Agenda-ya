-- DWRAPS: configurar o actualizar la base de datos desde Supabase SQL Editor.
-- La autenticacion pertenece a Supabase Auth; nunca guardamos contrasenas aqui.
-- Es seguro volver a ejecutar este archivo: no elimina las tablas ni sus datos.

CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 2 AND 120),
    telefono TEXT,
    rol TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente', 'administrador')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE CHECK (length(trim(nombre)) BETWEEN 2 AND 100),
    descripcion TEXT NOT NULL DEFAULT '',
    duracion_minutos INTEGER NOT NULL CHECK (
        duracion_minutos BETWEEN 15 AND 1440 AND duracion_minutos % 15 = 0
    ),
    precio_desde NUMERIC(12, 2) CHECK (precio_desde IS NULL OR precio_desde >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.configuracion_sitio (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    color_primario TEXT NOT NULL DEFAULT '#c9fa58'
        CHECK (color_primario ~ '^#[0-9A-Fa-f]{6}$'),
    color_acento TEXT NOT NULL DEFAULT '#a2d83b'
        CHECK (color_acento ~ '^#[0-9A-Fa-f]{6}$'),
    color_fondo_oscuro TEXT NOT NULL DEFAULT '#0d1317'
        CHECK (color_fondo_oscuro ~ '^#[0-9A-Fa-f]{6}$'),
    whatsapp_numero TEXT NOT NULL DEFAULT '573214066140',
    imagen_portada_url TEXT NOT NULL DEFAULT '',
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.configuracion_sitio
    ADD COLUMN IF NOT EXISTS color_primario TEXT NOT NULL DEFAULT '#c9fa58',
    ADD COLUMN IF NOT EXISTS color_acento TEXT NOT NULL DEFAULT '#a2d83b',
    ADD COLUMN IF NOT EXISTS color_fondo_oscuro TEXT NOT NULL DEFAULT '#0d1317',
    ADD COLUMN IF NOT EXISTS whatsapp_numero TEXT NOT NULL DEFAULT '573214066140',
    ADD COLUMN IF NOT EXISTS imagen_portada_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.configuracion_sitio
    ALTER COLUMN whatsapp_numero SET DEFAULT '573214066140';

-- ISO-8601: lunes = 1 y domingo = 7.
CREATE TABLE IF NOT EXISTS public.horarios_atencion (
    dia_semana SMALLINT PRIMARY KEY CHECK (dia_semana BETWEEN 1 AND 7),
    hora_apertura TIME,
    hora_cierre TIME,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (
        (activo AND hora_apertura IS NOT NULL AND hora_cierre IS NOT NULL
            AND hora_apertura < hora_cierre)
        OR NOT activo
    )
);

CREATE TABLE IF NOT EXISTS public.citas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE RESTRICT,
    nombre_cliente TEXT NOT NULL DEFAULT '',
    telefono_cliente TEXT NOT NULL DEFAULT '',
    motocicleta TEXT NOT NULL CHECK (length(trim(motocicleta)) BETWEEN 2 AND 160),
    inicio TIMESTAMPTZ NOT NULL,
    fin TIMESTAMPTZ NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    notas TEXT NOT NULL DEFAULT '',
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fin > inicio),
    CONSTRAINT citas_no_se_traslapan
        EXCLUDE USING gist (tstzrange(inicio, fin, '[)') WITH &&)
        WHERE (estado IN ('pendiente', 'confirmada'))
);

ALTER TABLE public.citas
    ALTER COLUMN cliente_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS nombre_cliente TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS telefono_cliente TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS nombre_servicio TEXT NOT NULL DEFAULT '';

UPDATE public.citas AS c
SET
    nombre_cliente = COALESCE(NULLIF(c.nombre_cliente, ''), p.nombre, 'Cliente'),
    telefono_cliente = COALESCE(NULLIF(c.telefono_cliente, ''), p.telefono, '')
FROM public.perfiles AS p
WHERE p.id = c.cliente_id
  AND (c.nombre_cliente = '' OR c.telefono_cliente = '');

UPDATE public.citas AS c
SET nombre_servicio = s.nombre
FROM public.servicios AS s
WHERE s.id = c.servicio_id
  AND c.nombre_servicio = '';

CREATE TABLE IF NOT EXISTS public.solicitudes_valoracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    nombre_cliente TEXT NOT NULL CHECK (length(trim(nombre_cliente)) BETWEEN 2 AND 120),
    telefono_cliente TEXT NOT NULL,
    motocicleta TEXT NOT NULL CHECK (length(trim(motocicleta)) BETWEEN 2 AND 160),
    servicio_id UUID REFERENCES public.servicios(id) ON DELETE SET NULL,
    nombre_servicio TEXT NOT NULL,
    detalle TEXT NOT NULL CHECK (length(trim(detalle)) BETWEEN 5 AND 3000),
    estado TEXT NOT NULL DEFAULT 'nueva'
        CHECK (estado IN ('nueva', 'contactada', 'cerrada', 'rechazada')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Los archivos en borrador son privados. Solo los publicados se copian al bucket
-- publico y la tabla guarda el consentimiento de publicacion.
CREATE TABLE IF NOT EXISTS public.galeria_forrados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL CHECK (length(trim(titulo)) BETWEEN 2 AND 120),
    descripcion TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 1000),
    tipo_mime TEXT NOT NULL CHECK (tipo_mime IN (
        'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'
    )),
    nombre_archivo TEXT NOT NULL,
    ruta_borrador TEXT,
    ruta_publica TEXT,
    creado_por UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
    estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
    autorizacion_publicacion BOOLEAN NOT NULL DEFAULT FALSE,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imagen_url TEXT NOT NULL DEFAULT '',
    categoria TEXT,
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tipo_rnime TEXT
);

ALTER TABLE public.galeria_forrados
    ADD COLUMN IF NOT EXISTS tipo_mime TEXT,
    ADD COLUMN IF NOT EXISTS nombre_archivo TEXT,
    ADD COLUMN IF NOT EXISTS ruta_borrador TEXT,
    ADD COLUMN IF NOT EXISTS ruta_publica TEXT,
    ADD COLUMN IF NOT EXISTS creado_por UUID,
    ADD COLUMN IF NOT EXISTS estado TEXT,
    ADD COLUMN IF NOT EXISTS autorizacion_publicacion BOOLEAN,
    ADD COLUMN IF NOT EXISTS creada_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actualizada_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS imagen_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS categoria TEXT,
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS tipo_rnime TEXT;

DO $$
DECLARE
    restriccion RECORD;
BEGIN
    FOR restriccion IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.galeria_forrados'::regclass
          AND contype = 'c'
          AND (
              pg_get_constraintdef(oid) ILIKE '%estado%'
              OR pg_get_constraintdef(oid) ILIKE '%autorizacion_publicacion%'
              OR pg_get_constraintdef(oid) ILIKE '%ruta_borrador%'
              OR pg_get_constraintdef(oid) ILIKE '%ruta_publica%'
              OR pg_get_constraintdef(oid) ILIKE '%tipo_mime%'
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE public.galeria_forrados DROP CONSTRAINT %I',
            restriccion.conname
        );
    END LOOP;
END $$;

UPDATE public.galeria_forrados AS g
SET
    tipo_mime = CASE
        WHEN g.tipo_mime IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')
            THEN g.tipo_mime
        WHEN lower(COALESCE(g.imagen_url, '')) ~ '\.(png)(\?.*)?$' THEN 'image/png'
        WHEN lower(COALESCE(g.imagen_url, '')) ~ '\.(webp)(\?.*)?$' THEN 'image/webp'
        WHEN lower(COALESCE(g.imagen_url, '')) ~ '\.(mp4)(\?.*)?$' THEN 'video/mp4'
        WHEN lower(COALESCE(g.imagen_url, '')) ~ '\.(webm)(\?.*)?$' THEN 'video/webm'
        ELSE 'image/jpeg'
    END,
    nombre_archivo = COALESCE(
        NULLIF(g.nombre_archivo, ''),
        NULLIF(substring(g.imagen_url FROM '[^/]+$'), ''),
        'archivo'
    ),
    estado = CASE
        WHEN g.estado IN ('borrador', 'publicada') THEN g.estado
        WHEN g.activo AND NULLIF(g.imagen_url, '') IS NOT NULL THEN 'publicada'
        ELSE 'borrador'
    END,
    autorizacion_publicacion = CASE
        WHEN g.estado = 'publicada' THEN TRUE
        WHEN g.activo AND NULLIF(g.imagen_url, '') IS NOT NULL THEN TRUE
        ELSE FALSE
    END,
    creada_en = COALESCE(g.creada_en, (to_jsonb(g) ->> 'creado_en')::TIMESTAMPTZ, NOW()),
    actualizada_en = COALESCE(g.actualizada_en, (to_jsonb(g) ->> 'actualizado_en')::TIMESTAMPTZ, NOW());

ALTER TABLE public.galeria_forrados
    ALTER COLUMN tipo_mime SET DEFAULT 'image/jpeg',
    ALTER COLUMN nombre_archivo SET DEFAULT 'archivo',
    ALTER COLUMN estado SET DEFAULT 'borrador',
    ALTER COLUMN autorizacion_publicacion SET DEFAULT FALSE,
    ALTER COLUMN imagen_url SET DEFAULT '',
    ALTER COLUMN categoria SET DEFAULT 'general',
    ALTER COLUMN activo SET DEFAULT FALSE,
    ALTER COLUMN orden SET DEFAULT 0,
    ALTER COLUMN creado_en SET DEFAULT NOW(),
    ALTER COLUMN actualizado_en SET DEFAULT NOW(),
    ALTER COLUMN creada_en SET DEFAULT NOW(),
    ALTER COLUMN creada_en SET NOT NULL,
    ALTER COLUMN actualizada_en SET DEFAULT NOW(),
    ALTER COLUMN actualizada_en SET NOT NULL,
    ALTER COLUMN categoria DROP NOT NULL,
    ALTER COLUMN tipo_rnime DROP NOT NULL,
    ALTER COLUMN tipo_mime SET NOT NULL,
    ALTER COLUMN estado SET NOT NULL,
    ALTER COLUMN autorizacion_publicacion SET NOT NULL;

ALTER TABLE public.galeria_forrados
    ADD CONSTRAINT galeria_forrados_estado_consentimiento_check
    CHECK (
        (estado = 'borrador' AND autorizacion_publicacion = FALSE)
        OR (estado = 'publicada' AND autorizacion_publicacion = TRUE)
    ) NOT VALID,
    ADD CONSTRAINT galeria_forrados_tipo_mime_check
    CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'))
    NOT VALID;

CREATE INDEX IF NOT EXISTS citas_cliente_inicio_idx ON public.citas (cliente_id, inicio DESC);
CREATE INDEX IF NOT EXISTS citas_estado_inicio_idx ON public.citas (estado, inicio);
CREATE INDEX IF NOT EXISTS valoraciones_estado_fecha_idx ON public.solicitudes_valoracion (estado, creada_en DESC);
CREATE INDEX IF NOT EXISTS galeria_publicada_fecha_idx ON public.galeria_forrados (creada_en DESC)
    WHERE estado = 'publicada';

CREATE OR REPLACE FUNCTION public.actualizar_fecha_modificacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.actualizada_en = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perfiles_actualizado_en ON public.perfiles;
DROP TRIGGER IF EXISTS servicios_actualizado_en ON public.servicios;
DROP TRIGGER IF EXISTS configuracion_sitio_actualizada_en ON public.configuracion_sitio;
DROP TRIGGER IF EXISTS citas_actualizado_en ON public.citas;
DROP TRIGGER IF EXISTS valoraciones_actualizado_en ON public.solicitudes_valoracion;
DROP TRIGGER IF EXISTS galeria_actualizada_en ON public.galeria_forrados;

CREATE TRIGGER perfiles_actualizado_en BEFORE UPDATE ON public.perfiles
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER servicios_actualizado_en BEFORE UPDATE ON public.servicios
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER configuracion_sitio_actualizada_en BEFORE UPDATE ON public.configuracion_sitio
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER citas_actualizado_en BEFORE UPDATE ON public.citas
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER valoraciones_actualizado_en BEFORE UPDATE ON public.solicitudes_valoracion
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER galeria_actualizada_en BEFORE UPDATE ON public.galeria_forrados
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

CREATE OR REPLACE FUNCTION public.crear_perfil_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.perfiles (id, nombre, telefono)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(trim(NEW.raw_user_meta_data ->> 'nombre'), ''),
            NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
            split_part(COALESCE(NEW.email, NEW.phone, 'Cliente'), '@', 1)
        ),
        NEW.phone
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS al_crear_usuario_supabase ON auth.users;
CREATE TRIGGER al_crear_usuario_supabase
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_usuario();

CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = (SELECT auth.uid()) AND rol = 'administrador'
    );
$$;

REVOKE ALL ON FUNCTION public.es_administrador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_administrador() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_perfil_usuario() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.obtener_disponibilidad(
    p_servicio_id UUID,
    p_fecha DATE,
    p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS TABLE (hora TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_duracion INTEGER;
    v_horario public.horarios_atencion%ROWTYPE;
    v_hoy DATE;
    v_ahora TIME;
    v_inicio TIME;
    v_fin TIME;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_zona_horaria) THEN
        RAISE EXCEPTION 'La zona horaria no es válida.';
    END IF;
    IF p_fecha < (NOW() AT TIME ZONE p_zona_horaria)::DATE THEN
        RETURN;
    END IF;

    SELECT duracion_minutos INTO v_duracion
    FROM public.servicios WHERE id = p_servicio_id AND activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El servicio ya no está disponible.';
    END IF;

    SELECT * INTO v_horario
    FROM public.horarios_atencion
    WHERE dia_semana = EXTRACT(ISODOW FROM p_fecha)::SMALLINT AND activo = TRUE;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_hoy := (NOW() AT TIME ZONE p_zona_horaria)::DATE;
    v_ahora := (NOW() AT TIME ZONE p_zona_horaria)::TIME;
    v_inicio := v_horario.hora_apertura;

    WHILE v_inicio + make_interval(mins => v_duracion) <= v_horario.hora_cierre LOOP
        v_fin := v_inicio + make_interval(mins => v_duracion);
        IF (p_fecha > v_hoy OR v_inicio > v_ahora)
           AND NOT EXISTS (
               SELECT 1
               FROM public.citas c
               WHERE c.estado IN ('pendiente', 'confirmada')
                 AND tstzrange(c.inicio, c.fin, '[)')
                     && tstzrange(
                         (p_fecha + v_inicio) AT TIME ZONE p_zona_horaria,
                         (p_fecha + v_fin) AT TIME ZONE p_zona_horaria,
                         '[)'
                     )
           )
        THEN
            hora := to_char(v_inicio, 'HH24:MI');
            RETURN NEXT;
        END IF;
        v_inicio := v_inicio + INTERVAL '30 minutes';
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_cita(
    p_servicio_id UUID,
    p_fecha DATE,
    p_hora TIME,
    p_motocicleta TEXT,
    p_notas TEXT DEFAULT '',
    p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_usuario UUID := (SELECT auth.uid());
    v_nombre TEXT;
    v_inicio TIMESTAMPTZ;
    v_fin TIMESTAMPTZ;
    v_duracion INTEGER;
    v_cita UUID;
BEGIN
    IF v_usuario IS NULL THEN
        RAISE EXCEPTION 'Inicia sesión con tu cuenta de cliente para reservar.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.perfiles WHERE id = v_usuario AND rol = 'cliente'
    ) THEN
        RAISE EXCEPTION 'Tu perfil no tiene permiso para reservar.';
    END IF;
    IF length(trim(COALESCE(p_motocicleta, ''))) NOT BETWEEN 2 AND 160
       OR length(COALESCE(p_notas, '')) > 2000
    THEN
        RAISE EXCEPTION 'Revisa los datos de la motocicleta y las notas.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.obtener_disponibilidad(p_servicio_id, p_fecha, p_zona_horaria) d
        WHERE d.hora = to_char(p_hora, 'HH24:MI')
    ) THEN
        RAISE EXCEPTION 'Ese horario ya no está disponible.';
    END IF;

    SELECT nombre, duracion_minutos INTO v_nombre, v_duracion
    FROM public.servicios WHERE id = p_servicio_id AND activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El servicio ya no está disponible.';
    END IF;

    v_inicio := (p_fecha + p_hora) AT TIME ZONE p_zona_horaria;
    v_fin := v_inicio + make_interval(mins => v_duracion);
    INSERT INTO public.citas (
        cliente_id, servicio_id, nombre_cliente, telefono_cliente, motocicleta, inicio, fin, notas
    )
    SELECT
        v_usuario, p_servicio_id, p.nombre, COALESCE(p.telefono, ''),
        trim(p_motocicleta), v_inicio, v_fin, COALESCE(trim(p_notas), '')
    FROM public.perfiles p
    WHERE p.id = v_usuario
    RETURNING id INTO v_cita;
    RETURN v_cita;
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_cita(
    p_nombre_cliente TEXT,
    p_telefono_cliente TEXT,
    p_servicio_id UUID,
    p_fecha DATE,
    p_hora TIME,
    p_motocicleta TEXT,
    p_notas TEXT,
    p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inicio TIMESTAMPTZ;
    v_fin TIMESTAMPTZ;
    v_duracion INTEGER;
    v_nombre_servicio TEXT;
    v_cita UUID;
BEGIN
    IF length(trim(COALESCE(p_nombre_cliente, ''))) NOT BETWEEN 2 AND 120
       OR length(regexp_replace(COALESCE(p_telefono_cliente, ''), '\D', '', 'g')) NOT BETWEEN 8 AND 15
       OR length(trim(COALESCE(p_motocicleta, ''))) NOT BETWEEN 2 AND 160
       OR length(COALESCE(p_notas, '')) NOT BETWEEN 5 AND 2000
    THEN
        RAISE EXCEPTION 'Revisa el nombre, celular, moto y descripción del trabajo.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_zona_horaria) THEN
        RAISE EXCEPTION 'La zona horaria no es válida.';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM public.obtener_disponibilidad(p_servicio_id, p_fecha, p_zona_horaria) d
        WHERE d.hora = to_char(p_hora, 'HH24:MI')
    ) THEN
        RAISE EXCEPTION 'Ese horario ya no está disponible. Elige otro.';
    END IF;

    SELECT duracion_minutos, nombre INTO v_duracion, v_nombre_servicio
    FROM public.servicios WHERE id = p_servicio_id AND activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El servicio ya no está disponible.';
    END IF;

    v_inicio := (p_fecha + p_hora) AT TIME ZONE p_zona_horaria;
    v_fin := v_inicio + make_interval(mins => v_duracion);
    BEGIN
        INSERT INTO public.citas (
            servicio_id, nombre_cliente, telefono_cliente, nombre_servicio,
            motocicleta, inicio, fin, notas
        )
        VALUES (
            p_servicio_id, trim(p_nombre_cliente),
            regexp_replace(trim(p_telefono_cliente), '\s', '', 'g'),
            v_nombre_servicio, trim(p_motocicleta), v_inicio, v_fin, trim(p_notas)
        )
        RETURNING id INTO v_cita;
    EXCEPTION WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Ese horario acaba de ser reservado. Elige otro.';
    END;
    RETURN v_cita;
END;
$$;

CREATE OR REPLACE FUNCTION public.reprogramar_cita_admin(
    p_cita_id UUID,
    p_fecha DATE,
    p_hora TIME,
    p_zona_horaria TEXT DEFAULT 'America/Bogota'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cita public.citas%ROWTYPE;
    v_horario public.horarios_atencion%ROWTYPE;
    v_duracion INTEGER;
    v_inicio TIMESTAMPTZ;
    v_fin TIMESTAMPTZ;
BEGIN
    IF NOT (SELECT public.es_administrador()) THEN
        RAISE EXCEPTION 'Solo la persona administradora puede reprogramar citas.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_zona_horaria) THEN
        RAISE EXCEPTION 'La zona horaria no es válida.';
    END IF;

    SELECT * INTO v_cita FROM public.citas WHERE id = p_cita_id FOR UPDATE;
    IF NOT FOUND OR v_cita.estado NOT IN ('pendiente', 'confirmada') THEN
        RAISE EXCEPTION 'No se puede cambiar la fecha de esta cita.';
    END IF;
    SELECT duracion_minutos INTO v_duracion FROM public.servicios WHERE id = v_cita.servicio_id;
    SELECT * INTO v_horario FROM public.horarios_atencion
    WHERE dia_semana = EXTRACT(ISODOW FROM p_fecha)::SMALLINT AND activo = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El taller no atiende ese día.';
    END IF;
    IF p_fecha < (NOW() AT TIME ZONE p_zona_horaria)::DATE
       OR (p_fecha = (NOW() AT TIME ZONE p_zona_horaria)::DATE
           AND p_hora <= (NOW() AT TIME ZONE p_zona_horaria)::TIME)
       OR p_hora < v_horario.hora_apertura
       OR p_hora + make_interval(mins => v_duracion) > v_horario.hora_cierre
       OR mod(EXTRACT(EPOCH FROM (p_hora - v_horario.hora_apertura))::INTEGER, 1800) <> 0
    THEN
        RAISE EXCEPTION 'Elige una hora futura dentro del horario de atención.';
    END IF;

    v_inicio := (p_fecha + p_hora) AT TIME ZONE p_zona_horaria;
    v_fin := v_inicio + make_interval(mins => v_duracion);
    IF EXISTS (
        SELECT 1 FROM public.citas c
        WHERE c.id <> p_cita_id
          AND c.estado IN ('pendiente', 'confirmada')
          AND tstzrange(c.inicio, c.fin, '[)') && tstzrange(v_inicio, v_fin, '[)')
    ) THEN
        RAISE EXCEPTION 'Ese horario ya está ocupado. Elige otro.';
    END IF;

    BEGIN
        UPDATE public.citas SET inicio = v_inicio, fin = v_fin WHERE id = p_cita_id;
    EXCEPTION WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Ese horario acaba de ser ocupado. Elige otro.';
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_disponibilidad(UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_disponibilidad(UUID, DATE, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_cita(UUID, DATE, TIME, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_cita(UUID, DATE, TIME, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.solicitar_cita(TEXT, TEXT, UUID, DATE, TIME, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_cita(TEXT, TEXT, UUID, DATE, TIME, TEXT, TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.reprogramar_cita_admin(UUID, DATE, TIME, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reprogramar_cita_admin(UUID, DATE, TIME, TEXT) TO authenticated;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_sitio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_valoracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galeria_forrados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfiles_ver_propio_o_admin ON public.perfiles;
DROP POLICY IF EXISTS perfiles_editar_propio ON public.perfiles;
DROP POLICY IF EXISTS servicios_publicos_activos ON public.servicios;
DROP POLICY IF EXISTS servicios_admin_editar ON public.servicios;
DROP POLICY IF EXISTS configuracion_sitio_publica ON public.configuracion_sitio;
DROP POLICY IF EXISTS configuracion_sitio_admin_editar ON public.configuracion_sitio;
DROP POLICY IF EXISTS horarios_publicos_ver ON public.horarios_atencion;
DROP POLICY IF EXISTS horarios_admin_editar ON public.horarios_atencion;
DROP POLICY IF EXISTS citas_cliente_ver_propio_admin_ver_todas ON public.citas;
DROP POLICY IF EXISTS citas_cliente_crear ON public.citas;
DROP POLICY IF EXISTS citas_admin_actualizar ON public.citas;
DROP POLICY IF EXISTS valoracion_publico_crear ON public.solicitudes_valoracion;
DROP POLICY IF EXISTS valoracion_admin_ver ON public.solicitudes_valoracion;
DROP POLICY IF EXISTS valoracion_admin_actualizar ON public.solicitudes_valoracion;
DROP POLICY IF EXISTS galeria_publicada_visible ON public.galeria_forrados;
DROP POLICY IF EXISTS galeria_admin_crear ON public.galeria_forrados;
DROP POLICY IF EXISTS galeria_admin_editar ON public.galeria_forrados;
DROP POLICY IF EXISTS galeria_admin_eliminar ON public.galeria_forrados;

CREATE POLICY perfiles_ver_propio_o_admin ON public.perfiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT public.es_administrador()));
CREATE POLICY perfiles_editar_propio ON public.perfiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (
        id = (SELECT auth.uid())
        AND rol = (SELECT p.rol FROM public.perfiles p WHERE p.id = (SELECT auth.uid()))
    );

CREATE POLICY servicios_publicos_activos ON public.servicios
    FOR SELECT TO anon, authenticated USING (activo = TRUE OR (SELECT public.es_administrador()));
CREATE POLICY servicios_admin_editar ON public.servicios
    FOR ALL TO authenticated
    USING ((SELECT public.es_administrador()))
    WITH CHECK ((SELECT public.es_administrador()));
CREATE POLICY configuracion_sitio_publica ON public.configuracion_sitio
    FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY configuracion_sitio_admin_editar ON public.configuracion_sitio
    FOR ALL TO authenticated
    USING ((SELECT public.es_administrador()))
    WITH CHECK ((SELECT public.es_administrador()));

CREATE POLICY horarios_publicos_ver ON public.horarios_atencion
    FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY horarios_admin_editar ON public.horarios_atencion
    FOR ALL TO authenticated
    USING ((SELECT public.es_administrador()))
    WITH CHECK ((SELECT public.es_administrador()));

CREATE POLICY citas_cliente_ver_propio_admin_ver_todas ON public.citas
    FOR SELECT TO authenticated
    USING (cliente_id = (SELECT auth.uid()) OR (SELECT public.es_administrador()));
CREATE POLICY citas_cliente_crear ON public.citas
    FOR INSERT TO authenticated
    WITH CHECK (
        cliente_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.perfiles p
            WHERE p.id = (SELECT auth.uid()) AND p.rol = 'cliente'
        )
    );
CREATE POLICY citas_admin_actualizar ON public.citas
    FOR UPDATE TO authenticated
    USING ((SELECT public.es_administrador()))
    WITH CHECK ((SELECT public.es_administrador()));

CREATE POLICY valoracion_publico_crear ON public.solicitudes_valoracion
    FOR INSERT TO anon, authenticated
    WITH CHECK (cliente_id IS NULL OR cliente_id = (SELECT auth.uid()));
CREATE POLICY valoracion_admin_ver ON public.solicitudes_valoracion
    FOR SELECT TO authenticated USING ((SELECT public.es_administrador()));
CREATE POLICY valoracion_admin_actualizar ON public.solicitudes_valoracion
    FOR UPDATE TO authenticated
    USING ((SELECT public.es_administrador()))
    WITH CHECK ((SELECT public.es_administrador()));

CREATE POLICY galeria_publicada_visible ON public.galeria_forrados
    FOR SELECT TO anon, authenticated
    USING (estado = 'publicada' OR (SELECT public.es_administrador()));
CREATE POLICY galeria_admin_crear ON public.galeria_forrados
    FOR INSERT TO authenticated WITH CHECK (
        (SELECT public.es_administrador())
        AND creado_por = (SELECT auth.uid())
        AND estado = 'borrador'
        AND autorizacion_publicacion = FALSE
    );
CREATE POLICY galeria_admin_editar ON public.galeria_forrados
    FOR UPDATE TO authenticated
    USING ((SELECT public.es_administrador()))
    WITH CHECK (
        (SELECT public.es_administrador())
        AND (
            (estado = 'borrador' AND autorizacion_publicacion = FALSE)
            OR (estado = 'publicada' AND autorizacion_publicacion = TRUE)
        )
    );
CREATE POLICY galeria_admin_eliminar ON public.galeria_forrados
    FOR DELETE TO authenticated USING ((SELECT public.es_administrador()));

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.servicios, public.horarios_atencion TO anon, authenticated;
GRANT SELECT ON public.configuracion_sitio TO anon, authenticated;
GRANT SELECT ON public.perfiles, public.citas, public.solicitudes_valoracion, public.galeria_forrados TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.servicios, public.horarios_atencion TO authenticated;
GRANT INSERT, UPDATE ON public.configuracion_sitio TO authenticated;
GRANT INSERT ON public.citas TO authenticated;
GRANT UPDATE ON public.citas, public.solicitudes_valoracion, public.galeria_forrados TO authenticated;
GRANT INSERT ON public.solicitudes_valoracion TO anon, authenticated;
GRANT INSERT, DELETE ON public.galeria_forrados TO authenticated;
GRANT UPDATE (nombre, telefono) ON public.perfiles TO authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1
           FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = 'citas'
       )
    THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.citas;
    END IF;
END
$$;

INSERT INTO public.horarios_atencion (dia_semana, hora_apertura, hora_cierre, activo) VALUES
    (1, '09:00', '18:00', TRUE),
    (2, '09:00', '18:00', TRUE),
    (3, '09:00', '18:00', TRUE),
    (4, '09:00', '18:00', TRUE),
    (5, '09:00', '18:00', TRUE),
    (6, '10:00', '14:00', TRUE),
    (7, NULL, NULL, FALSE)
ON CONFLICT (dia_semana) DO NOTHING;

INSERT INTO public.servicios (nombre, descripcion, duracion_minutos) VALUES
    ('PPF y wrap para motos', 'Instalación profesional de protección PPF y wrap para motocicletas.', 240),
    ('Pintura y diseño', 'Diseño y pintura personalizada para darle identidad a tu moto.', 240),
    ('Detailing', 'Limpieza y acabado detallado para cuidar cada superficie.', 120),
    ('Restauración', 'Recuperación estética y personalización de motocicletas.', 240),
    ('Calcomanías', 'Diseño e instalación de gráficos y calcomanías personalizadas.', 90)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.configuracion_sitio (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

UPDATE public.configuracion_sitio
SET whatsapp_numero = '573214066140'
WHERE id = 1 AND whatsapp_numero = '';

-- Configurar almacenamiento privado y público para imágenes y videos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
    ('galeria-borradores', 'galeria-borradores', FALSE, 104857600,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
    ('galeria-publica', 'galeria-publica', TRUE, 104857600,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
    ('imagenes-sitio', 'imagenes-sitio', TRUE, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS galeria_publica_leer_archivos ON storage.objects;
DROP POLICY IF EXISTS imagenes_sitio_publicas ON storage.objects;
DROP POLICY IF EXISTS admin_subir_imagenes_sitio ON storage.objects;
DROP POLICY IF EXISTS galeria_admin_cargar_borradores ON storage.objects;
DROP POLICY IF EXISTS galeria_admin_ver_borradores ON storage.objects;
DROP POLICY IF EXISTS galeria_admin_editar_borradores ON storage.objects;
DROP POLICY IF EXISTS galeria_admin_eliminar_borradores ON storage.objects;
DROP POLICY IF EXISTS galeria_admin_publicar_archivos ON storage.objects;
DROP POLICY IF EXISTS galeria_admin_eliminar_publicados ON storage.objects;

CREATE POLICY galeria_publica_leer_archivos ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'galeria-publica');
CREATE POLICY imagenes_sitio_publicas ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'imagenes-sitio');
CREATE POLICY admin_subir_imagenes_sitio ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'imagenes-sitio'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        AND (SELECT public.es_administrador())
    );
CREATE POLICY galeria_admin_cargar_borradores ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'galeria-borradores'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        AND (SELECT public.es_administrador())
    );
CREATE POLICY galeria_admin_ver_borradores ON storage.objects
    FOR SELECT TO authenticated USING (
        bucket_id = 'galeria-borradores' AND (SELECT public.es_administrador())
    );
CREATE POLICY galeria_admin_editar_borradores ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'galeria-borradores' AND (SELECT public.es_administrador()))
    WITH CHECK (
        bucket_id = 'galeria-borradores'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        AND (SELECT public.es_administrador())
    );
CREATE POLICY galeria_admin_eliminar_borradores ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'galeria-borradores' AND (SELECT public.es_administrador())
    );
CREATE POLICY galeria_admin_publicar_archivos ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'galeria-publica'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        AND (SELECT public.es_administrador())
    );
CREATE POLICY galeria_admin_eliminar_publicados ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'galeria-publica' AND (SELECT public.es_administrador())
    );

-- Para otorgar acceso al panel:
-- 1. Crea el usuario en Supabase Authentication (correo y clave segura).
-- 2. Ejecuta esta consulta sustituyendo el correo:
-- UPDATE public.perfiles p SET rol = 'administrador'
-- FROM auth.users u WHERE u.id = p.id AND lower(u.email) = lower('admin@taller.com');
