import type { MetadataRoute } from "next";

/** Installable app: Add to Home Screen opens full screen with the monogram icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coach Console · Make Time To Move",
    short_name: "Coach Console",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#B7C0AE",
    theme_color: "#B7C0AE",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
