#!/usr/bin/env node
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Client, LogLevel } from "@notionhq/client";
import {
  APISingularObject,
  Block,
  Database,
  Page,
  PaginatedList,
  PropertyValue,
  RichText,
  User,
} from "@notionhq/client/build/src/api-types";

const NOTION_TOKEN = process.env.NOTION_TOKEN;

const notion = new Client({
  auth: NOTION_TOKEN,
  logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
  logger: console.error,
});

// For all the monorepo we've got going there's really a lot of duplicated code...
//
const renderRichPlainText = (xs: RichText[]) => {
  return xs
    .map((x) => x.plain_text)
    .filter(Boolean)
    .join(" ");
};

// Given a property value render it as plain text. Properties are found on database rows.
const renderPropertyPlainText = (x: PropertyValue) => {
  switch (x.type) {
    case "title":
      return renderRichPlainText(x.title);
    default:
      return JSON.stringify(x);
  }
};

const NotionRenderer = {
  getTitle: (obj: Page | Database | User | Block) => {
    switch (obj.object) {
      case "page":
        const titleProp = Object.values(obj.properties).find((x) => x.type === "title");
        if (!titleProp) return "<unknown>";
        return renderPropertyPlainText(titleProp);
      case "database":
        return renderRichPlainText(obj.title);
      default:
        return "bla|" + obj.object;
    }
  },

  // Get a URL to the desktop version of Notion
  getLocalNotionUrl: ({ id }: { id: string }) => {
    const idWithoutHyphens = id.replace(/-/g, "");
    return `notion:/` + idWithoutHyphens;
  },

  getNotionUrl: ({ id, url }: { id: string; url?: string }) => {
    const idWithoutHyphens = id.replace(/-/g, "");
    return url || `https://www.notion.so/` + idWithoutHyphens;
  },
};

const listFormatter = (list: PaginatedList | APISingularObject) => {
  const formatListItem = (x: PaginatedList["results"][number]) => {
    return `[${x.object}] (${x.id}) ${NotionRenderer.getTitle(x)} <${NotionRenderer.getNotionUrl(
      x,
    )}>`;
  };

  if (list.object !== "list") return formatListItem(list);

  return list.results.map(formatListItem).join("\n");
};

const serializers = {
  json: (x) => JSON.stringify(x, null, 2),
  list: listFormatter,
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
