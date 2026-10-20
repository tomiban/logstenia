import { Link } from 'react-router-dom';
import { getCategories } from '../lib/plans';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Planes() {
  const cats = getCategories();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight font-heading">Planes</h1>
        <p className="label-caps text-[var(--muted)]">progresiones por categoría</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map(c => (
          <Link key={c.id} to={`/skill/${c.id}`} className="block">
            <Card className="p-4 h-full hover:border-[var(--ink)] transition-colors">
              <h2 className="font-semibold">{c.name}</h2>
              <p className="text-xs text-[var(--muted)] mt-1">{c.description}</p>
              <div className="mt-2 flex gap-2">
                <Badge variant="default">{c.programs.length} progresiones</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
