# Logtenia — Button system consistency

## Specs

S1. `app/src/components/ui/button.tsx` exports a `Button` whose variants match `DESIGN.md`: `accent` (Voltage Lime fill, Ink text, Ink border; hover inverts to Ink fill / Lime text), `ink` (Ink fill, Lime text), `outline` (transparent, Ink border/text; hover Ink fill / Lime text), `ghost` (no border, Muted text; hover Muted Surface fill), `destructive` (Alert), `link`. No rounded corners, no shadows, no translate-y press animation.

S2. Sizes: `xs` (h-6), `sm` (h-8), `default` (h-9), `lg` (h-11, 44px touch target), `icon`, `icon-sm`, `icon-lg`. All use `transition-colors`.

S3. All action buttons across the app use `Button` with the correct variant: primary actions (`Entrenar`, `Siguiente`, `Guardar`, `Crear`, `Agregar`, `Iniciar rutina`, `Continuar`, `Usar tiempo`, `Exportar`) use `accent`; secondary/cancel use `ghost`; navigation/active state uses `ink`; outlined actions use `outline`; destructive uses `destructive`.

S4. Raw `<button>` elements that are not action buttons (list rows in Home, segmented control in Metrics, chip remove in tags, timer controls in Runner) are normalized to design tokens and documented as named button patterns in `DESIGN.md`.

S5. `DESIGN.md` button section is updated to reflect the actual variant names and sizes, plus the named patterns. `button.tsx` carries JSDoc documenting variants, sizes, and usage rules.

S6. Build (`tsc -b && vite build`), lint (`oxlint`), and tests (`vitest run`) pass after the change.

## Tasks

T1. Rewrite `button.tsx` with DESIGN.md-aligned variants/sizes + JSDoc. (S1, S2, S5)
T2. Migrate Home actions to `accent`. (S3)
T3. Migrate Runner actions (including Cronometro) to `accent`/`outline`/`ghost`. (S3, S4)
T4. Migrate Planes actions to `accent`/`ghost`. (S3)
T5. Migrate Routine actions to `accent`/`ghost`. (S3)
T6. Migrate Skill actions. (S3)
T7. Normalize SettingsMenu buttons (trigger, Probar sonido, Exportar, Importar via ref). (S3, S4)
T8. Normalize tags-input / tags-menu buttons. (S4)
T9. Normalize Metrics segmented control classes. (S4)
T10. Normalize Home recent-sessions row button classes. (S4)
T11. Update `DESIGN.md` button section + named patterns. (S5)
T12. Run build + lint + tests; fix regressions. (S6)

## Log

L1. User request: "me gustaria dejar consistentes y documentados los botones de mi app porque no son consistentes". Decision: primary action = Voltage Lime (accent) per DESIGN.md; scope = action buttons migrated, special patterns documented.