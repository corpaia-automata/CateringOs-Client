/* eslint-disable @next/next/no-img-element */
import { firstArray, firstString, type SectionProps } from './types';

export default function Gallery({ data }: SectionProps) {
  const images = firstArray(data, ['event_images', 'gallery', 'images']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-semibold text-slate-950">Event Gallery</h2>
      {images.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
              Photo {index + 1}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {images.map((image, index) => {
            const src = typeof image === 'string' ? image : firstString(image, ['url', 'image', 'src'], '');
            if (!src) return null;
            return (
              <img
                key={`${src}-${index}`}
                src={src}
                alt={`Event photo ${index + 1}`}
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
