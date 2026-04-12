import withPWA from "next-pwa";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const defaultCache = require("next-pwa/cache");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon.svg",
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/firebase\.googleapis\.com\/.*/i,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
      handler: "NetworkOnly",
    },
    ...defaultCache,
  ],
})(nextConfig);
