# Resultados de validación final

Fecha: 26 de julio de 2026

Validaciones ejecutadas sobre:

```text
/Users/macpro/Proyectos/fu-travel-os
```

## Validación técnica

| Validación | Resultado | Evidencia resumida |
| --- | --- | --- |
| `npm run lint` | Pasa | ESLint terminó con código 0 y sin hallazgos |
| `npx tsc --noEmit` | Pasa | TypeScript terminó con código 0 |
| `npm run test` | Pasa | 150 pruebas aprobadas; 0 fallidas, omitidas o canceladas |
| `npm run build` | Pasa | Next.js 16.2.6 compiló, comprobó tipos y generó 4 páginas |
| `git diff --check` | Pasa | Sin errores de whitespace |
| `grep -R "HORARIO" components/themes/lavella` | Pasa | Sin coincidencias públicas |
| `grep -R "PARADAS" components/themes/lavella` | Pasa | Sin coincidencias públicas |
| `grep -R "explorer-" components/themes/lavella` | Pasa | Sin dependencias visuales Explorer |
| `git check-ignore reference-themes/lavella.zip` | Pasa | El ZIP permanece ignorado |

El primer intento de TypeScript dentro del sandbox no pudo escribir
`tsconfig.tsbuildinfo`; la misma instrucción autorizada se ejecutó después con
permisos de escritura y pasó. El build regeneró `next-env.d.ts`; se restauró
inmediatamente la versión preexistente del usuario.

## Matriz de las 40 pruebas obligatorias

| # | Cobertura | Prueba aprobada en `tests/core.test.ts` |
| ---: | --- | --- |
| 1 | Flecha centrada | `flecha Lavella usa el SVG adquirido existente y corrección óptica` |
| 2 | Configuración de autoplay | `autoplay Lavella usa 5000, transición 650 y reanudación 7000` |
| 3 | Sin intervalos duplicados | `slider Lavella usa un temporizador rearmable sin setInterval` |
| 4 | Renderer de destinos | `destinos populares usa el carrusel proporcional de Lavella` |
| 5 | Tokens de contraste | `componentes Lavella declaran superficies claras, oscuras e imagen` |
| 6 | Cuatro columnas | `viajes populares usa cuatro columnas en el viewport compatible` |
| 7 | Rating real | `card Lavella no inventa rating ni reseñas` |
| 8 | Ocho expediciones | `home Lavella solicita ocho próximas expediciones` |
| 9 | Sidebar sticky | `sidebar Lavella es sticky en escritorio con altura de viewport` |
| 10 | No fixed en escritorio | `sidebar Lavella solo usa fixed dentro del breakpoint móvil` |
| 11 | Comportamiento móvil del filtro | `sidebar Lavella solo usa fixed dentro del breakpoint móvil` |
| 12 | Franja eliminada | `detalle Lavella elimina la franja de introducción previa al submenú` |
| 13 | Hero en dos áreas | `hero de detalle separa contenido editorial y oferta comercial` |
| 14 | Adultos y menores | `adultos y menores comparten fila en el panel Lavella` |
| 15 | CTAs en una fila | `reserva y WhatsApp comparten fila en escritorio Lavella` |
| 16 | Sin HORARIO | `itinerario Lavella no muestra HORARIO` |
| 17 | Sin PARADAS | `itinerario Lavella no muestra PARADAS` |
| 18 | Paradas internas | `paradas tipadas siguen disponibles para el mapa` |
| 19 | Siete viajes | `existen exactamente los siete viajes fuente Crisenix` |
| 20 | Slugs únicos | `slugs de viajes fuente son únicos en el catálogo compartido` |
| 21 | Cuatro temas | `los siete viajes usan un único dato compartido para los cuatro temas` |
| 22 | Duración y noches | `duraciones y noches de los siete viajes coinciden con las fuentes` |
| 23 | Tarifas dobles | `tarifas dobles publicadas son la referencia de hospedaje` |
| 24 | Sin tarifas inventadas | `tarifas no publicadas no se inventan` |
| 25 | Viaje de un día | `Muralla de un día no usa hospedaje` |
| 26 | Día 0 | `Día 0 se conserva como segmento previo sin aumentar duración` |
| 27 | Patagonia USD | `Patagonia conserva precio y obligación contractual en USD` |
| 28 | USD no sobrescrito | `la conversión no sobrescribe el total contractual USD` |
| 29 | Snapshot | `conversión genera snapshot enlazado al intento` |
| 30 | Inmutabilidad | `snapshot FX es inmutable` |
| 31 | Expiración | `snapshot expirado requiere una nueva cotización` |
| 32 | Saldo USD | `anticipo mantiene saldo contractual en USD` |
| 33 | Abonos | `cada abono puede conservar un snapshot nuevo en el historial` |
| 34 | Pago total | `pago total liquida el saldo USD` |
| 35 | Monedas mezcladas | `carrito no suma MXN y USD` |
| 36 | Redondeo | `redondeo FX ocurre al final según política de agencia` |
| 37 | Consentimiento | `consentimiento enlaza tasa, monto y versión del texto` |
| 38 | Tenant y tema | `carrito conserva theme y tenant al reservar Lavella` |
| 39 | Proveedor demo | `proveedor determinista no se presenta como Banxico` |
| 40 | Unidades menores | `utilidades monetarias usan unidades menores seguras` |

La suite agrega además defensas para recotización, copy de pago total,
aislamiento de órdenes FX, líneas persistidas inválidas y los tres modos de
visibilidad de disponibilidad.

## Comprobación funcional local

La revisión en navegador confirmó:

- home Lavella con hero, carrusel de destinos y ocho expediciones;
- catálogo Crisenix sin overflow y sidebar con `position: sticky`;
- detalle Chepe con precio doble, panel compacto, sticky navigation e
  itinerario sin `HORARIO/PARADAS`;
- Patagonia denominada en USD, tasa demo `17.595`, cobro estimado MXN,
  anticipo y saldo contractual USD;
- carrito mixto bloqueado y tema `lavella` conservado;
- cero errores o fallos de hidratación en consola.

Solo se observaron avisos de desarrollo de Next.js recomendando carga eager
para dos imágenes LCP del detalle; no impiden build ni navegación.

## Estado de entrega

No se hizo commit, push ni deploy.
