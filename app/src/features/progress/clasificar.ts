// Clasificación de ejercicios por nombre (port de clasificar.js de la referencia).
// Heurística por palabras clave sobre el nombre crudo del PDF.

const SKILLS: { sub: string; rx: RegExp }[] = [
  { sub: 'planche', rx: /planche|lean|hefesto|pseudo/i },
  { sub: 'front lever', rx: /\bfront\b|\bfl\b|full|tuck|adv\.?\s*fl/i },
  { sub: 'pino', rx: /\bpino\b|handstand/i },
]

const BASICOS: { sub: string; rx: RegExp }[] = [
  { sub: 'empuje', rx: /flexion|flex\.|\bflex\b|fondo|\bpike\b|\bpica\b|press|dip/i },
  { sub: 'tirón', rx: /dominada|pull|remo|row|curl|biceps/i },
  { sub: 'pierna', rx: /sentadilla|pistol|pistola|zancada|lanzada|puente|femoral|gemelo|sissy|camar|predicador|salto/i },
  { sub: 'core', rx: /leg raise|hollow|plank|plancha|crunch|mountain|dragon flag|l sit|\bpl\b|rodilla|elevaciones de piernas|pies a la barra|touch to bar|impossible/i },
]

export type Grupo = 'skill' | 'basico'
export type Subgrupo = 'planche' | 'front lever' | 'pino' | 'empuje' | 'tirón' | 'pierna' | 'core' | 'otros'
export type Clasificacion = { grupo: Grupo; sub: Subgrupo }

export function clasificar(texto: string = ''): Clasificacion {
  const t = String(texto).toLowerCase()
  for (const s of SKILLS) if (s.rx.test(t)) return { grupo: 'skill', sub: s.sub as Subgrupo }
  for (const b of BASICOS) if (b.rx.test(t)) return { grupo: 'basico', sub: b.sub as Subgrupo }
  return { grupo: 'basico', sub: 'otros' }
}

const A_EMFASIS: Record<string, 'empuje' | 'tirón' | 'pierna'> = {
  planche: 'empuje',
  pino: 'empuje',
  'front lever': 'tirón',
  empuje: 'empuje',
  'tirón': 'tirón',
  pierna: 'pierna',
}

export type Enfasis = 'empuje' | 'tirón' | 'mixto' | 'pierna'

// Énfasis de una lista de nombres de ejercicio: respeta mayoría (>=60%).
export function enfasisDeEjercicios(nombres: string[]): Enfasis {
  const c = { empuje: 0, 'tirón': 0, pierna: 0 }
  let total = 0
  for (const n of nombres) {
    const r = clasificar(n)
    const key = r.grupo === 'skill' ? r.sub : r.sub
    const e = A_EMFASIS[key]
    if (e) {
      c[e]++
      total++
    }
  }
  if (!total) return 'mixto'
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]
  return top[1] / total >= 0.6 ? (top[0] as Enfasis) : 'mixto'
}

export const ENFASIS_OPCIONES: Enfasis[] = ['empuje', 'tirón', 'mixto', 'pierna']
