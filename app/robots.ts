import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Patient records and the admin dashboard have no business in a search
      // index, even in demo mode.
      disallow: ["/admin", "/api/", "/patients/"],
    },
  };
}
