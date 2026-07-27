# Inventario visual Lavella

## Matriz de páginas

| Página original | Página Fu Travel OS | Estado anterior | Diferencias | Acción |
| --- | --- | --- | --- | --- |
| `index.html` | `/?theme=lavella` | No equivalente | Hero, navegación, categorías y secuencia distintos | Reconstruir |
| `tour-list.html` | `/viajes?theme=lavella` | Catálogo compartido | Faltaban buscador de cabecera, destinos y sidebar Lavella | Renderer propio |
| `single.html` | `/viajes/[slug]?theme=lavella` | SharedDetail + panel Explorer | Hero, galería, programa y sidebar distintos | Renderer propio |
| `single-dark.html` | Detalle, superficies oscuras | Parcial | Solo se reutilizaba el color carbón | Usar como referencia cromática |
| `destinations.html` | `/destinos?theme=lavella` | Catálogo compartido | Cards y encabezado no correspondían | Integrar cards de destino |
| `search-results.html` | Estado filtrado | Compartido | Paginación y cards diferentes | Extender catálogo |
| `contacts.html` | `/contacto?theme=lavella` | Legacy | Footer y contacto genéricos | Skin Lavella coherente |
| `blog-list.html` | Diario home | No equivalente | Faltaba fondo fotográfico y cards | Crear bloque editorial |

## Medidas y patrones observados

| Elemento | Desktop original | Comportamiento responsive |
| --- | --- | --- |
| Contenedor | 1200 px aprox.; 40 px laterales a 1280 | 92–94 vw; 20 px en móvil |
| Header | 122 px, dos filas | Logo, búsqueda y botón de menú; panel lateral |
| Hero home | 100 vh | Mantiene portada; contenido apilado |
| Card popular | 730 × 430 aprox., overlay | Una card por vista |
| Search box | 1200 × 358 incluyendo título | Campos a 2 columnas y luego una |
| Destino | Imagen 220 px + cuerpo y footer | Carrusel/card completa |
| Títulos de sección | 38–46 px, 700/900 | 30–36 px |
| Body | 15–18 px, line-height 1.55–1.7 | 15–16 px |
| Botón primario | Naranja, 50–54 px, radio completo | Ancho completo cuando es necesario |
| Footer | Navegación horizontal + 4 columnas | Acordeón/columnas apiladas |

## Secuencia de `index.html`

1. Hero slider.
2. Categorías integradas.
3. Most popular, fondo negro.
4. Tres beneficios.
5. Search tour.
6. Popular destinations.
7. Bloque Tour Operator.
8. Destinos compactos.
9. Promoción fotográfica.
10. Blog sobre fotografía.
11. Footer negro.

## Estados y movimiento

- Slider: fundido/desplazamiento horizontal, dots verticales.
- Cards: zoom sutil de imagen y elevación del overlay.
- Flechas: círculos transparentes con borde.
- Menú: panel lateral en resoluciones menores.
- Acordeones: apertura vertical.
- Reduced motion: todos los desplazamientos y escalados quedan desactivados.
