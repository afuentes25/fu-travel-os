# Datos fuente de los viajes Crisenix

Fecha de revisión: 26 de julio de 2026

## Criterio

Las páginas públicas se revisaron durante desarrollo y se convirtieron en datos
demo estáticos. No existe scraping en runtime. Cada producto conserva
`sourceReference.provider`, `sourceReference.sourceUrl` y
`sourceReference.reviewedAt`.

Los títulos y hechos comerciales se estructuran; no se copia el HTML completo
ni se presentan servicios no confirmados. Las fechas se modelan en 2026 para la
demostración y requieren validación comercial antes de producción.

## Matriz

| Viaje y fuente | Slug | Duración | Tarifa publicada usada como referencia | Salidas modeladas | Decisiones |
| --- | --- | --- | --- | --- | --- |
| [Muralla China Mexicana](https://crisenix.com.mx/tour/muralla-china-mexicana/) | `muralla-china-mexicana` | 1 día · 0 noches | General $1,170 MXN | 25 abril · 19 septiembre | `accommodationMode: none`; no se inventa menor ni ocupación |
| [Guadalajara, Mariachi y Tradición](https://crisenix.com.mx/tour/guadalajara-guadalajara-mariachi-y-tradicion-en-hacienda-los-3-potrillos/) | `guadalajara-mariachi-y-tradicion` | 2 días · 1 noche | Doble $3,490 MXN | 13 marzo · 11 septiembre | Traslado nocturno como `preTripSegment`; no aumenta la duración |
| [Playas y Riscos de Veracruz](https://crisenix.com.mx/tour/playas-y-riscos-de-veracruz-los-tuxtlas-y-roca-partida/) | `playas-y-riscos-de-veracruz` | 3 días · 2 noches | Doble $4,990 MXN | 14 mayo · 16 julio · 30 diciembre | Conserva Catemaco, Nanciyaga, Sontecomapan, Barra de Oro, Roca Partida y Veracruz |
| [Costas de Oaxaca](https://crisenix.com.mx/tour/costas-de-oaxaca/) | `costas-de-oaxaca` | 4 días · 3 noches | Doble $6,990 MXN | 1 abril · 22 julio · 2 septiembre · 25 diciembre | Conserva Puerto Escondido, Mazunte, Zipolite, Manialtepec, Huatulco y La Entrega |
| [Velada Astronómica VIP](https://crisenix.com.mx/tour/velada-astronomica-vip/) | `velada-astronomica-vip` | 5 días · 4 noches | Doble $19,390 MXN | 11 abril · 9 mayo · 20 junio · 25 julio · 22 agosto · 19 septiembre · 10 octubre · 7 noviembre | Nacional aéreo / fly & drive; sin tarifa cuádruple inventada |
| [Chepe Premier](https://crisenix.com.mx/tour/chepe-premier-barrancas-del-cobre-con-estilo/) | `chepe-premier-barrancas-del-cobre` | 6 días · 5 noches | Doble $27,900 MXN | 12 abril · 19 julio · 25 octubre · 20 diciembre · 27 diciembre | Fly & Train; sin tarifa cuádruple inventada |
| [Patagonia: Encuentro con el Fin del Mundo](https://crisenix.com.mx/tour/patagonia-encuentro-con-el-fin-del-mundo/) | `patagonia-encuentro-con-el-fin-del-mundo` | 13 días · 12 noches | Base doble USD 5,290 | 2 octubre 2026 | Precio y deuda contractual permanecen en USD |

## Tarifas hoteleras

| Slug | Sencilla | Doble | Triple | Cuádruple | Menor | Moneda |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `guadalajara-mariachi-y-tradicion` | 4,190 | 3,490 | 3,340 | 3,190 | 2,690 | MXN |
| `playas-y-riscos-de-veracruz` | 6,390 | 4,990 | 4,790 | 4,590 | 3,790 | MXN |
| `costas-de-oaxaca` | 9,390 | 6,990 | 6,790 | 6,590 | 4,990 | MXN |
| `velada-astronomica-vip` | 22,990 | 19,390 | 19,090 | No publicada | 15,500 | MXN |
| `chepe-premier-barrancas-del-cobre` | 34,900 | 27,900 | 27,300 | No publicada | 20,890 | MXN |
| `patagonia-encuentro-con-el-fin-del-mundo` | No publicada | 5,290 | No publicada | No publicada | No publicada | USD |

La tarifa doble es el precio de referencia de los viajes con hospedaje. Muralla
usa tarifa general y no presenta bases hoteleras.

## Hospedaje, capacidad y transporte

- Muralla ignora ocupación y capacidad de habitación.
- Los otros seis viajes usan `hotel_occupancy`.
- La base continúa dependiendo únicamente de adultos.
- La capacidad cuenta adultos y menores según la política Crisenix.
- Velada usa transporte aéreo y terrestre; su encuentro aeroportuario queda
  configurable y no fija una terminal sin fuente.
- Chepe usa avión, tren y transporte terrestre.
- Patagonia usa transporte aéreo y terrestre.

## Impuestos y anticipo

Los impuestos se marcan como incluidos únicamente cuando la fuente auditada lo
permite: Velada, Chepe y Patagonia. Para los cuatro productos restantes no se
agregan impuestos demo silenciosos como si estuvieran confirmados.

Las salidas usan política de anticipo configurable. El monto presentado siempre
se resuelve desde la salida o el viaje; no existe un texto fijo que pueda
contradecir la configuración.

## Publicación por tema

Los productos tienen una sola definición compartida para el tenant Crisenix.
Las siguientes rutas usan los mismos IDs y precios:

```text
?tenant=crisenix&theme=explorer
?tenant=crisenix&theme=boutique
?tenant=crisenix&theme=marketplace
?tenant=crisenix&theme=lavella
```

No se clonaron viajes por renderer.
