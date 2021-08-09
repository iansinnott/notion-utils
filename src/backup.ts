import { Client } from "@notionhq/client";
import { SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import { PropertyValue, RichText } from "@notionhq/client/build/src/api-types";
import fs from "fs";
import * as crypto from "crypto";
import assert from "assert";

const AUTH_TOKEN = process.env.NOTION_TOKEN;

assert(AUTH_TOKEN, "Please set the NOTION_TOKEN environment variable");

// create a sha1 hash of the passed string
const sha1sum = (str: string) => {
  const hash = crypto.createHash("sha1");
  hash.update(str);
  return hash.digest("hex");
};

const repr = (x: any) => JSON.stringify(x);

// Initializing a client
const notion = new Client({
  auth: AUTH_TOKEN,
});

// Example: List notion users
async function _listUsers(client: Client) {
  return client.users.list().then((users) => {
    if (process.env.DEBUG) {
      console.log(users);
    }

    console.log("Users:");
    for (const user of users.results) {
      console.log(user);
    }
  });
}

// Given an array type return the type of the array elements
// @see https://stackoverflow.com/questions/41253310/typescript-retrieve-element-type-information-from-array-type
type ArrayElement<
  ArrayType extends readonly unknown[]
> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

type FormattableObject = ArrayElement<SearchResponse["results"]>;

// Confusing function name? Agreed...
// Given a rich text object (a list) return the plain text version
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

// @note We use a _single_ slash here. As of this commit, that's how Notion works.
const getLocalNotionUrl = ({ id }: { id: string }) => {
  const idWithoutHyphens = id.replace(/-/g, "");
  return `notion:/` + idWithoutHyphens;
};

// Format an object that came back from the search results
const formatObject = (obj: FormattableObject) => {
  switch (obj.object) {
    case "page":
      return `[page] ${renderPropertyPlainText(obj.properties.title)} <${getLocalNotionUrl(obj)}>`;
    case "database":
      return `[database] ${renderRichPlainText(obj.title)} <${getLocalNotionUrl(obj)}>`;
  }
};

const main = async () => {
  const backupFile = `tmp/backup.${sha1sum(AUTH_TOKEN)}.json`;

  // @note For dev purposes we will use the disk-cached response if you request it.
  // This avoids pummeling Notions API with requests every time you want to test
  // out your parsing logic. Not that it would really be a pummel, but its
  // impolite to hit the API if not needed.
  // @todo For now this only fetches the first page.
  const p = process.env.DEBUG
    ? new Promise<SearchResponse>((resolve) => {
        const raw = fs.readFileSync(backupFile, "utf8");
        resolve(JSON.parse(raw));
      })
    : notion
        .search({
          query: "",
          sort: {
            direction: "descending", // Newer first
            timestamp: "last_edited_time",
          },
        })
        .then((xs) => {
          fs.writeFileSync(backupFile, JSON.stringify(xs, null, 2), { encoding: "utf8" });
          return xs;
        });

  p.then(({ results, ...rest }) => {
    return {
      ...rest,
      results: results.map(formatObject),
    };
  }).then(console.log);
};

// If script was called directly, run the main function
if (require.main === module) {
  main();
}
