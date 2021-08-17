import path from "path";
import fs from "fs";
import * as CSV from "@fast-csv/parse";
import { Client } from "@notionhq/client/build/src";
import {
  DatabasesCreateParameters,
  InputPropertyValueMap,
  PropertyMap,
} from "@notionhq/client/build/src/api-endpoints";
import { equals, difference, map, splitEvery, partition } from "ramda";
import { InputPropertyValue, Page, Property } from "@notionhq/client/build/src/api-types";
import { renderPropertyPlainText } from "@iansinnott/notion-renderers";
import util from "util";

const inspect = (x: any) => {
  return console.log(util.inspect(x, { depth: 10 }));
};

// The max number of requests to make at a time. It's an upper limit. Fewere reqeuests might still be made.
const concurrency = 10;

// Split long arrays into batches of 10 elements
const splitBatches = splitEvery(concurrency);

const csvParse = (filePath: string, { delimiter }) => {
  return new Promise((resolve, reject) => {
    const xs: any[] = [];
    fs.createReadStream(filePath)
      .pipe(CSV.parse({ headers: true, delimiter }))
      .on("error", (error) => reject(error))
      .on("data", (row) => xs.push(row))
      .on("end", (rowCount: number) => resolve(xs));
  });
};

export const create = async (client: Client, argv) => {
  // @ts-ignore
  const data: any[] = await csvParse(path.resolve(argv.input), argv);
  const headers = Object.keys(data[0]); // @note A headers row is required

  let database_title = argv.title;
  if (!database_title) {
    database_title = path.basename(argv.input, ".csv");
    console.error("No --title provided. Using the filename:", database_title);
  }

  let title_column = argv.title_column;
  if (!title_column) {
    title_column = headers[0];
    console.error("No --title provided. Using the filename:", database_title);
  }

  const properties = headers.reduce((agg, k) => {
    return {
      ...agg,
      [k]: {
        [title_column === k ? "title" : "rich_text"]: {},
      },
    };
  }, {});

  const payload: DatabasesCreateParameters = {
    title: [
      {
        type: "text",
        text: {
          content: database_title,
        },
      },
    ],
    parent: {
      page_id: argv.parent_page_id as string,
    },
    properties,
  };
  const database = await client.databases.create(payload);

  console.log(`Database successfully created with id: ${database.id}`);
  console.log(`The database is empty. To sync your data run:`);
  console.log();
  console.log(
    `    notion-cli csv sync --database_id "${database.id}" --input "${argv.input}" --delimiter "${argv.delimiter}"`,
  );
  console.log();
};

async function getAllDatabasePages(client: Client, database_id: string) {
  const pages: Page[] = [];
  let cursor: string | undefined = undefined;
  while (true) {
    const { results, next_cursor } = await client.databases.query({
      database_id,
      start_cursor: cursor,
    });
    pages.push(...results);

    if (!next_cursor) {
      break;
    }

    cursor = next_cursor;
  }

  console.log(`${pages.length} pages successfully fetched.`);

  return pages;
}
export const sync = async (client: Client, argv) => {
  debugger;
  // @ts-ignore
  const data: any[] = await csvParse(path.resolve(argv.input), argv);
  const headers = Object.keys(data[0]); // @note A headers row is required
  const { database_id, dry_run } = argv;
  const database = await client.databases.retrieve({ database_id });
  const properties = database.properties;
  const field_names = Object.keys(properties);
  const fields = Object.values(properties);

  // @note We just assume this is present. I think all dbs are required to have one
  const title_field = fields.find((x) => x.type === "title") as Property;

  // See if the csv matches the db. Use sets to ignore ordering
  // if (!equals(new Set(headers), new Set(field_names))) {
  //   console.log(difference(headers, field_names));
  //   console.log(equals(headers, field_names));
  //   console.log(headers, field_names);
  //   throw new Error("The headers of your CSV do not match the properties of the database.");
  // }

  // const deletions = []; // For now this will just remain a @todo

  const existingPages = await getAllDatabasePages(client, database.id);

  // What this gives us is a map of the title property to its id in notion. This lets us map rows in the CSV to existing rows in the database.
  const updateMapping: { [k: string]: any } = {};
  existingPages.forEach((page: Page) => {
    const x = page.properties[title_field.name];
    console.log();
    updateMapping[renderPropertyPlainText(x)] = page.id;
  });

  const [updates, creations] = partition((x) => {
    return x[title_field.name] in existingPages;
  }, data);

  const rowToProps = (row: PropertyMap): InputPropertyValueMap => {
    // @ts-ignore TS does not like ramda. This returns an object, not an array
    return map((prop) => {
      return {
        [prop.type]: [
          {
            text: {
              content: row[prop.name],
            },
          },
        ],
      };
    }, properties);
  };

  inspect(rowToProps(data[0]));

  for (const batch of splitBatches(creations)) {
    await Promise.all(
      // @ts-ignore
      batch.map((row) => {
        if (dry_run) {
          return Promise.resolve(console.log(`[dry run] [create]`, row));
        } else {
          return client.pages.create({ parent: { database_id }, properties: rowToProps(row) });
        }
      }),
    );
  }

  for (const batch of splitBatches(updates)) {
    await Promise.all(
      // @ts-ignore
      batch.map((row) => {
        const { page_id, ...rest } = row;
        if (dry_run) {
          return Promise.resolve(console.log(`[dry run] [update]`, row));
        } else {
          // @ts-ignore Meh, not worth the trouble ts is giving me.
          return client.pages.update({ page_id, properties: rowToProps(rest) });
        }
      }),
    );
  }

  console.log(`${creations.length} Created`);
  console.log(`${updates.length} Updated`);

  return Promise.resolve();
};
