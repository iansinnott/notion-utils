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
    .command(
      "search",
      "Search objects accessible to your token",
      (yargs) => {
        yargs.options({
          query: { type: "string", default: "" },
          sort_direction: { choices: ["ascending", "descending"], default: "descending" },
          sort_timestamp: { choices: ["last_edited_time"], default: "last_edited_time" },
          start_cursor: { type: "string" },
        });
      },
      (argv) => {
        // We ignore sort_timestamp for now since its unused in the api
        const { query, sort_direction, sort_timestamp, start_cursor } = argv;
        return notion
          .search({
            query: query as string,
            sort: {
              direction: sort_direction as "ascending" | "descending",
              timestamp: "last_edited_time",
            },
            start_cursor: start_cursor as string | undefined,
          })

          .then((x) => console.log(serializers[argv.format as string](x)));
      },
    )
    .command("databases", "Interact with database objects", (yargs) => {
      return yargs.command(
        "get <uuid>",
        "Get a specific database",
        (yargs) => {
          yargs.positional("uuid", { type: "string", demandOption: false });
        },
        (argv) => {
          return notion.databases
            .retrieve({ database_id: argv.uuid as string })
            .then((x) => console.log(serializers[argv.format as string](x)));
        },
      );
    })
    .command("pages", "Interact with page objects", (yargs) => {
      return yargs.command(
        "get <uuid>",
        "Get a specific page",
        (yargs) => {
          yargs.positional("uuid", { type: "string", demandOption: false });
        },
        (argv) => {
          return notion.pages
            .retrieve({ page_id: argv.uuid as string })
            .then((x) => console.log(serializers[argv.format as string](x)));
        },
      );
    })
    .command("blocks", "Interact with block objects", (yargs) => {
      return yargs.command(
        "get <uuid>",
        "Get a specific block",
        (yargs) => {
          yargs.positional("uuid", { type: "string", demandOption: false });
        },
        (argv) => {
          return notion.blocks
            .retrieve({ block_id: argv.uuid as string })
            .then((x) => console.log(serializers[argv.format as string](x)));
        },
      );
    })
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
