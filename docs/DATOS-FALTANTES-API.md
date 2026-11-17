# Datos que faltan en la API de Bit ERP

Endpoint: `POST /api/misservicios/reporte/prod-general` (y `/reporte/incidencia`).
Este documento lista lo que la app necesita y la API **no entrega hoy**, cómo se está supliendo mientras tanto y qué pedir al proveedor del ERP. Revisado con datos reales en noviembre de 2026 (las cifras concretas se ven en la app, no aquí: el repositorio es público).

## Resumen

| # | Dato faltante | Impacto | Cómo se suple hoy | Pedido al ERP |
|---|---|---|---|---|
| 1 | **Cartera / segmento del cliente** (FFWW o Cliente Directo) | Metas por cartera, gráficos por segmento | Hojas del Excel de metas Q4; si el cliente no aparece, regla provisoria por nombre | Campo `cartera` (o `segmento`) en el maestro de clientes |
| 2 | **Ejecutiva comercial** | Filtro por ejecutiva, asignación y correo de alertas | Columna Ejecutiva del Excel de metas (solo cartera CD) | Campo `ejecutivaComercial` por cliente o por servicio |
| 3 | **Fecha de presentación en servicios ALMACENADO** | Decenas de servicios quedan fuera de la venta del mes | Se excluyen y se listan en Configuración → Datos para corregir | Completar `fechaPresen` y `periodo` al pasar a ALMACENADO |
| 4 | **Período válido** | Algunas filas traen `periodo: 0` o fechas de relleno (`2000-01-01`, `1900-01-01`) | Se usa la fecha de presentación; si tampoco hay, se excluye | No usar fechas de relleno; enviar `null` |
| 5 | **Metas** (plan de ventas, metas por cliente, Q4) | Cumplimiento | Archivo privado `data/private/metas.json` importado desde Excel (`npm run metas:q4`) | Ideal: tabla de metas en el ERP o en una base compartida |
| 6 | **Calificación del cliente** (Activo, Spot, Churn, Inactivo…) | Lectura de alertas y prioridades | Columna Calificación del Excel de metas (solo CD) | Campo `calificacion` en el maestro de clientes |
| 7 | **Contacto del cliente** (nombre, correo) | Correos de seguimiento | Se ingresa a mano en la ficha del cliente (queda en el navegador) | Contacto comercial en el maestro de clientes |
| 8 | **Costo en servicios no ejecutados** | Margen del mes en curso | Filas en coordinación traen `costo: 0`; el margen del mes en curso es parcial | Costo estimado o marca de "costo pendiente" |
| 9 | **Significado de `unegocio` (CA / CB)** | — | No se usa (no corresponde a FFWW / CD) | Documentar el campo |
| 10 | **Filas sin estado** | Filas sin venta | Se ignoran (venta $0) | Revisar origen |

## Detalle

### 1. Cartera FFWW / Cliente Directo
La API no informa a qué cartera pertenece el cliente. La app la determina en este orden:

1. Hoja **CARTERA CD** del Excel de metas → CD.
2. Hoja **Cartera FFWW** → FFWW (incluye FFWW/SPOT y FFWW/CHURN).
3. Hoja **CARTERA TOTAL** → su columna Segmento.
4. Segmento del Growth Scorecard original, si es FFWW o CD.
5. **Provisorio por nombre**: logística, cargo, forwarding, shipping, line, etc. → FFWW; el resto → CD. Se marca "segmento provisorio" en la ficha del cliente.

Los clientes CAPEX y CHURN del scorecard original pasan a FFWW o CD según estas reglas; su estado de churn queda en la calificación.
Se puede forzar un cliente a una fila del plan en **Metas → Cruce de nombres**.

### 3 y 4. Fechas
- La fecha del servicio es `fechaPresen`; el mes es `periodo` (formato `AAAAMM`).
- Sin fecha es **aceptable** en `PROYECCION DE CARGA` y `EN COORDINACION` (aún no se agendan) y en `ANULADO` (no cuenta).
- Sin fecha en estados en curso (hoy: `ALMACENADO`) **es un error de datos**: la app los lista con ServicioID, cliente, venta y otra fecha de referencia (retiro / ingreso a planta / ETA), exportable a CSV.

### Estados (tabla de Bit)
Según la columna "Se considera en curso":

| Etapa en la app | Estados |
|---|---|
| Programado (no es venta realizada) | PROYECCION DE CARGA, EN COORDINACION, y cualquier servicio con fecha de presentación posterior a hoy |
| En curso | EN CURSO, ALMACENADO, PROGRAMADO y los pasos operativos de cada tipo (retiro, ruta, presentación, atención, etc.) |
| Finalizado | SERVICIO FINALIZADO, VALIDACION COSTUMER SERVICE, VALIDADO |
| Excluido | ANULADO |

**Venta realizada = En curso + Finalizado.** Lo programado se muestra aparte.

### Meta total
En noviembre, la meta total de la hoja de KRs no es igual a la suma de las metas FFWW + CD de esa misma hoja (que sí coincide con el "Total carteras" del Excel Q4). La app usa la suma de carteras; si la meta oficial es otra, se edita en **Metas → General**.
