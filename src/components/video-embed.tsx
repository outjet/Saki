import type { PropertyMedia } from "@/lib/types";

export function VideoEmbed({ video }: { video: PropertyMedia["video"] }) {
  if (!video) return null;

  return (
    <div className="card overflow-hidden">
      {video.embedUrl ? (
        <div className="relative aspect-video bg-black">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={video.embedUrl}
            title={video.title ?? "Property video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : video.mp4Url ? (
        <video
          className="w-full"
          controls
          preload="metadata"
          poster={video.posterUrl}
        >
          <source src={video.mp4Url} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}

