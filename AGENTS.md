# Hogar — Guía del proyecto (para agentes)

## Qué es

Backend de **Seguro de Hogar** (`hogar`): BFF en Express 5 + TypeScript que habla con
**RUS / SIAPI** y expone el flujo de cotización y emisión de hogar al front `Yuju`.

Es el **quinto repo hermanado** del ecosistema (junto a `Yuju`, `CotizadorYuju`,
`CotizadorRus`, `yujucrm`). No confundir con el cotizador de motos (`CotizadorRus`)
pese al nombre: RUS es el proveedor aguas abajo, no el proyecto.

## Estado: corriendo en local Y en producción ✅

| Entorno | URL | Cómo corre | Desde |
|---|---|---|---|
| **Local** | `http://localhost:3002` | `pnpm dev` (nodemon + ts-node) | 19/10/2026 |
| **Producción** | `https://apiyujumove.com` | pm2 `yuju-backend` sobre `dist/server.js` | 19/10/2026 |

Ambos verificados end-to-end con un browser real: `POST /api/auth/token` → 200,
`GET .../form` → 200, UI del cotizador renderizada, cero errores de consola.

## Estructura

```
hogar/backend/
├── src/
│   ├── server.ts                       # entry: carga .env y arranca Express
│   ├── app.ts                          # CORS, rutas, error handler  ⚠️ ver CORS abajo
│   ├── routes/
│   │   ├── auth.routes.ts              # POST /api/auth/token
│   │   └── homeInsurance.routes.ts     # flujo de cotización + emisión
│   ├── controllers/homeInsurance.controller.ts
│   ├── middleware/auth.middleware.ts   # verify JWT Bearer
│   ├── services/
│   │   ├── SupabaseProvider.ts
│   │   └── providers/rus/RusProvider.ts    # integración real con SIAPI
│   └── utils/security.utils.ts         # AES-256-CBC (SECURE_ENCRYPTION_KEY)
├── .env / .env.example
└── package.json
```

## Cómo correr en local

```bash
cd hogar/backend
pnpm install
pnpm dev          # nodemon src/server.ts → http://localhost:3002
```

Smoke test rápido:

```bash
curl http://localhost:3002/health                        # → {"status":"OK"}
curl -X POST http://localhost:3002/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"clientSecret":"<CLIENT_SECRET del .env>"}'        # → {"token":"..."}
```

## Variables de entorno (`backend/.env`)

| Variable | Para qué |
|---|---|
| `PORT` | Puerto del server (**3002** en ambos entornos) |
| `RUS_API_BASE_URL` / `RUS_API_AUTH_URL` | endpoints de SIAPI |
| `RUS_USERNAME` / `RUS_PASSWORD` / `RUS_DEFAULT_PRODUCER_CODE` | credenciales de RUS |
| `SUPABASE_URL` / `SUPABASE_KEY` | persistencia |
| `JWT_SECRET` | firma del token que emite `/api/auth/token` |
| `CLIENT_SECRET` | secreto que el front manda en el body para obtener el token |
| `SECURE_ENCRYPTION_KEY` | 32 chars AES-256 — **debe coincidir** con `VITE_SECURE_ENCRYPTION_KEY` del front |
| `ALLOWED_ORIGIN` | orígenes permitidos por CORS, separados por coma |

> 🔑 Los secrets **no se editan desde el agente** (ver `Yuju/AGENTS.md`): los `.env` los
> cambia la persona a mano. Si una credencial se pega en el chat, avisar y pedir rotación.

### Config local vs producción

```
LOCAL:        ALLOWED_ORIGIN=http://localhost:5173,http://localhost:5174
PRODUCCIÓN:   ALLOWED_ORIGIN=https://yuju.com.ar,https://www.yuju.com.ar
```

Y del lado del front (`Yuju/.env`):

```
LOCAL:        VITE_HOGAR_API_URL=http://localhost:3002
PRODUCCIÓN:   VITE_HOGAR_API_URL=https://apiyujumove.com
```

⚠️ **Revertir ambos antes de cualquier build de producción** desde la PC de desarrollo.
Si no, se compila un bundle apuntando a `localhost:3002` y se rompe producción.

⚠️ **nodemon no recarga el `.env`** (`watching extensions: ts,json`). Si se toca el `.env`,
reiniciar el server a mano o tocar un `.ts` para que nodemon reinicie.

## 🔴 Lección de CORS (bug 19/10/2026 — no repetir)

**No mandar headers custom en el request a `/api/auth/token`.** El clientSecret viaja
**solo en el body**, que es lo único que lee `auth.routes.ts` (`req.body.clientSecret`).

Lo que pasó: `Yuju/src/services/unifiedApiClient.ts` mandaba además `x-client-secret` y
`X-Client-Secret` como headers "para cubrir ambos formatos". Como `app.ts` no los tenía en
`allowedHeaders`, el preflight CORS rechazaba **el request entero** → no llegaba token →
todo devolvía `401 Access denied. No token provided.`

