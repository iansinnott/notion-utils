import type { NextApiRequest, NextApiResponse } from "next";
import { createProxyMiddleware } from "http-proxy-middleware";

// This API route exists solely to proxy requests to Notions API. They don't
// currently support cors, so we need a way to hit the API from the browser.
// For more context on all this proxy business see: https://github.com/vercel/next.js/discussions/14057

// Create proxy instance outside of request handler function to avoid unnecessary re-creation
const apiProxy = createProxyMiddleware({
  target: "https://api.notion.com",
  changeOrigin: true,
  pathRewrite: { [`^/api/notion`]: "" },
  secure: true,
  logLevel: "debug",
});

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("Here we go. Off to fetch some notions", req.method, req.url);
  // @ts-ignore - ts doesnt think this is callable
  apiProxy(req, res);
}
