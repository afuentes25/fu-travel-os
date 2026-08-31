# Customer Email OTP — Supabase setup

Fu Travel OS usa Email OTP como acceso principal del modal de cliente. El
código se verifica dentro del modal; el correo no concede acceso ni crea una
cuenta de agencia hasta que Supabase haya emitido una sesión válida.

## URLs permitidas

En Supabase Auth configure:

- **Site URL de producción:** `https://travel.fu.land`
- **Redirect URL de producción (fallback de contraseña/enlace):**
  `https://travel.fu.land/cuenta/auth/callback`
- **Redirect URL local:** `http://localhost:3000/cuenta/auth/callback`

Defina también `NEXT_PUBLIC_SITE_URL=https://travel.fu.land` en producción.
La aplicación rechaza `localhost` y cualquier origen controlado por la
petición para callbacks de producción: si falta esa variable, el fallback de
contraseña falla de forma segura. No incluya secretos en esta variable.

## Plantilla Email OTP

Habilite Email OTP y configure la plantilla de código de Supabase para incluir
el token oficial `{{ .Token }}`. Copy recomendado:

> **Tu código de Fu Travel OS**
>
> Usa este código para acceder a tu cuenta: **{{ .Token }}**
>
> Si no solicitaste este código, puedes ignorar este correo.

El acceso principal no depende de `{{ .ConfirmationURL }}`. Ese enlace puede
mantenerse en las plantillas de confirmación de registro por contraseña, que
siguen siendo un fallback compatible. La plantilla es genérica de Fu Travel OS:
Supabase no recibe de forma segura el branding dinámico de cada agencia en
este flujo.

## Semántica y límites

- `signInWithOtp` se ejecuta con `shouldCreateUser: true` únicamente desde la
  entrada neutral de cliente; así el mismo flujo atiende cuentas nuevas y
  existentes sin enumerarlas antes de verificar el código.
- El fallback de contraseña continúa siendo login-only y no crea usuarios.
- El reenvío queda sujeto a los límites de Supabase y a un cooldown local de
  60 segundos. No se reintenta automáticamente.
- OTP, contraseña, tokens, cookies, nombres y teléfonos no se guardan en URL
  ni almacenamiento local.
