import type { ExerciseVideo } from '../types';
import { thumbnailUrl } from '../lib/videos';

export default function Video({ query, video }: { query: string; video?: ExerciseVideo }) {
  const thumb = thumbnailUrl(video);
  const url = video?.url;

  if (thumb && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-9 w-16 shrink-0 overflow-hidden border border-[var(--border)] bg-[var(--muted-surface)] hover:border-[var(--ink)] transition-colors"
        aria-label={`Ver video de ${query} en YouTube`}
      >
        <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/40">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </a>
    );
  }

  return (
    <a
      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' calistenia')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 w-12 items-center justify-center border border-[var(--border)] bg-[var(--muted-surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
      aria-label={`Buscar video de ${query} en YouTube`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    </a>
  );
}
