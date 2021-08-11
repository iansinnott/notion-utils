// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { Client, LogLevel } from "@notionhq/client";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return new Promise<void>((resolve) => {
    if (req.method !== "POST") {
      res.status(405).send({ message: "Method not allowed " + req.method });
      return resolve();
    }

    if (req.headers["content-type"] !== "application/json") {
      res.status(400).send({ message: "Content-Type must be application/json." });
      return resolve();
    }

    if (!req.body.auth) {
      res.status(400).send({ message: "No token provided." });
      return resolve();
    }

    // @note Notion can be initialized without a token. In this case, the token will be provided to the `request` method directly.
    const notion = new Client({
      logLevel: LogLevel.DEBUG,
    });

    console.log("[notion request]", req.body);

    notion
      .request(req.body)
      .then((result) => res.send(result))
      .catch((err) => res.status(err.status || 400).send(err))
      .finally(() => resolve());
  });
}
