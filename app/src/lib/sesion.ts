// Port de sesion.js: pasos de una sesión y claves para el log.
export interface Paso {
  b: any;
  p: any;
}

export const pasosDe = (ses: any): Paso[] =>
  (ses?.blocks || ses?.bloques || []).flatMap((b: any) =>
    (b.prescriptions || b.prescripciones || [])
      .filter((p: any) => p.confidence !== 'nota' && p.confianza !== 'nota')
      .map((p: any) => ({ b, p }))
  );

export const clavePaso = ({ b, p }: Paso): string => `${b.orden ?? b.order ?? 0}#${p.orden ?? p.order ?? 0}`;

export function mismaFila(l: any, ctx: { sesionId: string; bloqueOrden: number; orden: number; ejercicio: string; fecha: string }): boolean {
  if (l.sesion_id !== ctx.sesionId || l.ejercicio !== ctx.ejercicio || l.fecha !== ctx.fecha) return false;
  return l.bloque_orden == null || (l.bloque_orden === ctx.bloqueOrden && l.orden === ctx.orden);
}

export const ctxDe = (sesId: string, bloque: any, p: any, fecha: string) => ({
  sesionId: sesId,
  bloqueOrden: bloque.orden ?? bloque.order ?? 0,
  orden: p.orden ?? p.order ?? 0,
  ejercicio: p.ejercicio_texto ?? p.name ?? p.ejercicio ?? '',
  fecha,
});
