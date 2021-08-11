// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { Client, LogLevel } from "@notionhq/client";
import { parseBody } from "next/dist/next-server/server/api-utils";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).send({ message: "Method not allowed " + req.method });
  }

  if (req.headers["content-type"] !== "application/json") {
    return res.status(400).send({ message: "Content-Type must be application/json." });
  }

  if (!req.body.token) {
    return res.status(400).send({ message: "No token provided." });
  }

  const notion = new Client({
    auth: req.body.token,
    logLevel: LogLevel.DEBUG,
  });

  console.log(req.body.query);
  notion.search(req.body.query).then((result) => res.send(result));

  // res.status(200).json({ name: "John Doe", query: req.query, body: req.body });
}
