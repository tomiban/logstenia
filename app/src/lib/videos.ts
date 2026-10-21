import type { ExerciseVideo } from '../types';

/**
 * Embed URL for an exercise: the collected video when there is one, a YouTube
 * search otherwise.
 */
export function embedUrl(query: string, video?: ExerciseVideo): string {
  if (video?.id) return `https://www.youtube.com/embed/${video.id}`;
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(`${query} calistenia`)}`;
}

/** Thumbnail image URL for an exercise, when one was collected. */
export function thumbnailUrl(video?: ExerciseVideo): string | null {
  return video?.thumbnail ?? null;
}
