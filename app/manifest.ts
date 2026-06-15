import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TCGen-Buddy",
    short_name: "TCGen-Buddy",
    description: "AI-powered quality assurance and test generation platform",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b2f4a",
    icons: [
      {
        src: "/assets/logo/tcgen-buddy-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/assets/logo/tcgen-buddy-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
