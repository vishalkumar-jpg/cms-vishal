import * as React from "react";
import { applyRootBlockStyles, sanitizeUrl } from "../lib";
import { resolveVideoUrl } from "@ob-cms/block-schema";

/* ---- Video ------------------------------------------------------- */
/**
 * Plays either a direct video file URL (native `<video>`) or a YouTube/Vimeo
 * link (sanitized, sandboxed iframe built from the pasted URL via
 * `resolveVideoUrl`). `mode: "background"` makes the media cover its container
 * (object-fit:cover, no controls, muted+loop forced) for hero backgrounds.
 *
 * SSR-safe: no window/document at module load or render; the embed URL is
 * derived by a pure helper so the builder canvas and the SSR renderer are
 * byte-identical.
 */
export const Video = React.forwardRef<
  HTMLDivElement,
  {
    src?: string;
    poster?: string;
    provider?: "auto" | "file" | "youtube" | "vimeo";
    mode?: "inline" | "background";
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
    styles?: unknown;
  }
>(({
  src,
  poster,
  provider = "auto",
  mode = "inline",
  autoplay = false,
  loop = false,
  muted = false,
  controls = true,
  styles,
}, ref) => {
  const resolved = applyRootBlockStyles(styles);
  const isBackground = mode === "background";
  const wrapStyle: React.CSSProperties = isBackground
    ? { position: "absolute", inset: 0, overflow: "hidden", boxSizing: "border-box", zIndex: 0, ...resolved }
    : { position: "relative", width: "100%", boxSizing: "border-box", ...resolved };

  if (!src || !sanitizeUrl(src)) {
    return (
      <div
        ref={ref}
        className="cms-video cms-video--empty"
        style={applyRootBlockStyles(styles, {
          structural: { boxSizing: "border-box", textAlign: "center" },
          defaults: {
            padding: 24,
            border: "1px dashed #cbd5e1",
            borderRadius: 8,
            color: "#94a3b8",
            fontSize: 14,
            backgroundColor: "#f8fafc",
          },
        })}
      >
        Add a video URL (YouTube, Vimeo, or .mp4) in the panel
      </div>
    );
  }

  const { provider: kind, embedUrl } = resolveVideoUrl(src, provider);

  // Background videos must autoplay silently and loop; force those.
  const bg = isBackground;
  const wantAutoplay = autoplay || bg;
  const wantMuted = muted || bg || wantAutoplay; // autoplay requires muted
  const wantLoop = loop || bg;
  const wantControls = bg ? false : controls;

  if (kind === "youtube" || kind === "vimeo") {
    const params = new URLSearchParams();
    if (wantAutoplay) params.set("autoplay", "1");
    if (wantMuted) params.set(kind === "youtube" ? "mute" : "muted", "1");
    if (wantLoop) params.set("loop", "1");
    if (bg || !wantControls) params.set("controls", "0");
    const finalSrc = params.toString() ? `${embedUrl}?${params.toString()}` : embedUrl;
    const frameStyle: React.CSSProperties = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: 0,
    };
    return (
      <div ref={ref} className="cms-video cms-video--embed" style={wrapStyle}>
        <div style={bg ? { position: "absolute", inset: 0 } : { position: "relative", paddingTop: "56.25%" }}>
          <iframe
            src={finalSrc}
            title="Video"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            style={frameStyle}
          />
        </div>
      </div>
    );
  }

  // Direct video file.
  const videoStyle: React.CSSProperties = bg
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
    : { width: "100%", height: "auto", display: "block", borderRadius: 8 };
  return (
    <div ref={ref} className="cms-video cms-video--file" style={wrapStyle}>
      <video
        src={sanitizeUrl(src)}
        poster={poster ? sanitizeUrl(poster) : undefined}
        autoPlay={wantAutoplay}
        loop={wantLoop}
        muted={wantMuted}
        controls={wantControls}
        playsInline
        preload="metadata"
        style={videoStyle}
      />
    </div>
  );
});
Video.displayName = "Video";
