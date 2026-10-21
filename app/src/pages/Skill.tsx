import { useParams, Link } from 'react-router-dom';
import { getCategories } from '../lib/plans';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'principiante',
  intermediate: 'intermedio',
  advanced: 'avanzado',
};

export default function Skill() {
  const { id } = useParams();
  const cat = getCategories().find(c => c.id === id);
  if (!cat) return <p>Categoría no encontrada.</p>;
  return (
    <div className="space-y-6">
      <header>
        <Link to="/" className="label-caps text-[var(--muted)] hover:text-[var(--ink)]">← Volver</Link>
        <h1 className="text-3xl font-extrabold tracking-tight font-heading mt-2">{cat.name}</h1>
        <p className="text-[var(--muted)]">{cat.description}</p>
      </header>
      {cat.programs.length === 0 && (
        <p className="text-sm text-[var(--muted)]">Sin progresiones curadas aún.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cat.programs.map(p => (
          <Link key={p.id} to={`/program/${p.id}`} className="block">
            <Card className="p-4 h-full hover:border-[var(--ink)] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{LEVEL_LABEL[p.level] ?? p.level}</p>
                </div>
                {p.optional && <Badge variant="secondary">Opcional</Badge>}
              </div>
              <div className="mt-2 flex gap-2">
                <Badge variant="default">{p.models.length} rutinas</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
