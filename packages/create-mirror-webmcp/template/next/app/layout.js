import "./styles.css";

export const metadata = {
  title: "Private Site Tools | Mirror WebMCP Secure",
  description: "Let agents act on private website data without putting the underlying record in agent context."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          defer
          src="/mirror-webmcp-v1.js"
          data-mirror-webmcp=""
          data-site="mirror_site_procurement_demo"
          data-manifest="/.well-known/mirror-webmcp.json"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
