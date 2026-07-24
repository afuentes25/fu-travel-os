# Explorer · auditoría final frente a Lavella

## Alcance y fuentes

Esta auditoría cubre exclusivamente Explorer. Se revisaron el Explorer local en home, catálogo y detalle, la URL productiva indicada, y las páginas originales accesibles de Lavella `index.html`, `single.html` y `single-dark.html`.

El archivo solicitado como `/mnt/data/HTML.zip` no está montado en este entorno (`/mnt/data` no existe) y tampoco se encontró un archivo `HTML.zip` en los adjuntos o el sistema de archivos accesible. Para no detener la corrección, se inspeccionaron directamente los mismos HTML y CSS originales publicados en el mirror proporcionado por el usuario. No se copiaron recursos ni código.

## Evidencia tipográfica del CSS original

El `index.html` enlaza:

- Google Fonts: `Roboto:300,400,500,700,900&display=swap`.
- Hoja principal: `css/styles.css`.

Los estilos computados confirman:

- `body`: `Roboto, sans-serif`, 16 px, peso 400.
- logotipo tipográfico de referencia: Roboto 300.
- navegación principal: Roboto 500, 15 px.
- navegación secundaria: Roboto 400, 14 px.
- títulos del detalle original: Roboto 900 entre 24 y 40 px.
- botones y datos utilitarios: Roboto 400–500.

Explorer no replica literalmente la escala antigua de la plantilla. Mantiene Roboto y su contraste de pesos, pero adopta la escala responsive solicitada: títulos 300, nombres 400, navegación 500 y precio 300.

## Lavella estándar, Lavella dark y Explorer anterior

### Lavella estándar

- Hero y header fotográficos/oscuros.
- Lectura extensa sobre superficies blancas y gris muy claro.
- Roboto en toda la interfaz.
- Precio y CTA aislados como información comercial.
- Programa, incluidos y preguntas con texto carbón y divisores claros.

### Lavella dark

- Conserva la misma estructura y jerarquía.
- Sustituye las superficies editoriales claras por negro y grises translúcidos.
- Usa blanco en títulos y cuerpos del programa.
- Funciona como variante visual, no como una arquitectura distinta.

### Explorer anterior

- Usaba DM Sans y Cormorant Garamond; la serif provenía de la dirección Boutique/editorial, no de Lavella.
- El hero concentraba título, CTAs y datos en dos grupos que se superponían con facilidad en móvil.
- El precio estaba presente, pero no operaba como zona comercial protagonista.
- El CTA principal decía “Ver viaje”, no “Ver más”.
- Home, catálogo y detalle mantenían demasiado carbón continuo.
- Galería, introducción, programa, incluidos, salidas, tarifas y FAQ compartían una superficie oscura; la lectura larga resultaba pesada.
- Las tarjetas dependían de la imagen y el título, pero no ofrecían un CTA permanente ni un resumen comercial completo.
- El panel oscuro no se diferenciaba suficientemente porque también estaba rodeado por fondos oscuros.

## Corrección de dirección

Cadencia adoptada:

> oscuro para emocionar → claro para explicar → oscuro para reservar, convertir y cerrar

### Oscuro

- header y hero;
- confianza y promoción;
- panel de reserva;
- CTA final y footer.

### Claro

- buscador principal;
- categorías;
- destinos;
- viajes destacados;
- buscador editorial;
- historia y diario;
- resultados del catálogo;
- navegación, introducción, galería y todo el cuerpo editorial del detalle;
- relacionados.

## Estructura objetivo del hero

1. Identificador: `01 / 04`, categoría y región.
2. Contenido: nombre real del producto, destino y resumen.
3. Comercial: etiqueta “Desde”, precio confiable mediante `formatMoney`, moneda, duración y próxima salida.
4. Acciones: “Ver más”, WhatsApp, anterior/siguiente e indicadores.

El slider debe ser determinista, tener autoplay moderado, detenerse por hover, foco, interacción, pestaña oculta y `prefers-reduced-motion`, además de aceptar flechas de teclado y swipe.

## Restricciones preservadas

No se modifican modelos, datos estructurados, pricing, tenancy, carrito, checkout, reservas, salidas, abordajes, tarifas, extras, WhatsApp, administración, Boutique ni Marketplace.
