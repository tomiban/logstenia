# Deploy

Un único Worker (`worker/`) sirve el SPA compilado (`app/dist`) y la API `/api/*`, con
Cloudflare Access delante de todo el hostname.

## Por qué no Cloudflare Pages

El motor de sync llama a `/api/sync` en el mismo origen (`app/src/repositories/sync/engine.ts`),
y Access no puede proteger un hostname `*.pages.dev` porque exige una zona activa. Servir el
SPA como static assets del Worker satisface las dos cosas con un solo deploy, y los requests a
static assets son gratis e ilimitados.

## Requisitos

- Cuenta de Cloudflare en el plan **Workers Free** (no hace falta tarjeta).
- `wrangler` viene en `worker/node_modules`; se usa con `npx` desde `worker/`.
- Una vez: `npx wrangler login`.

## 1. Crear la base D1

```bash
cd worker
npx wrangler d1 create logstenia-sync
```

Imprime un `database_id`: reemplazá el placeholder en `worker/wrangler.toml`.

## 2. Aplicar el esquema

```bash
cd worker
npx wrangler d1 migrations apply logstenia-sync --remote
```

Crea `rows`, `meta` y deja `rev = 0`, según `worker/migrations/0001_init.sql`.

## 3. Crear la aplicación de Access

Zero Trust → **Access** → *Applications* → *Add an application* → **Self-hosted**:

| Campo | Valor |
| --- | --- |
| Application domain | `logstenia-sync.<tu-subdominio>.workers.dev` (hostname completo, sin path) |
| Session duration | 1 month |
| Policy | *Allow* / *Include* / *Emails* → tu email |

De esa aplicación salen los dos valores de Access:

- **Application Audience (AUD) Tag** — en *Overview* de la aplicación → `CF_ACCESS_AUD`.
- **Team domain** — Zero Trust → *Settings* → *Team domain*, algo como
  `logstenia.cloudflareaccess.com`; en `CF_ACCESS_TEAM` va **sólo** el prefijo (`logstenia`),
  sin `.cloudflareaccess.com`. El Worker arma la URL del JWKS solo.

## 4. Completar `worker/wrangler.toml`

Los tres valores van en el archivo (son `[vars]`, no secretos: el AUD viaja en cada JWT y el
team domain es público). `npm run deploy` se niega a correr mientras quede algún placeholder:

```bash
cd worker && npm run preflight
```

## 5. Deployar

Local:

```bash
cd app && npm run build
cd ../worker && npm run deploy
```

### Integración con GitHub (Workers Builds)

Workers & Pages → **Create** → *Worker* → *Import a repository* → `tomiban/logstenia`:

| Campo | Valor |
| --- | --- |
| Production branch | `main` |
| Root directory | `worker` |
| Build command | `npm ci && npm --prefix ../app ci && npm --prefix ../app run build` |
| Deploy command | `npm run deploy` |
| Preview builds | off |
| Build watch paths (include) | `worker/*`, `app/*` |
| Build watch paths (exclude) | `docs/*`, `odd/*`, `*.md` |

Conectar el mismo repo a un Worker no rompe un proyecto de Pages existente: la integración es
por proyecto.

Detalles que hacen fallar la configuración:

- **Root directory `worker`**: es donde viven `wrangler.toml` y el comando de deploy. Con el
  root vacío, `wrangler` no encuentra configuración y abre un PR de *automatic configuration*
  en vez de deployar este Worker.
- **`worker/` tiene que existir en la branch de producción**: si el directorio no está en
  `main`, el build muere en el primer paso.
- **Watch paths**: si los restrictís a `worker/*`, un cambio de UI no redeploya y seguís
  sirviendo un `app/dist` viejo desde `[assets]`. Por eso `app/*` también va incluido.
- **Preview builds off**: los Previews no heredan los bindings de producción (sin D1 ni
  Access), así que sólo agregan ruido.

## 6. Verificar

```bash
curl -s https://logstenia-sync.<tu-subdominio>.workers.dev/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://logstenia-sync.<tu-subdominio>.workers.dev/api/sync
```

Esperado: `{"ok":true}` y `401` (sin sesión de Access, el JWT no valida). Después, en el
navegador: entrás al hostname, pasás el OTP, la app carga, y en *Ajustes* → *Sincronización*
el sync queda en verde.

## Problemas típicos

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| `401` en `/api/sync` con sesión válida | `CF_ACCESS_AUD` de otra aplicación, o team con `.cloudflareaccess.com` | Copiar el AUD de esta app; team sin dominio |
| La app queda en "Sesión vencida" | Origen distinto (SPA servido por Pages) o sesión de Access caída | Servir el SPA desde este mismo Worker; volver a entrar |
| `429` en `/api/*` | Cuota diaria del plan Free agotada (100k requests con `run_worker_first`) | Esperar el reset diario |
| `Error 1102: Worker exceeded CPU time limit` | Superaste los 10 ms de CPU del plan Free | Bajar `MAX_MUTATIONS` / `MAX_BODY_BYTES` en `worker/src/index.ts` |
| Build verde pero la app responde 401 siempre | Se deployó con placeholders | `npm run preflight` antes de deployar |
| `database not found` en el deploy | `database_id` placeholder o de otra cuenta | Repetir el paso 1 |
| Build falla: root directory inexistente | `worker/` no está en la branch de producción | Mergear esa branch a `main` |
