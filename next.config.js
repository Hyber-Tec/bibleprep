/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Everything runs in the browser (Firebase is called from the client), so a production build is plain
  // static files in `out/` for Firebase Hosting. `next dev` stays an ordinary dev server, where URLs such
  // as /studies/<id> work without being listed first.
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
};

module.exports = nextConfig;
