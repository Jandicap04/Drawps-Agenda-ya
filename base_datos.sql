-- MotoForma: esquema inicial para PostgreSQL.
-- Ejecutar una vez en una base de datos vacía.
-- Las claves de acceso se guardan como hashes seguros creados por el servidor,
-- nunca como texto legible ni directamente desde el navegador.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 2 AND 120),
    telefono TEXT NOT NULL,
    telefono_normalizado TEXT NOT NULL UNIQUE
        CHECK (telefono_normalizado ~ '^\+[1-9][0-9]{6,14}$'),
    clave_hash TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE administradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 2 AND 120),
    correo TEXT NOT NULL,
    clave_hash TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX administradores_correo_sin_distinguir_mayusculas
    ON administradores (lower(trim(correo)));

CREATE TABLE servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE CHECK (length(trim(nombre)) BETWEEN 2 AND 100),
    descripcion TEXT NOT NULL DEFAULT '',
    duracion_minutos INTEGER NOT NULL
        CHECK (duracion_minutos BETWEEN 15 AND 1440 AND duracion_minutos % 15 = 0),
    precio_desde NUMERIC(12, 2) CHECK (precio_desde IS NULL OR precio_desde >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ISO-8601: lunes = 1 y domingo = 7.
CREATE TABLE horarios_atencion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dia_semana SMALLINT NOT NULL UNIQUE CHECK (dia_semana BETWEEN 1 AND 7),
    hora_apertura TIME,
    hora_cierre TIME,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (
        (activo = TRUE AND hora_apertura IS NOT NULL AND hora_cierre IS NOT NULL
            AND hora_apertura < hora_cierre)
        OR
        (activo = FALSE)
    )
);

CREATE TABLE citas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
    -- Copias de los datos al reservar: conservan el detalle aunque se edite
    -- posteriormente el nombre del servicio o el perfil del cliente.
    nombre_cliente TEXT NOT NULL CHECK (length(trim(nombre_cliente)) BETWEEN 2 AND 120),
    telefono_cliente TEXT NOT NULL,
    motocicleta TEXT NOT NULL CHECK (length(trim(motocicleta)) BETWEEN 2 AND 160),
    nombre_servicio TEXT NOT NULL,
    duracion_minutos INTEGER NOT NULL
        CHECK (duracion_minutos BETWEEN 15 AND 1440 AND duracion_minutos % 15 = 0),
    inicio TIMESTAMPTZ NOT NULL,
    fin TIMESTAMPTZ NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    notas TEXT NOT NULL DEFAULT '',
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fin > inicio),
    CHECK (fin = inicio + make_interval(mins => duracion_minutos)),
    CONSTRAINT citas_no_se_traslapan
        EXCLUDE USING gist (tstzrange(inicio, fin, '[)') WITH &&)
        WHERE (estado IN ('pendiente', 'confirmada'))
);

CREATE TABLE solicitudes_valoracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    nombre_cliente TEXT NOT NULL CHECK (length(trim(nombre_cliente)) BETWEEN 2 AND 120),
    telefono_cliente TEXT NOT NULL,
    motocicleta TEXT NOT NULL CHECK (length(trim(motocicleta)) BETWEEN 2 AND 160),
    servicio_id UUID REFERENCES servicios(id) ON DELETE SET NULL,
    nombre_servicio TEXT NOT NULL,
    detalle TEXT NOT NULL CHECK (length(trim(detalle)) BETWEEN 5 AND 3000),
    -- Son rutas/identificadores de archivos guardados en almacenamiento privado;
    -- no se deben guardar imágenes binarias dentro de esta columna.
    archivos_referencia TEXT[] NOT NULL DEFAULT '{}',
    estado TEXT NOT NULL DEFAULT 'nueva'
        CHECK (estado IN ('nueva', 'contactada', 'cerrada', 'rechazada')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX citas_cliente_inicio_idx ON citas (cliente_id, inicio DESC);
CREATE INDEX citas_estado_inicio_idx ON citas (estado, inicio);
CREATE INDEX valoraciones_estado_fecha_idx ON solicitudes_valoracion (estado, creada_en DESC);
CREATE INDEX servicios_activos_nombre_idx ON servicios (nombre) WHERE activo = TRUE;

CREATE FUNCTION actualizar_fecha_modificacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER clientes_actualizado_en
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_modificacion();

CREATE TRIGGER administradores_actualizado_en
    BEFORE UPDATE ON administradores
    FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_modificacion();

CREATE TRIGGER servicios_actualizado_en
    BEFORE UPDATE ON servicios
    FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_modificacion();

CREATE TRIGGER citas_actualizada_en
    BEFORE UPDATE ON citas
    FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_modificacion();

CREATE TRIGGER valoraciones_actualizada_en
    BEFORE UPDATE ON solicitudes_valoracion
    FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_modificacion();

INSERT INTO horarios_atencion (dia_semana, hora_apertura, hora_cierre, activo) VALUES
    (1, '09:00', '18:00', TRUE),
    (2, '09:00', '18:00', TRUE),
    (3, '09:00', '18:00', TRUE),
    (4, '09:00', '18:00', TRUE),
    (5, '09:00', '18:00', TRUE),
    (6, '10:00', '14:00', TRUE),
    (7, NULL, NULL, FALSE);

INSERT INTO servicios (nombre, descripcion, duracion_minutos, precio_desde) VALUES
    ('Forrado completo', 'Un cambio total de color y personalidad para tu moto.', 240, NULL),
    ('Detalles personalizados', 'Acentos, gráficos y detalles que hacen la diferencia.', 90, NULL),
    ('Protección y acabado', 'Protege las zonas más expuestas con un acabado impecable.', 120, NULL);

-- Para crear el primer administrador, el servidor debe generar un hash de clave
-- con Argon2id o bcrypt y luego insertar ese hash. No uses una clave de ejemplo.
