import "./styles.css";

export const metadata = {
  title: "Private Procurement | Mirror WebMCP Secure",
  description: "A two-agent WebMCP transaction that keeps buyer constraints out of agent context."
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
