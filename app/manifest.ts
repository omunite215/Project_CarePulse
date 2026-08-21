import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CarePulse — Patient & Appointment Management",
    short_name: "CarePulse",
    description:
      "Patient intake and appointment management for small clinics.",
    start_url: "/",
    display: "standalone",
    background_color: "#131619",
    theme_color: "#24ae7c",
    icons: [
      { src: "/assets/icons/logo-icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  };
}
