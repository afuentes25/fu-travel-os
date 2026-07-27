# Lavella · refinamiento visual y viajes demo con fuentes públicas

Fecha de revisión: 26 de julio de 2026

## Alcance

Esta fase refina únicamente el renderer visual Lavella y amplía los datos demo
compartidos. Explorer, Boutique y Marketplace conservan sus renderers; los
siete viajes nuevos aparecen en los cuatro temas porque pertenecen a la capa de
datos de Crisenix.

Referencias locales auditadas:

- `reference-themes/lavella-extracted/HTML/index.html`
- `reference-themes/lavella-extracted/HTML/tour-list-4.html`
- `reference-themes/lavella-extracted/HTML/single.html`

No se cargan HTML, CSS, jQuery ni plugins del ZIP en runtime. Tampoco se hacen
peticiones a Crisenix durante la ejecución: la información revisada se
transformó en datos TypeScript tipados.

## Resultado visual

### Hero y slider

La flecha descentrada provenía de combinar un icono genérico con el `line-height`
del botón circular. El control ahora usa el SVG de flecha auditado, dimensiones
explícitas y `inline-grid` con `place-items: center`; una corrección óptica
horizontal mínima compensa el espacio interno de su `viewBox`.

La configuración predeterminada de Lavella es:

```text
autoplay: 5,000 ms
transición: 650 ms
reanudación después de interacción: 7,000 ms
```

La configuración pertenece a la agencia. El slider usa un solo temporizador,
se pausa por hover, foco, pestaña oculta, interacción y
`prefers-reduced-motion`, y conserva flechas, indicadores y swipe.

### Superficies y contraste

Los componentes Lavella declaran explícitamente una superficie:

```text
light · dark · image · accent
```

Cada superficie consume tokens `on-light`, `on-dark` o `on-accent`; los títulos,
metadatos, precios, enlaces, badges y botones dejan de depender del color
heredado desde el capítulo anterior.

La revisión visual comprobó contraste legible en hero, cards fotográficas,
cards Classic, mosaico de destinos, buscador, footer, menú, catálogo y detalle.

### Viajes populares

La nueva sección:

```text
VIAJES POPULARES
Próximas expediciones
```

usa `tour-list-4.html`, específicamente el lenguaje de “Tour Classic 3
Columns”, adaptado a cuatro columnas cuando el ancho útil lo permite. Muestra
ocho viajes, con imagen, región, título, duración, próxima fecha y precio desde.
No se inventan rating ni reseñas.

### Destinos

La sección se reconstruyó a partir de la composición observada en
`index.html`: un carrusel horizontal de ocho cards fotográficas amplias, con
imagen dominante, ficha clara, contador de salidas y una cuarta card parcial
que comunica continuidad. Las flechas desplazan el rail real. En tablet y móvil
se conserva el mismo patrón con cards de ancho útil, títulos completos y sin
overflow de página.

### Catálogo

El filtro Lavella es sticky únicamente en escritorio:

```text
top: altura del header sólido + 24 px
max-height: viewport - header - 48 px
```

Se detiene con su columna antes del footer. En móvil continúa usando el panel
desplegable existente y no se convierte en `fixed`.

### Detalle

El hero separa contenido editorial y bloque comercial. Título, descripción y
destino ocupan la columna flexible; precio, duración, próxima salida y CTA usan
una columna de 250–340 px con separación propia. En móvil el orden es vertical
y no depende de posiciones absolutas.

La franja redundante de duración, país, transporte y disponibilidad anterior al
submenú fue eliminada. No deja contenedor, borde ni espaciado vacío.

### Panel de reserva

El panel se compactó para 1280 × 800, 1366 × 768 y 1440 × 900:

- cabecera fotográfica de 104 px;
- padding y gaps reducidos sin bajar de 12 px de texto;
- fecha de 41 px;
- adultos y menores en una fila;
- alerta de capacidad compacta;
- total y acciones en footer sticky interno;
- Reserva y WhatsApp en una sola fila en escritorio;
- scroll interno únicamente cuando la altura disponible lo exige.

El bottom sheet móvil conserva controles, total, CTA, WhatsApp y safe area.

### Itinerario

El itinerario público Lavella muestra únicamente:

- número de día;
- título;
- descripción segura;
- imágenes configuradas.

`HORARIO`, `PARADAS`, comidas, hospedaje y destacados permanecen disponibles en
los datos para mapa y operación, pero no aparecen como mini secciones dentro de
cada día.

## Siete viajes Crisenix

Se incorporaron siete productos con ID y slug estables:

1. Muralla China Mexicana.
2. Guadalajara, Mariachi y Tradición.
3. Playas y Riscos de Veracruz.
4. Costas de Oaxaca.
5. Velada Astronómica VIP.
6. Chepe Premier: Barrancas del Cobre con Estilo.
7. Patagonia: Encuentro con el Fin del Mundo.

Duraciones, tarifas publicadas, fechas y decisiones de modelado están
documentadas en [source-data.md](source-data.md). Ninguna tarifa ausente se
rellena por analogía. Los siete productos usan la configuración modular de
secciones y pueden consultarse con `tenant=crisenix` en Explorer, Boutique,
Marketplace y Lavella.

## Arquitectura multimoneda

Patagonia conserva:

```text
moneda de precio: USD
moneda de liquidación contractual: USD
moneda de cobro demo: MXN
```

El proveedor determinista entrega una tasa demo. La política de Crisenix separa
tasa fuente, markup y tasa aplicada; el cálculo usa unidades menores y la regla
de redondeo de la agencia.

Cada intento crea un snapshot inmutable. El anticipo y el saldo siguen
denominados en USD; solo el cobro actual se expresa en MXN. Checkout exige
consentimiento con versión, tasa, montos y fecha. Un snapshot vencido requiere
recotización y nuevo consentimiento.

El carrito rechaza una orden con productos de monedas contractuales distintas y
evita sumar USD con MXN. El detalle completo está en
[fx-validation.md](fx-validation.md) y la arquitectura duradera en
[`docs/fx-multicurrency-demo.md`](../../docs/fx-multicurrency-demo.md).

## QA visual

Se generaron 37 capturas reales:

- 7 de home;
- 3 de catálogo;
- 9 de detalle;
- 7 de viajes;
- 7 de multimoneda;
- 4 de aislamiento entre temas.

Las rutas revisadas no presentaron overflow horizontal en los viewports
capturados. La matriz con ruta, estado, viewport y criterio está en
[capture-matrix.md](capture-matrix.md).

## Aislamiento

Las capturas de regresión confirman que el catálogo Crisenix sigue disponible
en los cuatro renderers. Los cambios visuales de esta fase están limitados a los
componentes y estilos Lavella; la capa compartida aporta viajes y multimoneda.

## Riesgos pendientes

- La tasa es determinista y demostrativa; no equivale a Banxico ni a un
  proveedor comercial.
- Producción requiere cotización server-side, persistencia transaccional,
  idempotencia, validación de expiración en servidor y una pasarela real.
- Las fechas publicadas pertenecen al material revisado; deben confirmarse antes
  de convertir el demo en oferta comercial.
- Las imágenes son recursos demo del proyecto, no una afirmación del proveedor
  fuente.
- No existe un motor automático de distribución en múltiples habitaciones.

## Validación técnica

La validación final pasa:

- lint sin hallazgos;
- TypeScript sin errores;
- 150 de 150 pruebas;
- build de producción correcto;
- `git diff --check` sin errores.

El detalle completo está en
[validation-results.md](validation-results.md). No se hizo commit, push ni
deploy.
