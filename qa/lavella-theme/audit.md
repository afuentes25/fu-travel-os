# Auditoría técnica del tema Lavella

Fecha de inspección: 26 de julio de 2026  
Fuente autorizada: `reference-themes/lavella.zip`  
Extracción local ignorada por Git: `reference-themes/lavella-extracted`

## Resultado ejecutivo

El paquete contiene una plantilla HTML multipágina basada en Roboto, jQuery y varios plugins de interfaz. Fu Travel OS no incorpora su HTML, CSS global ni JavaScript. La integración reutiliza la jerarquía visual, las proporciones y el ritmo del producto mediante componentes React, estilos aislados y la lógica comercial existente.

El ZIP no contiene un archivo independiente de licencia, README o atribución. La compra fue confirmada por el propietario, pero el paquete por sí mismo no acredita derechos de redistribución de fotografías de demostración. Por eso no se copian imágenes demo, fuentes, plugins ni documentación al sitio público. Se usan imágenes ya autorizadas en Fu Travel OS, `next/image`, la fuente Roboto de `next/font` y los iconos React ya instalados.

## Estructura encontrada

- 18 páginas HTML.
- 13 hojas de estilo principales o de plugins.
- 18 archivos JavaScript, incluidos archivos minificados.
- 114 imágenes JPG, 79 SVG y 6 PNG.
- No hay fuentes locales WOFF/TTF/OTF.
- No hay licencia, README ni documentación separada.
- Hay metadatos de macOS bajo `__MACOSX`, sin utilidad para producción.

## Páginas e inventario funcional

| Archivo Lavella | Uso visual en Fu Travel OS | Acción |
| --- | --- | --- |
| `index.html` | Home, hero, buscador, destacados, destinos | Adaptar como componentes React |
| `tour-list.html` y variantes | Catálogo y cards | Reinterpretar con filtros compartidos |
| `single.html` | Detalle claro y estructura editorial | Adaptar |
| `single-dark.html` | Hero oscuro y panel comercial | Reinterpretar parcialmente |
| `destinations.html` | Destinos destacados | Adaptar |
| `search-results*.html` | Estados de resultados | Sustituir por catálogo compartido |
| `gallery.html` | Composición de galería | Reinterpretar |
| `contacts.html` | Contacto y footer | Reinterpretar |
| `about.html` | Bloque editorial | Reinterpretar |
| `blog-*.html` | Ritmo editorial | Solo referencia visual |
| `404.html`, `coming-soon.html` | Estados auxiliares | Ignorar en esta fase |

## Sistema visual detectado

- Fuente: Roboto mediante Google Fonts.
- Pesos usados: 300, 400, 500, 700 y 900.
- Tinta principal: `#3e4559`.
- Acento principal: `#ff7f00`.
- Superficies: blanco y grises muy claros.
- Secciones oscuras: negro y azul/gris profundo.
- Bordes: `#e6e6e6`.
- Texto secundario: `#818693`.
- Títulos hero: aproximadamente 43–51 px en los archivos originales, con peso 300–500.
- Títulos de sección: 28–40 px, con títulos destacados en peso 900.
- Cuerpo: 15–18 px.
- Etiquetas: mayúsculas, tracking amplio y tamaño compacto.
- Composición: hero fotográfico, contenido alineado en extremos, buscador flotante, cards editoriales, alternancia claro/oscuro y panel comercial separado.

Fu Travel OS amplía esta escala de forma responsive y conserva los contrastes, sin copiar selectores ni medidas píxel por píxel.

## JavaScript y plugins

| Plugin encontrado | Función original | Reemplazo nativo |
| --- | --- | --- |
| jQuery / jQuery UI | DOM, eventos, controles | Estado y eventos React |
| Slick | sliders | Slider React con teclado, swipe y reduced motion |
| LightGallery | lightbox | Diálogo accesible controlado por React |
| Arctic Modal | modales | `dialog`/overlay React |
| Mousewheel | navegación por rueda | Scroll nativo |
| Spincrement | contadores | IntersectionObserver/CSS cuando sea necesario |
| lwtCountdown | cuenta regresiva | No se incorpora |
| Google Maps API | mapas | Representación demo existente |
| Formularios del template | contacto | Flujos existentes de Fu Travel OS |

No se cargan scripts del ZIP ni endpoints PHP.

## Assets

### Utilizados

- Siete SVG funcionales/decorativos del ZIP: reloj, ubicación clara, búsqueda,
  flecha de slide, estrella activa, estrella inactiva y cierre de menú.
- Imágenes demo ya existentes y permitidas en `public/images`.
- Roboto mediante `next/font/google`.
- Iconos del paquete React ya instalado.

### Descartados

- Todas las fotografías demo.
- SVG decorativos grandes y fondos de demostración.
- PSD u originales de diseño.
- Favicon del template.
- CSS y JavaScript de plugins.
- Fuentes de iconos completas.
- Google Maps key de ejemplo.

## Riesgos y compatibilidad

