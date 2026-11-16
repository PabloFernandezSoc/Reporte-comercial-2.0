# Reporte comercial 2.0 · LYD Cargo

Aplicación de estrategia comercial: pasa del reporte HTML a un sistema que **detecta cuándo un cliente cae fuera de su comportamiento normal**, genera alertas priorizadas y permite **accionar** (correo, recordatorio, bitácora de gestión).

## Qué hace

| Vista | Para qué sirve |
|---|---|
| **Resumen** | KPIs con tendencia, venta vs meta, acumulado del año con proyección de cierre, puente de variación (qué clientes explican la subida o bajada), mapa de salud de clientes, segmentos y etapas. |
| **Alertas** | Lista de trabajo priorizada: fuga, caída anómala, tendencia a la baja, brecha a meta, erosión de margen, clientes nuevos y crecimientos. Cada alerta trae diagnóstico, evidencia (qué mandante explica la caída), acción sugerida, correo con plantilla, recordatorio `.ics` y bitácora. También muestra las caídas **descartadas** por ser fluctuación normal. |
| **Clientes** | Cartera con estado de salud, tendencia de 12 meses, cumplimiento y margen. |
| **Ficha de cliente** | Historia con **banda de normalidad**, año contra año, servicios vs ticket, mandantes vs su normal, etapas, alertas y contacto. |
| **Cartera** | Matriz venta × margen, Pareto y riesgo de concentración (HHI). |
| **Metas** | Editor del plan general, por segmento y por cliente; importación/exportación JSON y cruce de nombres ERP ↔ scorecard. |
| **Configuración** | Umbrales de alerta, correos de ejecutivas y jefatura, firma, mapeo de campos detectado y exportaciones. |

## Cómo se detecta una caída que no es fluctuación normal

Para cada cliente y mes (`src/lib/anomaly.ts`):

1. **Esperado** = mediana de sus últimos 6 meses (desestacionalizada) × índice estacional de la empresa, ajustado con el mismo mes del año anterior del cliente cuando existe.
2. **Variación habitual (σ)** = dispersión robusta (MAD) de sus desvíos históricos contra lo esperado. Un cliente volátil tiene una banda más ancha.
3. **z** = desvío del mes / σ. Banda normal 90 % = esperado × e^(±1,645σ).
4. Diagnóstico:
   - **Caída anómala**: z ≤ −2, cae ≥ 20 % y la brecha supera el monto mínimo.
   - **Tendencia a la baja**: 3+ meses seguidos bajo lo normal, o nivel de los últimos 3 meses claramente bajo los 9 anteriores.
   - **Fuga**: sin venta en un cliente que casi nunca tiene meses en cero.
   - Clientes esporádicos (proyectos/CAPEX) con meses en cero no generan fuga.
5. La caída se descompone por **mandante** para indicar dónde gestionar.

Todos los umbrales se ajustan en **Configuración**. Se analiza el último mes cerrado (el mes en curso se muestra aparte como avance).

## Puesta en marcha

Requisitos: Node 20+.

```bash
npm install
cp .env.example .env.local   # completar ERP_API_KEY
npm run dev                  # http://localhost:3000
```

Sin `ERP_API_KEY` la app funciona con **datos DEMO ficticios** (útil para probar y para mostrar).

### Conexión a Bit ERP

La consulta al ERP se hace **desde el servidor** (`src/app/api/datos/route.ts`): la API key nunca llega al navegador y desaparece el problema de CORS del HTML. Variables en `.env.local`:

- `ERP_URL`, `ERP_API_KEY`, `ERP_DESDE`, `ERP_HASTA` (para detectar fluctuaciones conviene 24+ meses de historia).
- `ERP_INSECURE_TLS=1` solo si el certificado del ERP no es válido para Node.
- `ERP_FIELD_MAP` para corregir el mapeo automático de columnas, por ejemplo `{"cliente":"NombreCliente"}`.

### Metas

Las metas reales **no se suben al repositorio** (es público). Opciones:

- Archivo `data/private/metas.json` (ignorado por git) o la ruta de `METAS_PATH`.
- Variable `METAS_JSON` con el contenido (útil en Vercel).
- Importar el JSON desde la pestaña **Metas** (queda guardado en el navegador).

Formato: ver `src/lib/types.ts` (`Metas`).

### Correo

Sin configuración, **Enviar correo** abre Outlook/Gmail con el borrador listo. Para envío directo define `RESEND_API_KEY` y `EMAIL_FROM` ([Resend](https://resend.com)).

## Despliegue

Compatible con Vercel: importar el repo y definir las variables de entorno. `npm run build` para verificar.

## Desarrollo

```bash
npm test          # pruebas del detector y del normalizador
npm run typecheck
```

Estructura:

```
src/lib/normalize.ts   lectura de la respuesta del ERP (alias de campos, flete/extracosto, estados → etapas)
src/lib/anomaly.ts     detector de fluctuaciones
src/lib/analytics.ts   agregaciones, metas, alertas, proyección
src/lib/demo.ts        datos ficticios con escenarios sembrados
src/app/*              vistas
```

## Pendiente / próximos pasos

- Persistir gestión de alertas, metas y contactos en una base compartida (hoy viven en el navegador de cada usuario).
- Portar el módulo de **Atrasos/incidencias** del reporte HTML.
- Envío automático de un resumen semanal de alertas a cada ejecutiva.
