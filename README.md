# Sistema web de gestion biomedica

Aplicacion web para gestion y seguimiento de mantenimientos preventivos de equipos biomedicos.

## Produccion recomendada

La version de produccion esta preparada para:

- Supabase Auth para login con correo y contrasena.
- Supabase Postgres como base de datos.
- Row Level Security para proteger datos.
- Hosting estatico gratuito en Netlify o Vercel.
- URL publica tipo `https://nombre-del-sitio.netlify.app`.

Guia principal:

```text
outputs\GUIA_PRODUCCION_SUPABASE_NETLIFY.md
```

SQL para Supabase:

```text
outputs\SUPABASE_SCHEMA.sql
```

Configuracion de Supabase en frontend:

```text
app\static\supabase-config.js
```

## Despliegue rapido con Netlify

1. Crear proyecto en Supabase.
2. Ejecutar `outputs\SUPABASE_SCHEMA.sql` en SQL Editor.
3. Crear usuarios en Supabase Auth.
4. En Netlify, configurar variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
5. Conectar el repositorio GitHub con Netlify.
6. Configurar la URL publica en Supabase Auth URL Configuration.

## Desarrollo local opcional

La carpeta `app\static` puede abrirse con un servidor estatico. El servidor Python/SQLite anterior queda solo como apoyo local, pero no es requerido para produccion con Supabase.
