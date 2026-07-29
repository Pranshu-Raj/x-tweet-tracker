/** @type {import('next').NextConfig} */
const nextConfig = {
  // node:sqlite is a Node.js built-in and is externalized automatically.
  // Route handlers and server components run in the Node runtime, where it is available.
  reactStrictMode: true,
};

export default nextConfig;