**Esto rompió el cotizador de Hogar en producción** (`yuju.com.ar/cotizar/seguro-hogar`),
no solo en local. El header nunca lo leyó nadie: era peso muerto que alcanzaba para tumbar
el módulo entero.

Reglas derivadas:
1. Un header custom nuevo en el front **exige** agregarlo a `allowedHeaders` en `app.ts`.
   Si no, el preflight lo bloquea y el error que se ve en el navegador habla de CORS, no
   del header — fácil de diagnosticar mal.
2. Mejor **no mandar headers custom** si el dato ya viaja en el body.
3. `app.ts` tolera `x-client-secret` / `X-Client-Secret` **defensivamente**, aunque el
   backend no los lea, para que un reintento no vuelva a romper todo.
4. No usar `credentials: true` en CORS: el flujo de hogar es JWT stateless en header, no
   usa cookies (`src/` no emite ni una `Set-Cookie`). Solo agrega superficie de CSRF.

> El commit que introdujo el bug fue `22e5eda` en `Yuju` ("enviar ClientSecret en body +
> headers"). Lo revierte `65128a9`. Si alguien propone "mandarlo por las dudas en los dos
> lados", este es el por qué no.

## Auth

Flujo en dos pasos:

1. `POST /api/auth/token` con `{ clientSecret }` → devuelve un JWT de 24 h con **scope `quote`** (solo cotización).
2. El resto de `/api/insurance/home/*` exige `Authorization: Bearer <token>`
   (`middleware/auth.middleware.ts`).

El front hace esto automáticamente vía `hogarApiClient` en
`Yuju/src/services/unifiedApiClient.ts` (token cacheado en `sessionStorage` bajo la clave
`hogar_auth_token`, retry automático ante 401/403).

### Scopes quote/emission (Fix A, 21/10/2026) + rate limiting (Fix B)

El `clientSecret` vive en el bundle público → el token de `/api/auth/token` se considera
**público por diseño** y solo autoriza a cotizar. Dos capas extra protegen la emisión:

**1. Rate limiting** (`middleware/rateLimit.middleware.ts`, por IP real vía nginx):
- `POST /api/auth/token`: 30/h · cotización: 240/h · `orders/*`: 30/h
- La IP real llega por `X-Real-IP` (la setea nginx con `$remote_addr`; NO hay Cloudflare).
- Overridable por env: `RATE_LIMIT_{TOKEN,QUOTES,ORDERS}_PER_HOUR`.
- OJO: express-rate-limit **v8** no acepta la opción `validations` (era v7) — crashea al arrancar.

**2. Scopes del JWT**:
- `orders/*` pasa por `requireEmissionScope`. Con `SCOPE_ENFORCEMENT=false` (default,
  **modo actual**) solo loguea `[SCOPE] enforcement OFF` y deja pasar. Con `true` rechaza
  tokens de solo-cotización.
- La emisión legítima viaja con **token de sesión Supabase anónima** (el front lo obtiene
  con `signInAnonymously` — requiere "anonymous sign-ins" habilitado en Supabase, ya activo).
  `authenticateToken` acepta: JWT propio (local) o token Supabase (verificado con
  `SUPABASE_URL`/`SUPABASE_KEY`) → este último equivale a scope `emission` + uid trazable.
- **Rollout acordado**: observar logs `[SCOPE] ... token=supabase` en prod unos días tras
  emisiones reales → recién entonces la persona setea `SCOPE_ENFORCEMENT=true` en el `.env`
  del server a mano + `pm2 restart`. Reversible en un reinicio.

## Endpoints principales

```
# Cotización (3 pasos, no requiere campaña)
GET  /api/insurance/home/objects
GET  /api/insurance/home/objects/:objectCode/indicios
GET  /api/insurance/home/objects/:objectCode/indicios/:indicioCode/form
POST /api/insurance/home/objects/:objectCode/indicios/:indicioCode/form/submit
     body: { answers: { [codigoPregunta]: valor }, consultaId? }  → { consultaId }
GET  /api/insurance/home/consultas/:consultaId/planes

# Emisión ⚠️ crea órdenes REALES en SIAPI — no testear a la ligera
POST /api/insurance/home/orders/create
POST /api/insurance/home/orders/:ordenVentaId/datocliente
POST /api/insurance/home/orders/:ordenVentaId/form/submit
POST /api/insurance/home/orders/:ordenVentaId/infopago
POST /api/insurance/home/orders/:ordenVentaId/confirm
```

⚠️ **Validación pendiente**: `submitFormAnswers` hace destructuring de `req.body` sin
validar y `RusProvider` cae en `Object.entries(answers)`. Si falta `answers` responde
`500 {"error":"RUS API Error"}` en vez de un `400` claro. Mismo patrón en
`getPlansByConsultaId` / `createOrder`. Candidato a fix.

## Ramas y deploy a producción

- Rama de release: **`produccion-octubre`** (creada el 19/10/2026 desde `main`).
- Repo: `github.com/NimbusSeguros/hogar.git`.
- VPS: **apiyujumove.com** (`72.61.34.195`, Hostinger VM `1251331`) → `/var/www/hogar`.

```bash
# 1. En el server: preservar cambios locales si los hay (¡SIEMPRE mirar git status antes!)
cd /var/www/hogar && git status --short

# 2. Traer la rama
git fetch origin && git checkout produccion-octubre && git pull

# 3. DEPENDENCIAS (si el deploy agrega/saca deps — saltarlo rompe el server:
#    502 el 21/10/2026 por falta de express-rate-limit) + COMPILAR
cd backend && pnpm install --frozen-lockfile && npx tsc
# (pm2 corre dist/, no ts-node. Sin compilar "no pasa nada")

# 4. Reiniciar
pm2 restart yuju-backend

# 5. Verificar
curl -s https://apiyujumove.com/health
```

⚠️ **Detalles del deploy que ya costaron tiempo:**
- **`pnpm install` ANTES de `tsc`** cuando el commit toca `package.json` — un `tsc` sin
  su dependencia emite JS roto igual y pm2 lo levanta → 502.
- **No encadenar con `| tail` a ciegas**: el pipe devuelve el exit code de `tail` (0) y
  un `tsc` fallido no corta la cadena `&&`. Verificar el paso o usar `set -o pipefail`.

⚠️ **Detalles del deploy que ya costaron tiempo:**
- pm2 corre **`dist/server.js` compilado** (`exec cwd /var/www/hogar/backend`). Un `pull`
  sin `tsc` deja corriendo el JS viejo y parece que el fix no funcionó.
- El server clona **`main`** por default. Al deployar `produccion-octubre` hay que hacer
  checkout explícito, si no el push a GitHub no cambia nada en producción.
- El `.env` del server (`/var/www/hogar/backend/.env`) **está fuera de git**: un deploy
  nunca lo pisa.
- **Regla de oro del ecosistema**: antes de deployar, revisar `git status` en el server.
  Las VPS tienen historial de hotfixes sin commitear. Lo que se encuentre se **preserva**
  (idealmente commiteándolo al repo) y se decide con la persona, nunca se pisa a ciegas.
  Ejemplo real: el 19/10/2026 había `credentials: true` sin commitear en `app.ts`; se
  guardó con `git stash push` antes del deploy → `stash@{0}` en el server.

## 🔒 Hardening de la VPS (21/10/2026)

Tres capas sobre `apiyujumove.com` — verificadas en producción:

1. **nginx** (`/etc/nginx/sites-enabled/apiyujumove.com`):
   - Pasa `X-Real-IP` + `X-Forwarded-For` al backend (sin esto el rate limit agrupa a
     todos los usuarios en un solo bucket).
   - `limit_req` como escudo: zonas en `/etc/nginx/conf.d/ratelimit-zones.conf`
     (token 10r/m, orders 30r/m, api 60r/m — tasas generosas, el límite fino lo hace la app).
   - **Los backups de configs nginx van a `/etc/nginx/backups/`**, NUNCA en
     `sites-enabled/` (nginx los carga también → "conflicting server name").
2. **ufw** (firewall de SO): default deny incoming, solo 22/80/443. El puerto 3002 del
   backend NO se expone (evita bypass de nginx + spoof de headers).
3. **Firewall del panel Hostinger** (grupo 365471, compartido por TODAS las VPS):
   - SSH (22) solo desde una IP fija de la persona · 443 abierto · 8888 (terminal web) abierto.
   - ⚠️ **Puerto 80 BLOQUEADO** → las renovaciones de Let's Encrypt por HTTP-01 fallarían.
     Verificar vencimientos (`certbot certificates`) y decidir si se agrega la regla 80.

Snapshot previo a deploys riesgosos: vía MCP `hostinger-vps` (⚠️ un solo slot — pisa el anterior).

## Smoke test post-deploy

```bash
curl https://apiyujumove.com/health
curl -i -X OPTIONS https://apiyujumove.com/api/auth/token \
  -H 'Origin: https://yuju.com.ar' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-client-secret'
# debe volver 204 con access-control-allow-origin: https://yuju.com.ar
# y access-control-allow-headers incluyendo x-client-secret
```

El test definitivo es abrir `https://yuju.com.ar/cotizar/seguro-hogar` en un browser real y
ver la consola limpia con el paso 1 cargado. Ojo con tener varias tabs de la misma URL
abiertas al verificar: la consola de una tab vieja puede mostrar errores precargados y
hacer creer que el deploy falló.

## Verificación (este repo no tiene tests)

| Comando | Qué valida |
|---|---|
| `npx tsc --noEmit` | tipos |
| `pnpm dev` + smoke test `/health` | que arranca |
| flujo manual `auth → objects → form → submit → planes` | integración con SIAPI |

No hay suite de tests ni CI en este repo (igual que sus hermanos). La verificación es
manual: `tsc` + smoke test + flujo de cotización completo.
