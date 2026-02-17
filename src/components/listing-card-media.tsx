import Image from "next/image";
import type { PropertyFront } from "@/lib/types";

export function ListingCardMedia({ property }: { property: PropertyFront }) {
  const src = property.heroImage ?? "/placeholders/hero.svg";
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-ink-50">
      <Image
        src={src}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 50vw"
        priority={false}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      {property.headline ? (
        <div className="absolute bottom-4 left-4 right-4">
          <p className="line-clamp-2 text-sm font-medium text-white/95 drop-shadow">
            {property.headline}
          </p>
        </div>
      ) : null}
    </div>
  );
}

