# Fu Travel OS

Demo funcional multiagencia construida como un único proyecto. Incluye sitio público, catálogo, detalle, selección de salidas y abordajes, carrito, checkout de seis pasos, confirmación, WhatsApp, panel de agencia y superadministración visual.

## Desarrollo

```bash
npm install
npm run dev
```

Pruebas demo:

- `http://localhost:3000/?tenant=furiver&theme=explorer`
- `http://localhost:3000/?tenant=furiver&theme=lavella`
- `http://localhost:3000/?tenant=crisenix&theme=lavella`
- Agregar `&view=admin` para abrir el panel.

## Arquitectura

- `app/`: App Router, rutas públicas y metadata noindex.
- `components/`: interfaz pública, reserva, checkout y administración.
- `data/demo/`: dos agencias, dominios, puntos, destinos, salidas y viajes demo.
- `lib/tenancy/`: resolución segura por dominio, subdominio, query demo y fallback.
- `lib/catalog/`: filtros y ordenación.
- `lib/pricing/`: recálculo confiable y validación del carrito.
- `lib/whatsapp/`: mensajes dinámicos, sin apertura automática.
- `types/`: contratos de dominio preparados para una futura capa Supabase.
- `tests/`: pruebas unitarias de tenancy, catálogo, precios, puntos y carrito.

La persistencia actual usa almacenamiento local únicamente para preferencias y carrito demo. No hay autenticación, pagos, IA, proveedores externos, Supabase, migraciones ni PII real.
