# Fu Travel OS — Auditoría y QA visual, fase 2

## Auditoría de la primera fase

La primera versión resolvía correctamente el dominio y la operación, pero la presentación estaba concentrada en un único componente:

- un mismo header blanco con la misma navegación;
- un mismo hero fotográfico y la misma composición;
- un mismo buscador de cuatro columnas;
- una misma tarjeta con imagen superior y cuerpo blanco;
- un mismo catálogo con sidebar y grilla;
- un mismo detalle con hero, facts y panel;
- un mismo footer oscuro;
- una sola fotografía para agencias, destinos y viajes.

Los temas cambiaban principalmente color, serif/sans, redondeo y algunas alturas. Sin el selector, Marketplace y Explorer eran casi indistinguibles y Boutique conservaba la misma arquitectura comercial.

La lógica que permanece compartida es tenancy, modelos, datos, filtros, disponibilidad, pricing, salidas, puntos, carrito, checkout, validaciones y WhatsApp.

## Interpretación original de referencias

- **Lavella → Explorer:** hero oscuro de gran altura, fotografía ambiental, display serif de gran escala, cobre como acento, mosaico asimétrico, tarjetas completamente fotográficas y ritmo de secciones oscuras.
- **Tripin → Boutique:** aire editorial, navegación equilibrada, marfil y oliva, serif expresiva, hero dividido, fotografía vertical, colecciones con espacio negativo y narrativa de agencia.
- **TripRex → Marketplace:** barra utilitaria, navegación comercial, buscador multidimensional, categorías, destinos, ofertas, calendario y llamados de conversión visibles.
- **Mega Travel → Marketplace catálogo:** conteos, sidebar preciso, tabla/tarjetas, código, duración, ciudades, salida, origen, USD/MXN, impuestos, anticipo y disponibilidad comparables.

No se copiaron imágenes, marcas, textos, código ni componentes exactos.

## Matriz comparativa

| Elemento | Explorer | Boutique | Marketplace |
| --- | --- | --- | --- |
| Header | Transparente, oscuro, CTA de expedición | Marfil, centrado, concierge | Topbar, buscador, categorías y carrito |
| Hero | 100dvh, cinematográfico, cobre | Split editorial, serif, retrato vertical | Panorámico comercial y orientado a conversión |
| Buscador | Oscuro integrado en fotografía | Franja editorial de intención | Seis campos y pestañas de producto |
| Card | Imagen completa con datos superpuestos | Fotografía vertical y copy mínimo | Tres columnas con código, tags, impuestos y CTA |
| Catálogo | Cabecera fotográfica y filtros carbón | Filtros superiores y colección aireada | Sidebar con conteos y vista tabla/tarjetas |
| Detalle | Hero inmersivo e itinerario oscuro | Galería vertical y narrativa serena | Cabecera de facts, anclas y desglose comercial |
| Reserva | Panel carbón con acento cobre | Panel sobrio sin sombra | Panel blanco con borde de conversión coral |
| Footer | Negro, grande y expresivo | Oliva, editorial y refinado | Azul amplio con cinco columnas |

## Datos e imágenes

- Furiver: 10 viajes.
- Crisenix: 19 viajes; 11 nacionales y 8 internacionales.
- Boutique: 8 viajes premium e internacionales.
- 12 recursos visuales originales: tres heroes y nueve destinos.
- Assets finales optimizados en WebP y servidos mediante `next/image`.

## QA

Capturas de escritorio:

- `explorer-home-1440.png`
- `explorer-catalog-1440.png`
- `explorer-detail-1440.png`
- `boutique-home-1440.png`
- `boutique-catalog-1440.png`
- `boutique-detail-1440.png`
- `marketplace-home-1440.png`
- `marketplace-catalog-1440.png`
- `marketplace-detail-1440.png`

Capturas móviles:

- `explorer-mobile-390.png`
- `boutique-mobile-390.png`
- `marketplace-mobile-390.png`

Se verificaron los homes en 320×568, 360×640, 375×667, 390×844, 393×852, 430×932, 768×1024, 1024×768, 1280×800, 1440×900 y 1728×1117.

Se verificaron catálogos y detalles de los tres temas en 320, 390 y 1024 px. Las 51 comprobaciones terminaron sin overflow horizontal.
