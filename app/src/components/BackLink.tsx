import type { ReactNode } from 'react';
import { Link, type To } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type BackLinkProps = {
  to: To;
  children: ReactNode;
};

export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-ink">
      <ArrowLeft aria-hidden="true" size={16} />
      {children}
    </Link>
  );
}
