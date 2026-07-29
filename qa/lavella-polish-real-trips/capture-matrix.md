# Matriz de capturas y QA visual

Las capturas se generaron con viewports reales. En las rutas y estados
capturados se comprobó que:

- `scrollWidth` no superó el ancho del viewport;
- no hubo recorte horizontal;
- títulos, precios y CTAs permanecieron visibles;
- el panel no invadió el footer;
- las variantes móviles conservaron una sola columna útil.

## Home

| Evidencia | Viewport | Estado comprobado |
| --- | ---: | --- |
| [Hero y control](home/01-hero-control-1440x900.png) | 1440 × 900 | Flecha centrada, controles visibles |
| [Destinos originales](home/02-destinations-original-1440x900.png) | 1440 × 900 | Referencia `index.html` |
| [Destinos corregidos](home/03-destinations-after-1440x900.png) | 1440 × 900 | Carrusel proporcional, ficha clara y texto legible |
| [Viajes populares](home/04-popular-trips-1440x900.png) | 1440 × 900 | Cuatro columnas y dos filas |
| [Viajes populares laptop](home/05-popular-trips-1366x768.png) | 1366 × 768 | Cards sin compresión |
| [Contraste](home/06-card-contrast-1366x768.png) | 1366 × 768 | Texto sobre imagen y superficies claras |
| [Home móvil](home/07-mobile-390x844.png) | 390 × 844 | Slider, control y composición móvil |

## Catálogo

Ruta: `/viajes?tenant=crisenix&theme=lavella`.

| Evidencia | Viewport | Estado comprobado |
| --- | ---: | --- |
| [Filtro al inicio](catalog/01-filters-sticky-start-1366x768.png) | 1366 × 768 | Encabezado y controles visibles |
| [Filtro después de scroll](catalog/02-filters-sticky-scrolled-1366x768.png) | 1366 × 768 | Sticky bajo el header, no fixed |
| [Filtro móvil](catalog/03-mobile-filters-390x844.png) | 390 × 844 | Panel móvil sin sidebar permanente |

## Detalle

| Evidencia | Viewport | Estado comprobado |
| --- | ---: | --- |
| [Hero](detail/01-hero-1440x900.png) | 1440 × 900 | Editorial y comercial separados |
| [Título largo](detail/02-hero-long-title-1440x900.png) | 1440 × 900 | Sin colisión con precio o CTA |
| [Sin franja intermedia](detail/03-no-intermediate-strip-1440x900.png) | 1440 × 900 | Hero/galería conducen al submenú |
| [Panel 1280](detail/04-panel-1280x800.png) | 1280 × 800 | Fecha, adultos y menores visibles |
| [Panel 1366](detail/05-panel-1366x768.png) | 1366 × 768 | Panel compacto en laptop |
| [CTAs](detail/06-ctas-one-row-1366x768.png) | 1366 × 768 | Reserva y WhatsApp en la misma fila |
| [Itinerario](detail/07-itinerary-simple-1440x900.png) | 1440 × 900 | Sin HORARIO ni PARADAS |
| [Detalle móvil](detail/08-mobile-390x844.png) | 390 × 844 | Hero y contenido sin overflow |
| [Bottom sheet](detail/09-mobile-booking-sheet-390x844.png) | 390 × 844 | Total, CTA, cierre y safe area |

## Viajes Crisenix

Todas las rutas usan `tenant=crisenix&theme=lavella`.

| Evidencia | Viewport | Verificación principal |
| --- | ---: | --- |
| [Muralla](trips/01-muralla-1-dia.png) | 1366 × 768 | 1 día, tarifa general, sin hotel |
| [Guadalajara](trips/02-guadalajara-2-dias.png) | 1366 × 768 | 2 días · 1 noche, doble MXN |
| [Veracruz](trips/03-veracruz-3-dias.png) | 1366 × 768 | 3 días · 2 noches |
| [Oaxaca](trips/04-oaxaca-4-dias.png) | 1366 × 768 | 4 días · 3 noches |
| [Velada](trips/05-velada-5-dias.png) | 1366 × 768 | 5 días · 4 noches, sin cuádruple |
| [Chepe](trips/06-chepe-6-dias.png) | 1366 × 768 | 6 días · 5 noches, sin cuádruple |
| [Patagonia](trips/07-patagonia-usd.png) | 1366 × 768 | 13 días · 12 noches, USD |

## Multimoneda

| Evidencia | Viewport | Estado comprobado |
| --- | ---: | --- |
| [Detalle USD](fx/01-patagonia-detail-usd.png) | 1366 × 768 | Precio contractual USD |
| [Carrito USD](fx/02-patagonia-cart-usd.png) | 1366 × 768 | Subtotal y saldo sin mezcla |
| [Snapshot](fx/03-deposit-mxn-snapshot.png) | 1366 × 768 | Anticipo USD y cobro MXN |
| [Consentimiento](fx/04-checkout-consent.png) | 1366 × 768 | Texto, tasa y aceptación |
| [Saldo](fx/05-remaining-balance-usd.png) | 1366 × 768 | Saldo pendiente conserva USD |
| [Confirmación](fx/06-confirmation-fx.png) | 1366 × 768 | Resumen del cobro y obligación |
| [Bloqueo mixto](fx/07-mixed-currency-block.png) | 1366 × 768 | USD y MXN se reservan por separado |

## Datos compartidos y aislamiento

| Evidencia | Viewport | Estado comprobado |
| --- | ---: | --- |
| [Explorer](regressions/01-crisenix-explorer-catalog.png) | 1366 × 768 | Viajes Crisenix disponibles |
| [Lavella](regressions/04-crisenix-lavella-catalog.png) | 1366 × 768 | Viajes Crisenix disponibles |

## Viewports complementarios revisados

La composición responsive fue comprobada en:

```text
320 × 568
360 × 800
390 × 844
430 × 932
768 × 1024
1280 × 800
1366 × 768
1440 × 900
```

Los viewports sin captura dedicada se usaron para comprobación de layout,
overflow, orden responsive y áreas táctiles. Las capturas conservadas representan
los estados visualmente distintos y los tres tamaños críticos de laptop.

Los resultados de lint, TypeScript, tests, build y `git diff --check` se
registran por separado después de ejecutar cada comando.
