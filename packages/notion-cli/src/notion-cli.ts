#!/usr/bin/env node
import yargs from "yargs/yargs";
import { APIResponseError, Client, LogLevel } from "@notionhq/client";
import {
  APISingularObject,
  Block,
  Database,
  Filter,
  Page,
  PaginatedList,
  PropertyValue,
  RichText,
  SearchFilter,
  Sort,
  User,
} from "@notionhq/client/build/src/api-types";
import assert from "assert";

const NOTION_TOKEN = process.env.NOTION_TOKEN;

const getClient = ({ verbose }: { verbose?: any }) =>
  new Client({
    auth: NOTION_TOKEN,
    logLevel: verbose ? LogLevel.DEBUG : LogLevel.WARN,
    logger: console.error,
  });

// For all the monorepo we've got going there's really a lot of duplicated code...
//
const renderRichPlainText = (xs: RichText[]) => {
  assert(xs && xs.map, "renderRichPlainText was not passed a map. " + xs);
  return xs
    .map((x) => x.plain_text)
    .filter(Boolean)
    .join(" ");
};

// Given a property value render it as plain text. Properties are found on database rows.
const renderPropertyPlainText = (x: PropertyValue | Block) => {
  switch (x.type) {
    case "title":
      return renderRichPlainText(x[x.type]);
    case "child_page":
      return `[${x.child_page.title}](${NotionRenderer.getLocalNotionUrl(x)})`;
    case "unsupported":
      console.error(`[warn] Omitting unsupported block : ${x.id}`);
      return "";
    default:
      try {
        return renderRichPlainText(x[x.type].text);
      } catch (err) {
        console.error(err);
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

const argv = yargs(process.argv.slice(2))
  .alias("help", "h")
  // search
  .command(
    "search",
    "Search objects accessible to your token. Leave query empty to return everything.\nResults are paginated. Use the --start_cursor flag to fetch more.",
    (yargs) => {
      yargs.alias("help", "h");
      yargs.options({
        query: { type: "string", default: "" },
        start_cursor: { type: "string" },

        // Both of these options are JSON, but i'm not sure of a more clean way to pass them as such so its just a string.
        filter: {
          type: "string",
          description: `JSON filter object. Example, only return databases: \`--filter '{"property":"object","value":"database"}'\``,
        },
        sort: {
          type: "array",
          default: ['{"timestamp":"last_edited_time","direction":"descending"}'],
          description:
            'Stringified JSON sort object. Can be specified multiple times. Example: `--sort \'{"timestamp":"created_time","direction":"ascending"}\'`',
        },
      });
    },
    (argv) => {
      // We ignore sort_timestamp for now since its unused in the api
      const { query, start_cursor } = argv;
      let { sort, filter } = argv;

      try {
        if (sort) {
          sort = (sort as string[]).map((x) => JSON.parse(x));
        }
        if (filter) {
          filter = JSON.parse(filter as string);
        }
      } catch (err) {
        console.error(err);
        return;
      }

      return getClient({ verbose: argv.verbose })
        .search({
          query: query as string,
          // @ts-ignore
          sort: sort[0], // @note Unlike the databaase query, the search query uses a single sort object
          filter: filter as SearchFilter | undefined,
          start_cursor: start_cursor as string | undefined,
        })

        .then((x) => console.log(serializers[argv.format as string](x)));
    },
  )

  // databases
  .command(
    "databases",
    "Interact with individual databases. If you want to list databases use the `search` command.",
    (yargs) => {
      yargs.alias("help", "h");
      return yargs
        .command(
          "query <uuid>",
          "Query a specific database",
          (yargs) => {
            yargs.positional("uuid", {
              type: "string",
              demandOption: "You must provide a notion uuid.",
            });
            yargs.options({
              start_cursor: { type: "string" },
              // Both of these options are JSON, but i'm not sure of a more clean way to pass them as such so its just a string.
              filter: {
                type: "string",
                description: `JSON filter object. Example, only return databases: \`--filter '{"property":"object","value":"database"}'\``,
              },
              sort: {
                type: "array",
                default: ['{"timestamp":"last_edited_time","direction":"descending"}'],
                description:
                  'Stringified JSON sort object. Can be specified multiple times. Example: `--sort \'{"timestamp":"created_time","direction":"ascending"}\'`',
              },
            });
          },
          (argv) => {
            // We ignore sort_timestamp for now since its unused in the api
            const { start_cursor } = argv;
            let { sort, filter } = argv;

            try {
              if (sort) {
                sort = (sort as string[]).map((x) => JSON.parse(x));
              }
              if (filter) {
                filter = JSON.parse(filter as string);
              }
            } catch (err) {
              console.error(err);
              return;
            }

            // @note As of 2021-08-12 the notion api seems to have a bug. Sorts
            // don't have the intended effect. Maybe my formatting is off? If so
            // I wish they would tell me. In hte example below toggling between
            // `ascending` and `descending` does nothing.
            /*
               curl -X POST 'https://api.notion.com/v1/databases/d99bb57e-67b5-4c96-a7c9-60c05d28ed52/query' \
                    -H 'Authorization: Bearer '"$NOTION_TOKEN"'' \
                    -H 'Notion-Version: 2021-07-27' \
                    -H "Content-Type: application/json" \
                    --data '{
                      "sorts": [
                        {
                          "timestamp": "created_time",
                          "direction": "descending"
                        }
                      ]
                    }'
            */

            const payload = {
              database_id: argv.uuid as string,
              start_cursor: start_cursor as string | undefined,
              sorts: sort as Sort[],
              filter: filter as Filter,
            };

            if (argv.verbose) {
              console.error("[notion payload]", payload);
            }

            return getClient({ verbose: argv.verbose })
              .databases.query(payload)
              .then((x) => console.log(serializers[argv.format as string](x)));
          },
        )
        .command(
          "list",
          "List all databases. Results may be paginated.",
          (yargs) => {
            yargs.options({
              start_cursor: { type: "string" },
            });
          },
          (argv) => {
            return getClient({ verbose: argv.verbose })
              .search({
                query: "",
                filter: { property: "object", value: "database" },
                start_cursor: argv.start_cursor as string | undefined,
              })
              .then((x) => console.log(serializers[argv.format as string](x)));
          },
        )
        .command(
          "get <uuid>",
          "Get a specific database",
          (yargs) => {
            yargs.positional("uuid", {
              type: "string",
              demandOption: "You must provide a notion uuid.",
            });
          },
          (argv) => {
            return getClient({ verbose: argv.verbose })
              .databases.retrieve({ database_id: argv.uuid as string })
              .then((x) => console.log(serializers[argv.format as string](x)));
          },
        )
        .demandCommand()
        .help();
    },
  )

  // pages
  .command(
    "pages",
    "Interact with individual pages. If you want to list pages use the `search` command.",
    (yargs) => {
      yargs.alias("help", "h");
      return yargs
        .command(
          "list",
          "List all databases. Results may be paginated.",
          (yargs) => {
            yargs.options({
              start_cursor: { type: "string" },
            });
          },
          (argv) => {
            return getClient({ verbose: argv.verbose })
              .search({
                query: "",
                filter: { property: "object", value: "page" },
                start_cursor: argv.start_cursor as string | undefined,
              })
              .then((x) => console.log(serializers[argv.format as string](x)));
          },
        )
        .command(
          "get <uuid>",
          "Get a specific page",
          (yargs) => {
            yargs.positional("uuid", {
              type: "string",
              demandOption: "You must provide a notion uuid.",
            });
          },
          (argv) => {
            return getClient({ verbose: argv.verbose })
              .pages.retrieve({ page_id: argv.uuid as string })
              .then((x) => console.log(serializers[argv.format as string](x)));
          },
        )
        .demandCommand()
        .help();
    },
  )

  // blocks
  .command("blocks", "Interact with block objects", (yargs) => {
    return yargs
      .command(
        "get <uuid>",
        "Get a specific block",
        (yargs) => {
          yargs.alias("help", "h");
          yargs.options({
            with_children: { type: "boolean", default: false },
          });
          yargs.positional("uuid", {
            type: "string",
            demandOption: "You must provide a notion uuid.",
          });
        },
        (argv) => {
          return Promise.all([
            getClient({ verbose: argv.verbose }).blocks.retrieve({ block_id: argv.uuid as string }),
            argv.with_children
              ? getClient({ verbose: argv.verbose }).blocks.children.list({
                  block_id: argv.uuid as string,
                })
              : Promise.resolve(null),
          ]).then((x) => {
            const [block, children] = x;
            console.log(serializers[argv.format as string]({ ...block, children }));
            return x;
          });
        },
      )
      .command(
        "children <uuid>",
        "Get a specific block",
        (yargs) => {
          yargs.alias("help", "h");
          yargs.options({
            start_cursor: { type: "string" },
          });
          yargs.positional("uuid", {
            type: "string",
            demandOption: "You must provide a notion uuid.",
          });
        },
        (argv) => {
          return getClient({ verbose: argv.verbose })
            .blocks.children.list({
              block_id: argv.uuid as string,
              start_cursor: argv.start_cursor as string | undefined,
            })
            .then((x) => {
              console.log(serializers[argv.format as string](x));
              return x;
            });
        },
      )
      .demandCommand()
      .help();
  })

  // users
  .command("users", "Interact with user objects", (yargs) => {
    return yargs
      .command(
        "get <uuid>",
        "Get a specific user",
        (yargs) => {
          yargs.alias("help", "h");
          yargs.positional("uuid", {
            type: "string",
            demandOption: "You must provide a notion uuid.",
          });
        },
        (argv) => {
          return getClient({ verbose: argv.verbose })
            .users.retrieve({ user_id: argv.uuid as string })
            .then((x) => console.log(serializers[argv.format as string](x)));
        },
      )
      .command("list", "List all users", {}, (argv) => {
        return getClient({ verbose: argv.verbose })
          .users.list()
          .then((x) => console.log(serializers[argv.format as string](x)));
      })
      .demandCommand()
      .help();
  })

  // Unrelated to the official API. Just make sure we can get the token.
  .command("status", "Check the status of your environment.", {}, () => {
    if (NOTION_TOKEN) {
      console.error(
        "$NOTION_TOKEN found. To validate that it can access the API you can run any command. For example: `notion-cli users list`",
      );
    } else {
      console.error(
        "$NOTION_TOKEN was not set. Please ensure that the NOTION_TOKEN environment variable is set.",
      );
      process.exitCode = 99;
    }
  })

  // Global options
  .options({
    format: { choices: Object.keys(serializers), alias: "f", default: "json" },
    verbose: { type: "boolean", default: false },
  })

  // Default to help
  .demandCommand()
  .help().argv;

// @ts-ignore
// argv.then(console.log);

export {};