- La ausencia de licencia dentro del paquete impide documentar atribuciones específicas de assets demo; se evita su redistribución.
- Los scripts originales dependen de APIs y patrones incompatibles con React 19 y el App Router.
- Importar `styles.css` produciría colisiones globales con los otros temas.
- Algunos SVG son extremadamente pesados (uno supera 16 MB).
- La UI original no cubre todas las reglas de ocupación, capacidad, viajeros y abordaje de Fu Travel OS; esas reglas permanecen en la capa compartida.

## Plan de adaptación aplicado

1. Registrar `lavella` como tema seleccionable, sin cambiar el predeterminado.
2. Crear componentes React bajo `components/themes/lavella`.
3. Aislar estilos bajo `.theme-v2-lavella`.
4. Reutilizar catálogo, filtros, secciones modulares, pricing y reserva.
5. Crear header, home, cards, footer y presentación de detalle Lavella.
6. Aplicar una capa visual Lavella al comercio heredado sin duplicar estado.
7. Validar teclado, reduced motion, móvil y rutas directas.

## Seguridad

- Sin `dangerouslySetInnerHTML` nuevo.
- Sin `javascript:` URLs.
- Sin scripts, iframes o formularios externos del template.
- Video y descargas continúan pasando por los validadores existentes.
- El ZIP y la extracción permanecen fuera de Git.

## Auditoría visual detallada

La primera integración interpretó Lavella desde una descripción general y no desde su composición real. La inspección visual del HTML ejecutado revela un lenguaje mucho más específico:

- El home elegido es `index.html`.
- El primer viewport es una portada de altura completa. Sobre la fotografía aparecen dos niveles de header: contacto y redes arriba; logotipo, navegación y búsqueda debajo.
- El título del slide es compacto, pesado y alineado abajo a la izquierda; no es un display enorme de estilo editorial.
- El hero utiliza un callout geográfico en el extremo derecho, paginación vertical y una franja inferior negra con seis categorías.
- La home continúa sobre negro con cards horizontales de gran formato, no con un grid blanco de tarjetas estándar.
- El buscador es una superficie blanca de aproximadamente 1200 px, con radio amplio, situada exactamente en la transición negro/gris.
- Los destinos se muestran en cards blancas con imagen superior, bandera circular que rompe el borde y footer dividido.
- El bloque editorial posterior es blanco y usa dos columnas de texto.
- La promoción es una franja fotográfica oscura de gran altura.
- El diario utiliza fondo fotográfico y cards editoriales.
- El footer empieza con una navegación horizontal y después cuatro columnas sobre negro.

### Header

- Altura total desktop observada: aproximadamente 122 px.
- Topbar: 40 px, contacto a la izquierda y cuatro iconos sociales a la derecha.
- Navegación: logo de 36 px de alto visual, menú centrado y búsqueda a la derecha.
- Línea inferior fina y subrayado blanco del enlace activo.
- En móvil el original cambia a un menú lateral compacto; no usa el drawer fullscreen inventado en la primera integración.

### Home hero

- Altura: 100 vh.
- Contenido principal: tercio inferior izquierdo.
- Título: cerca de 48 px a 1280 px, peso 700.
- Descripción: 18 px, peso 400.
- Botones: píldora naranja, píldora transparente y flecha circular.
- Control contextual derecho con icono de ubicación.
- Dots verticales a la derecha.
- Franja de categorías integrada dentro del hero.

### Listado

Se selecciona `tour-list.html`: cabecera fotográfica oscura, breadcrumb, título, buscador blanco de cinco campos y carrusel de destinos pequeños. El contenido usa una columna principal de cards grandes y un sidebar claro.

### Detalle

Se selecciona `single.html`, con apoyo cromático de `single-dark.html`: hero fotográfico de gran escala, metadata y CTA encima de la imagen, tres imágenes de galería que comienzan en la parte inferior del hero, cuerpo claro de dos columnas, programa vertical y sidebar comercial.

### Breakpoints originales

Los archivos usan puntos de corte específicos en 1600, 1440, 1400, 1230, 1076, 1000, 760, 686, 610, 430 y 358 px. La reconstrucción conserva los cambios estructurales principales en 1230, 1000, 760, 610 y 430 px.

### Diagnóstico de la primera implementación

- Hero con título de 112 px y metadata tipo Explorer.
- Cards de tres columnas heredadas del catálogo compartido.
- Detalle construido con `SharedDetail` y `ExplorerBookingPanel`.
- Menú fullscreen no presente en Lavella.
- Footer inventado de tres columnas.
- Home con secciones y ritmos diferentes del original.
- CSS compacto basado en overrides de componentes ajenos.

La segunda implementación reemplaza estos elementos por DOM propio Lavella.

### Resultado de la segunda implementación

- `index.html` gobierna la secuencia, escala y composición del home.
- `tour-list.html` gobierna el catálogo, su buscador de gran formato y el
  patrón contenido/sidebar.
- `single.html` gobierna hero, galería superpuesta, cuerpo y panel; se usa
  `single-dark.html` únicamente como apoyo cromático.
- El panel ya no monta `ExplorerBookingPanel`; consume las funciones
  compartidas desde markup Lavella.
- Los selectores principales viven en CSS Modules. El comercio heredado usa
  una hoja global estrictamente limitada por `.lavella-commerce`.
- No se cargan jQuery, Slick, LightGallery, Arctic Modal, scripts PHP ni CSS
  global del template.
