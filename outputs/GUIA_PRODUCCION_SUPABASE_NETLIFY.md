# Despliegue real gratuito: Supabase + URL publica

Esta version no necesita servidor propio. La app es estatica y se conecta a Supabase para login, base de datos y persistencia.

## 1. Crear proyecto en Supabase

1. Entrar a `https://supabase.com`.
2. Crear una cuenta gratuita.
3. Crear un nuevo proyecto.
4. Ir a `SQL Editor`.
5. Copiar y ejecutar el archivo:

`outputs\SUPABASE_SCHEMA.sql`

## 2. Crear usuarios con correo y contrasena

1. En Supabase, abrir `Authentication`.
2. Ir a `Users`.
3. Crear los usuarios que usaran la app.
4. No se necesita pantalla de registro publica; el administrador controla los accesos desde Supabase.

Recomendado: en `Authentication > Providers > Email`, desactivar registro publico si la clinica no quiere que cualquiera cree cuenta.

## 3. Copiar credenciales publicas de Supabase

1. En Supabase, abrir `Project Settings`.
2. Ir a `API`.
3. Copiar:
   - Project URL.
   - anon public key.
4. Editar:

`app\static\supabase-config.js`

Debe quedar asi:

```js
window.BIOMED_SUPABASE = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU_ANON_PUBLIC_KEY"
};
```

No usar la `service_role key` en el frontend.

## 4. Desplegar gratis con Netlify

Opcion sencilla para usuario no tecnico:

1. Entrar a `https://app.netlify.com/drop`.
2. Arrastrar la carpeta:

`app\static`

3. Netlify generara una URL publica tipo:

`https://nombre-del-sitio.netlify.app`

4. En Netlify, cambiar el nombre del sitio si se desea.

## 5. Configurar URL en Supabase

En Supabase:

1. Abrir `Authentication`.
2. Ir a `URL Configuration`.
3. En `Site URL`, poner la URL de Netlify.
4. En `Redirect URLs`, agregar la misma URL.

## 6. Uso diario

Los usuarios entran a la URL publica, escriben correo y contrasena, y trabajan directo sobre Supabase.

La base de datos vive en Supabase. Ya no se usa SQLite ni un computador servidor.

## 7. Seguridad incluida

- Login con Supabase Auth.
- Tablas protegidas con Row Level Security.
- Solo usuarios autenticados pueden leer, crear, actualizar o eliminar registros.
- La `anon public key` es segura para frontend siempre que RLS este activo.

## 8. Importante sobre gratuidad

Supabase y Netlify ofrecen planes gratuitos, suficientes para una primera puesta en produccion pequena. Si la clinica crece en usuarios, almacenamiento o trafico, puede requerir pasar a un plan pago.
