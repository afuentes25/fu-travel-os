# Análisis visual y estructural de `single.html`

## Fuente inspeccionada

- HTML: `reference-themes/lavella-extracted/HTML/single.html`
- CSS agregado por el HTML: `css/styles.css`
- Hoja específica localizada en la distribución: `css/single.css`
- Fuente: Roboto 300, 400, 500, 700 y 900.

`styles.css` agrupa los estilos publicados del template. `single.css` permite
aislar las reglas del detalle y sus breakpoints.

## Dependencias declaradas

| Recurso | Uso en el original | Decisión en Fu Travel OS |
| --- | --- | --- |
| `jquery.min.js` | DOM y eventos | No cargar; React |
| `jquery-ui.min.js` | controles auxiliares | No cargar; controles nativos |
| `slick.min.js` | galería horizontal | Scroll snap y estado React |
| `jquery.arcticmodal.min.js` | reserva modal | Dialog/bottom sheet React |
| `lightgallery.js` | galería ampliada | Lightbox React accesible |
| `spincrement.min.js` | contadores | No requerido |
| `scripts.min.js` | inicialización global | No cargar |
| Google Maps API | mapa embebido | Representación demo existente |

## Estructura original detectada

1. Header transparente de dos niveles sobre una imagen de fondo.
2. Breadcrumb dentro de la fotografía.
3. Bloque `content-head` que comienza aproximadamente a 300 px en 1440 px.
4. Rating, título de 40 px, ubicación y CTA sobre la imagen.
5. Carrusel horizontal con tarjetas de 403 × 370 px y gap de 48 px.
6. Descripción en una columna de 850 px y bloque secundario de 403 px.
7. Cuerpo blanco con columna principal de 850 px y sidebar de 403 px.
8. Programa con filas de 90 px, icono circular, número/título y control circular.
9. Incluidos en dos columnas con divisores.
10. Sidebar sticky con cabecera fotográfica y base blanca.
11. Tours relacionados y footer negro.

En el breakpoint de 1400 px la pareja principal pasa a 785/370 px. Por debajo
de 1000 px las columnas se apilan, el carrusel se vuelve desplazable y la
reserva pasa a un control móvil.

## Recursos gráficos relevantes

- `geo-white.svg`: ubicación sobre hero.
- `time.svg`: duración.
- `star-active.svg` y `star.svg`: rating.
- `day-plus.svg` y `minus.svg`: acordeón de programa.
- `check-white.svg`: incluidos.
- `calendar.svg`: fecha del sidebar.
- `slick-arrow.svg`: navegación del carrusel.

La reconstrucción usa los SVG ya auditados cuando son necesarios y recrea con
CSS/React los controles cuya importación directa no aporta valor o requiere
scripts antiguos.

## Diferencias de la implementación anterior

- Hero de 720 px con título de hasta 72 px; el original usa fondo de 550–660 px
  y título de aproximadamente 40 px.
- Galería rígida de tres columnas; el original es un carrusel horizontal que
  desborda el contenedor.
- Introducción y cuerpo no respetaban las relaciones 850/403 y 785/370.
- El panel era una superficie oscura continua; el original combina cabecera
  fotográfica y base blanca.
- El itinerario se presentaba como acordeones genéricos; faltaban las filas de
  90 px, los marcadores circulares y la jerarquía número/título.
- Un `overflow: clip` en el ancestro principal impedía el sticky real del
  sidebar.

## Adaptación implementada

- Hero con media configurable, breadcrumb y proporciones de `single.html`.
- Galería horizontal con scroll snap, flechas, contador y lightbox accesible.
- Introducción 850/403 y cuerpo 785/370 en desktop.
- Navegación modular sticky generada por `pageConfiguration.sections`.
- Sidebar sticky sin ancestros que rompan `position: sticky`.
- Programa Lavella con controles React, metadatos e imágenes configurables.
- Reserva Lavella independiente con cálculos, capacidad, ocupación, impuestos,
  anticipo, carrito, WhatsApp, barra móvil y bottom sheet compartiendo únicamente
  utilidades de negocio.

## Responsive

Breakpoints revisados en el CSS original: 1600, 1440, 1400, 1230, 1076, 1000,
760, 686, 610, 430 y 358 px. La implementación conserva los cambios
estructurales principales en 1230, 1000, 760 y 430 px.

La herramienta de navegador integrada de esta ejecución usa un viewport fijo
de 1280 × 720 y no permite cambiarlo. No se creó una captura móvil falsa; la
revisión móvil se realizó mediante DOM, CSS, breakpoints, áreas táctiles,
scroll horizontal, safe areas y comportamiento del bottom sheet.
