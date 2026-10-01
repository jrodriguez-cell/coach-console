/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "exceljs"],
    // pdfkit loads its built-in fonts via a dynamic `require("#standard-fonts/*")`
    // that file tracing can't follow, so ship them explicitly with the PDF routes.
    outputFileTracingIncludes: {
      "/api/plans/[planId]/export/pdf": ["./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/plans/[planId]/export/week": ["./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/clients/[id]/progress-report": ["./node_modules/pdfkit/js/standard-fonts/**"],
    },
  },
  async headers() {
    // Private tool: never index, never cache health data in shared caches.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
