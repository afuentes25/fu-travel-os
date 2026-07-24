# Explorer · refinamiento inspirado en Lavella

## Alcance

Auditoría y segunda fase visual realizada únicamente sobre Explorer/Furiver. Se conservaron sin cambios la resolución de tenants, modelos, catálogo, filtros, precios, carrito, checkout, selección de salida, abordajes y mensajes de WhatsApp. Boutique y Marketplace continúan usando sus componentes existentes.

## Auditoría inicial

Se revisaron home, catálogo, detalle, carrito, panel de reserva, menú móvil y selector demo de Explorer. También se analizaron las versiones accesibles de Lavella en home y detalle oscuro, observando su distribución en escritorio y móvil.

### Estado anterior

- La dirección cromática ya era oscura y aspiracional, pero la home terminaba demasiado pronto y se percibía como una landing promocional.
- El hero dependía de una sola imagen y un único mensaje; no representaba viajes reales ni comunicaba duración, salida y precio en contexto.
- El buscador tenía tres campos y se comprimía demasiado en móvil.
- Faltaban categorías con peso fotográfico, una promoción independiente, historia de agencia, contenido editorial y una segunda pausa de búsqueda.
- Destinos y tours usaban buenas imágenes, pero el ritmo era repetitivo: mosaico, cuadrícula y cierre.
- El detalle era corto: hero, texto, itinerario básico, tarifas y reserva. No existían galería, navegación anclada, puntos de abordaje narrados, extras, FAQ ni relacionados.
- El panel sticky compartido tenía etiquetas de 8–10 px, controles de 41 px y un total poco jerarquizado.
- En móvil se mostraba el panel completo dentro del documento y el menú era un dropdown pequeño.
- El selector demo nacía desplegado y competía con controles de reserva.

## Diferencias estructurales detectadas frente a Lavella

Lavella produce profundidad mediante capítulos visuales, no sólo mediante color o tipografía:

1. Hero por destino con navegación visible y datos secundarios separados.
2. Taxonomía de tours presentada como contenido visual.
3. Alternancia entre mosaicos, tarjetas, bloques editoriales y buscadores.
4. Promoción fotográfica como pausa comercial autónoma.
5. Detalle largo con programa por etapas y contenido respirado.
6. Reserva visualmente separada del relato del viaje.
7. Fondos oscuros con cambios de material, escala y densidad.

Explorer adopta esos principios con contenido, identidad, imágenes y componentes propios de Furiver; no replica textos, código, logos ni estructura exacta.

## Decisiones implementadas

- Header transparente de 88 px, sólido al hacer scroll, con navegación editorial y drawer móvil fullscreen.
- Hero de viajes reales con cuatro slides manuales, indicadores accesibles, resumen lateral y CTAs separados.
- Buscador de cinco acciones: destino, experiencia, fecha/mes, origen y búsqueda.
- Ocho categorías fotográficas, mosaico de destinos y una tarjeta destacada de mayor tamaño.
- Confianza sobre fotografía, buscador editorial intermedio, campaña, historia con cifras, diario y CTA final.
- Detalle Explorer independiente con hero, navegación anclada, galería/lightbox, introducción, programa, incluidos, salidas, abordajes, tarifas, extras, políticas, FAQ, relacionados y cierre.
- Panel Explorer independiente de 400 px con controles de 52 px y escala comercial legible.
- Barra inferior móvil y bottom sheet de reserva con scroll interno, cierre, Escape, trampa de foco y safe area.
- Selector demo colapsado por defecto en móvil y estado oculto persistente.

## Componentes compartidos preservados

Datos, tipos, `filterCatalog`, `priceLine`, `whatsappUrl`, carrito en `localStorage`, rutas, resolución de tenant/tema, catálogo base, checkout y administración.

## Componentes visuales específicos Explorer

`ExplorerHeader`, `ExplorerHome`, `ExplorerSearch`, `ExplorerCard`, `ExplorerDetail`, `ExplorerGallery`, `ExplorerBookingPanel` y `ExplorerFooter`.

## Criterios de QA

- Tipografía comercial nunca menor de 13 px en el nuevo panel.
- Objetivos táctiles principales de 44–54 px.
- Foco visible, nombres accesibles, `aria-expanded`, diálogos modales, Escape, retorno de foco y bloqueo de fondo.
- Sin autoplay en el hero; por tanto no existe movimiento automático que pausar. Las transiciones visuales se eliminan con `prefers-reduced-motion`.
- El catálogo conserva filtros y bottom sheet móvil existentes, con cards Explorer.
- El carrito y checkout continúan delegados al flujo compartido.
