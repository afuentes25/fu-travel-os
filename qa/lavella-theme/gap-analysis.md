# Gap analysis: Lavella original frente a primera implementación

## Home

El original integra el header dentro del hero y reserva la franja inferior del primer viewport para categorías. La implementación anterior ubicaba un header Explorer simplificado y enviaba el buscador inmediatamente después del hero. Se reemplaza por las dos filas reales del header, callout lateral, dots verticales y taxonomía inferior.

El original usa un título de slide compacto y pesado. El anterior usaba títulos de hasta 112 px con peso 300. La nueva escala replica los 46–54 px y peso 700 observados.

## Cards

Las cards populares originales son grandes, horizontales y completamente fotográficas, con rating, título/precio, descripción y duración dentro del overlay. Las anteriores eran cards blancas de tres columnas con cuerpo separado. Se crean cards overlay propias y un segundo tipo de card blanca para destinos.

## Buscador

El original presenta título y campos dentro de una sola superficie blanca, flotando entre el capítulo negro y el gris. El anterior separaba el título y reducía el buscador a una barra. La reconstrucción replica el bloque completo.

## Catálogo

`tour-list.html` combina hero interior, breadcrumb, buscador, tira de destinos y una composición contenido/sidebar. El catálogo anterior era el renderer genérico con filtros oscuros. Se crea DOM específico con las mismas proporciones.

## Detalle

El original sitúa título, ubicación, rating, CTA y controles sobre el hero. La galería de tres columnas comienza antes de terminar la portada. El anterior mostraba una portada independiente y luego el detalle compartido. La reconstrucción une hero y galería como el original y crea un cuerpo claro con programa vertical y sidebar.

## Panel

El panel anterior era `ExplorerBookingPanel` envuelto en colores Lavella. Se elimina esa dependencia visual. El panel nuevo conserva `priceLinePending`, depósitos, ocupación, capacidad y persistencia, pero usa labels, bordes, radios, total y botones propios.

## Navegación y footer

El drawer fullscreen anterior no aparece en el producto original. Se cambia por panel lateral. El footer anterior tenía tres columnas inventadas; el nuevo añade navegación superior y cuatro columnas, como `index.html`.
