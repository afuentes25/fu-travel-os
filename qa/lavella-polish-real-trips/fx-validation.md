# Validación de arquitectura USD → MXN

## Invariantes

1. El producto internacional conserva precio y obligación en USD.
2. La pasarela demo recibe únicamente el cobro actual en MXN.
3. Un cobro no sobrescribe el saldo contractual USD.
4. Cada intento usa un snapshot inmutable.
5. Un snapshot vencido exige nueva cotización y nuevo consentimiento.
6. Una orden no suma importes de monedas contractuales distintas.
7. Los cálculos monetarios cruzan el límite de pago en unidades menores.
8. El redondeo de la política se aplica una sola vez al resultado convertido.

## Configuración demo

Crisenix usa un proveedor determinista claramente identificado como demo:

```text
tasa fuente: 17.25 MXN/USD
markup: 2%
tasa aplicada: 17.595 MXN/USD
vigencia: 15 minutos
redondeo: hacia el siguiente peso
```

No se etiqueta como Banxico y no realiza llamadas de red.

## Caso Patagonia

Precio contractual de referencia:

```text
USD 5,290 por persona en habitación doble
```

Para una persona y anticipo del 30%:

```text
total contractual: USD 5,290
anticipo contractual: USD 1,587
cobro demo del anticipo: MXN 27,924
saldo contractual: USD 3,703
```

Cálculo del cobro:

```text
USD 1,587 × 17.595 = MXN 27,923.265
política up_to_next_peso = MXN 27,924
```

Para pago total:

```text
USD 5,290 × 17.595 = MXN 93,077.55
política up_to_next_peso = MXN 93,078
saldo contractual después de confirmación = USD 0
```

## Quote y snapshot

El proveedor devuelve una cotización con:

- moneda base y cotizada;
- tasa fuente escalada;
- origen `demo`;
- tipo de tasa;
- fecha efectiva;
- fecha de recuperación;
- fecha de expiración.

El snapshot agrega:

- monto contractual del intento;
- markup separado;
- tasa aplicada;
- monto de cobro;
- política de redondeo;
- ID estable para la asignación de pago.

Una vez creado, el snapshot no se modifica. Si expira, se descarta para el
intento siguiente y se crea otro.

## Asignación de pago

La asignación vincula:

```text
monto contractual aplicado en USD
monto cargado en MXN
snapshot utilizado
saldo contractual previo y posterior en USD
tipo de pago: anticipo o total
```

Los abonos posteriores repiten este ciclo con la tasa de su propio día. No
reutilizan la equivalencia de un anticipo anterior.

## Consentimiento

Antes del paso demo de pago se muestra:

> Entiendo que la tarifa está expresada en USD y que el cargo en MXN se calcula
> con la tasa vigente al momento de cada pago.

El registro conserva:

- versión del texto;
- fecha de aceptación;
- ID del snapshot;
- tasa aplicada;
- importe contractual;
- importe a cobrar.

Al recotizar, la aceptación anterior deja de ser válida.

## Carrito

La línea internacional conserva:

- precio y subtotal USD;
- impuestos USD, cuando correspondan;
- anticipo USD;
- saldo USD;
- snapshot del cobro MXN actual.

Si el carrito contiene una línea MXN y otra USD, la continuación se bloquea con
un mensaje para reservarlas por separado. No existe un total híbrido.

## Evidencia visual

| Estado | Evidencia |
| --- | --- |
| Detalle denominado en USD | [01-patagonia-detail-usd.png](fx/01-patagonia-detail-usd.png) |
| Carrito contractual USD | [02-patagonia-cart-usd.png](fx/02-patagonia-cart-usd.png) |
| Anticipo y snapshot MXN | [03-deposit-mxn-snapshot.png](fx/03-deposit-mxn-snapshot.png) |
| Consentimiento | [04-checkout-consent.png](fx/04-checkout-consent.png) |
| Saldo pendiente USD | [05-remaining-balance-usd.png](fx/05-remaining-balance-usd.png) |
| Confirmación FX | [06-confirmation-fx.png](fx/06-confirmation-fx.png) |
| Monedas mixtas bloqueadas | [07-mixed-currency-block.png](fx/07-mixed-currency-block.png) |

## Límite de esta fase

El proveedor, carrito y pago son demostrativos. Producción requiere que la
cotización, expiración, consentimiento, idempotencia y confirmación de pago se
validen en servidor y queden persistidos transaccionalmente.
