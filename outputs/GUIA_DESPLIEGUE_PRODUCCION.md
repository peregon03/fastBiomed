# Guia de despliegue en produccion

Proyecto:

`C:\Users\Usuario\Documents\Codex\2026-06-16\desarrolla-un-sistema-web-de-gesti`

## Entrega recomendada

Entregue la carpeta completa del proyecto al equipo donde funcionara el sistema. No entregue solo los archivos del dashboard, porque la aplicacion tambien necesita el servidor y la base de datos SQLite.

## Primer uso en el equipo del usuario

1. Instalar Python 3 desde `https://www.python.org/downloads/`.
2. Durante la instalacion, marcar `Add python.exe to PATH`.
3. Abrir la carpeta del proyecto.
4. Ejecutar doble clic en `despliegue\instalar_dependencias.bat`.
5. Ejecutar doble clic en `despliegue\iniciar_produccion.bat`.
6. El sistema abrira el navegador automaticamente.

## Acceso desde otros computadores

Cuando se ejecuta `iniciar_produccion.bat`, la ventana muestra una direccion como:

`http://192.168.1.20:8000`

Los otros usuarios deben abrir esa direccion desde equipos conectados a la misma red.

Si Windows muestra una alerta de firewall, permitir acceso en redes privadas o de confianza.

## Base de datos de produccion

La base de datos real queda en:

`app\data\produccion\biomed.db`

Esta base inicia vacia, sin equipos de prueba.

## Copias de seguridad

Para hacer backup, ejecutar doble clic en `despliegue\crear_backup.bat`.

Los respaldos quedan en:

`backups`

Recomendacion: crear un backup al final de cada jornada o antes de importar grandes archivos.

## Operacion diaria

1. Encender el computador servidor.
2. Ejecutar `despliegue\iniciar_produccion.bat`.
3. Mantener abierta esa ventana mientras el sistema este en uso.
4. Al terminar, cerrar con `Ctrl + C`.

## Nota de seguridad

Este despliegue esta preparado para red local interna. Para publicarlo en internet se debe agregar dominio, HTTPS, autenticacion formal y reglas de firewall/reverse proxy.
