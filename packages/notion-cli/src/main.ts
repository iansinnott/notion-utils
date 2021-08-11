#!/usr/bin/env node
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Client, LogLevel } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;

const notion = new Client({
  auth: NOTION_TOKEN,
  logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
  logger: console.error,
});

const serializers = {
  json: (x) => JSON.stringify(x, null, 2),
};

const main = async () => {
  const argv = await yargs(process.argv.slice(2))
    .command("users", "Interact with user objects", (yargs) => {
      return yargs
        .command(
          "get <uuid>",
          "Get a specific user",
          (yargs) => {
            yargs.positional("uuid", { type: "string", demandOption: false });
          },
          (argv) => {
            return notion.users
              .retrieve({ user_id: argv.uuid as string })
              .then((x) => console.log(serializers[argv.format as string](x)));
          },
        )
        .command("list", "List all users", {}, (argv) => {
          return notion.users
            .list()
            .then((x) => console.log(serializers[argv.format as string](x)));
        });
    })
    .command("status", "Check the status of your environment.", () => {
      console.log("checking...");
    })
    .options({
      format: { type: "string", alias: "f", default: "json" },
      // a: { type: "boolean", default: false },
      // b: { type: "string", demandOption: true },
      // c: { type: "number", alias: "ships" },
      // e: { type: "count" },
      // f: { choices: ["1", "2", "3"] },
    })
    .parseAsync()
    .catch((err) => {
      console.error(err.message);
      process.exit(99);
    });
};

if (require.main === module) {
  main();
}

export {};
