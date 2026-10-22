import { useState } from 'react';
import { X } from 'lucide-react';
import type { ExerciseVideo } from '@/types';
import { embedUrl } from '@/lib/videos';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function Video({ query, video }: { query: string; video?: ExerciseVideo }) {
  const [open, setOpen] = useState(false);
  const embed = embedUrl(query, video);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-12 items-center justify-center border border-border bg-secondary text-muted-foreground hover:text-ink hover:border-ink transition-colors"
        aria-label={`${video ? 'Ver' : 'Buscar'} video de ${query} en YouTube`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-none border border-border p-0 shadow-none ring-0 sm:max-w-5xl">
          <DialogClose
            aria-label="Cerrar video"
            className="absolute right-2 top-2"
            render={<Button variant="ink" size="icon-sm" />}
          >
            <X aria-hidden="true" />
          </DialogClose>
          <div className="aspect-video w-full overflow-hidden bg-black">
            <iframe
              src={`${embed}${embed.includes('?') ? '&' : '?'}autoplay=1`}
              title={`Video de ${query}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
