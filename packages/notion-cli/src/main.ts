#!/usr/bin/env node
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { APIResponseError, Client, LogLevel } from "@notionhq/client";
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
const renderPropertyPlainText = (x: PropertyValue | Block) => {
  switch (x.type) {
    // @todo Below will work in many cases. Not yet aware of exceptions, although there are bound to be
    case "child_page":
      return `[${x.child_page.title}](${NotionRenderer.getLocalNotionUrl(x)})`;
    default:
      try {
        return renderRichPlainText(x[x.type].text);
      } catch (err) {
        return `<WIP ${x.type}>` + JSON.stringify(x[x.type], null, 2);
      }
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

type BlockWithChildren = Block & {
  children: APIResponseError;
};

// @todo Maybe all child fetching should happen here? The children might be paginated, so we need to build up the list over N requests.
// @todo Where is the exhaustive list of block types?
const plainTextFormatter = (x: BlockWithChildren) => {
  if (x.object !== "block") {
    console.error("Only block objects can use the plain text formatter.");
    return;
  }

  if (!x.has_children) {
    console.error("Block has no children to render");
    return;
  }

  if (!x.children) {
    console.error("No children were found on this block. Did you pass the --with_children flag?");
    return;
  }

  const children = x.children;
  let result = "";

  // @ts-ignore @todo Yeah, this is currently a list with pagination info
  for (const c of children.results) {
    result += renderPropertyPlainText(c);
    result += "\n";
  }

  return result;
};

const serializers = {
  json: (x) => JSON.stringify(x, null, 2),
  list: listFormatter,
  plain_text: plainTextFormatter,
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
          yargs.options({
            with_children: { type: "boolean", default: true },
          });
          yargs.positional("uuid", { type: "string", demandOption: false });
        },
        (argv) => {
          return Promise.all([
            notion.blocks.retrieve({ block_id: argv.uuid as string }),
            argv.with_children
              ? notion.blocks.children.list({ block_id: argv.uuid as string })
              : Promise.resolve(null),
          ]).then((x) => {
            const [block, children] = x;
            console.log(serializers[argv.format as string]({ ...block, children }));
            return x;
          });
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
