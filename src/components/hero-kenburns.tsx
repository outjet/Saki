import Image from "next/image";

export function HeroKenBurns({
  images,
  title
}: {
  images: string[];
  title: string;
}) {
  const slides = images.length > 0 ? images.slice(0, 4) : ["/placeholders/hero.svg"];

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[62vh] min-h-[420px] w-full bg-ink-50">
        {slides.map((src, idx) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={`${src}-${idx}`}
            className="hero-slide absolute inset-0"
            style={{ animationDelay: `${idx * 8}s` }}
            aria-hidden={idx === 0 ? undefined : true}
          >
            <Image
              src={src}
              alt={idx === 0 ? title : ""}
              fill
              priority={idx === 0}
              className="hero-kenburns object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="container-page pb-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/80">
              Featured Property
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}

