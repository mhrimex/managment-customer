import type { MetadataRoute } from "next";

const NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Reflection Solutions";

/**
 * Makes the site installable: "Add to Home Screen" on iPhone/iPad (Safari → Share),
 * "Install app" on Android (Chrome menu). Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${NAME} - Customer Management`,
    short_name: "Customers",
    description: "Clients, deployments, servers and employee access.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#090e1a",
    theme_color: "#090e1a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
