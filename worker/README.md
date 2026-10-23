# Worker de sincronización

Un solo Worker sirve el SPA compilado (`../app/dist`) y la API `/api/*`. La persistencia
compartida es D1; la autenticación la aporta Cloudflare Access. El diseño completo está en
`design-plans/backend-sync.md` y el deploy en `docs/DEPLOY.md`.

## Scripts

```bash
npm install
npm run dev          # wrangler dev en http://localhost:8787 (con bypass de Access)
npm test             # vitest
npm run lint         # oxlint
npm run typecheck    # tsc --noEmit
npm run deploy       # preflight + wrangler deploy (aborta con placeholders)
```

## Desarrollo local

Dos procesos, y la app le pega a la API a través del proxy de Vite:

```bash
# terminal 1
cd worker && npx wrangler d1 migrations apply logstenia-sync --local   # una sola vez
cd worker && npm run dev                                              # :8787

# terminal 2
cd app && npm run dev                                                 # :5173, proxy /api -> :8787
```

`npm run dev` pasa `--var SYNC_DEV_NO_AUTH:true`, así que el Worker acepta requests de
loopback sin sesión de Access. El bypass exige las dos condiciones a la vez:

- `SYNC_DEV_NO_AUTH` exactamente `"true"`, y
- host de loopback (`localhost`, `127.0.0.1`, `::1`).

Ninguna se cumple en producción: la variable **no** está en `wrangler.toml` y la pasa solo el
script `dev`, mientras que `wrangler deploy` no toma flags de `dev`. Un Worker deployado
sigue fallando cerrado (401) ante cualquier request sin JWT. Para confirmar cuál de los dos
modos está activo, `GET /api/health` responde `{"ok":true,"devAuthBypass":true}` únicamente
con el bypass activo; en cualquier otro caso responde `{"ok":true}`.

## Migraciones

`migrations/0001_init.sql` crea `rows`, `meta` y deja `rev = 0`. Las migraciones se aplican
con `--local` en desarrollo y `--remote` en producción:

```bash
npx wrangler d1 migrations apply logstenia-sync --local
npx wrangler d1 migrations apply logstenia-sync --remote
```

## Pruebas

`test/sync.test.ts` corre contra un D1 falso que registra los statements, así que verifica el
SQL real (chunking de 25 pares, asignación posicional de `rev`, upserts) sin red.
`test/preflight.test.ts` cubre el gate de deploy.
