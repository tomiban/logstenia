import { describe, it, expect } from 'vitest';
import { embedUrl, thumbnailUrl } from './videos';

const video = {
  id: 'm5ehtKmixTc',
  title: 'Plancha',
  channel: 'Canal',
  url: 'https://www.youtube.com/watch?v=m5ehtKmixTc',
  thumbnail: 'https://i.ytimg.com/vi/m5ehtKmixTc/hqdefault.jpg',
};

describe('embedUrl', () => {
  it('usa el video recolectado cuando existe', () => {
    expect(embedUrl('Plancha', video)).toBe('https://www.youtube.com/embed/m5ehtKmixTc');
  });

  it('cae a la busqueda de YouTube cuando no hay video', () => {
    expect(embedUrl('Plancha')).toBe(
      'https://www.youtube.com/embed?listType=search&list=Plancha%20calistenia'
    );
  });
});

describe('thumbnailUrl', () => {
  it('devuelve el thumbnail del video', () => {
    expect(thumbnailUrl(video)).toBe('https://i.ytimg.com/vi/m5ehtKmixTc/hqdefault.jpg');
  });

  it('devuelve null cuando el ejercicio no tiene video', () => {
    expect(thumbnailUrl()).toBeNull();
  });
});
