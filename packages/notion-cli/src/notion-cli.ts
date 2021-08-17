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
import { listRenderer, plainTextRenderer } from "@iansinnott/notion-renderers";
import * as csv from "./csv";

const NOTION_TOKEN = process.env.NOTION_TOKEN;

const getClient = ({ verbose }: { verbose?: any }) =>
  new Client({
    auth: NOTION_TOKEN,
    logLevel: verbose ? LogLevel.DEBUG : LogLevel.WARN,
    logger: console.error,
  });

const serializers = {
  json: (x) => JSON.stringify(x, null, 2),
  list: listRenderer,
  plain_text: (x) => plainTextRenderer({ ...x, children: x.children.results }),
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

  // CSV
  .command(
    "csv",
    "Interact with individual databases. If you want to list databases use the `search` command.",
    (yargs) => {
      yargs.alias("help", "h");
      return yargs
        .command(
          "import",
          "Import a CSV into an existing Notion database",
          (yargs) => {
            yargs.options({
              input: { type: "string", demandOption: "You must specify a CSV file as the input." },
              delimiter: { type: "string", default: "," },
              title_column: {
                text: "string",
                description:
                  "Which column should serve as the title? By default it will be the first column.",
              },
              parent_page_id: {
                type: "string",
                demandOption:
                  "The Notion API requires a parent page when creating a database. If you're unsure of the id try `notion-cli pages list`",

                // @todo Go grab and use a page from the search endpoint?
                description: "The parent page is required in order to create the database.",
              },

              database_title: {
                type: "string",
                description:
                  "(optional) The title of the database in notion. If omitted the title is assumed to be name of the CSV file.",
              },
            });
          },
          (argv) => {
            return csv.create(getClient({ verbose: argv.verbose }), argv).catch((err) => {
              process.exitCode = 99;
              console.error(err.message);
              console.error(
                "CSV parsing can fail for many reasons. If the error message above is not helpful try checking the plain CSV file to ensure the delimiters and formatting are what you expect.",
              );
            });
          },
        )
        .command(
          "sync",
          "Sync a CSV file with a database. The CSV and the database must match exactly, so this command is meant to be used with database created using `notion-cli csv import`",
          (yargs) => {
            yargs.options({
              input: { type: "string", demandOption: "You must specify a CSV file as the input." },
              delimiter: { type: "string", default: "," },
              dry_run: {
                type: "boolean",
                default: false,
                description:
                  "If passed then no operations will be performed against the notion API.",
              },
              database_id: {
                type: "string",
                demandOption: "Without a database ID the CLI doesn't know what to sync with.",
                description: "The ID of the database to sync the file to.",
              },
            });
          },
          (argv) => {
            return csv.sync(getClient({ verbose: argv.verbose }), argv).catch((err) => {
              process.exitCode = 99;
              console.error(err.message);
              console.error(
                "CSV parsing can fail for many reasons. If the error message above is not helpful try checking the plain CSV file to ensure the delimiters and formatting are what you expect.",
              );
            });
          },
        )
        .demandCommand()
        .help();
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
    format: { choices: Object.keys(serializers), alias: "f", default: "list" },
    verbose: { type: "boolean", default: false },
  })

  // Default to help
  .demandCommand()
  .help().argv;

// @ts-ignore
// argv.then(console.log);

export {};
