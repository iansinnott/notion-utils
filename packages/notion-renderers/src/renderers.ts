import { APIResponseError } from "@notionhq/client/build/src";
import {
  RichText,
  PropertyValue,
  Block,
  Page,
  Database,
  User,
  PaginatedList,
  APISingularObject,
} from "@notionhq/client/build/src/api-types";
import assert from "assert";

// For all the monorepo we've got going there's really a lot of duplicated code...
//
export const renderRichPlainText = (xs: RichText[]) => {
  assert(xs && xs.map, "renderRichPlainText was not passed a map. " + xs);
  return xs
    .map((x) => x.plain_text)
    .filter(Boolean)
    .join(" ");
};

// Given a property value render it as plain text. Properties are found on database rows.
export const renderPropertyPlainText = (x: PropertyValue | Block) => {
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

export const NotionRenderer = {
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

export const listRenderer = (list: PaginatedList | APISingularObject) => {
  const formatListItem = (x: PaginatedList["results"][number]) => {
    return `[${x.object}] (${x.id}) ${NotionRenderer.getTitle(x)} <${NotionRenderer.getNotionUrl(
      x,
    )}>`;
  };

  if (list.object !== "list") return formatListItem(list);

  return list.results.map(formatListItem).join("\n");
};

type BlockWithChildren = Block & {
  children: null | BlockWithChildren[];
};

// @todo Maybe all child fetching should happen here? The children might be paginated, so we need to build up the list over N requests.
// @todo Where is the exhaustive list of block types?
// @todo You know what would make a pure function (just ignore those console calls...) like this better? Tests!
export const plainTextRenderer = (x: BlockWithChildren) => {
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

  for (const c of children) {
    let block: string | undefined;

    if (c.has_children) {
      block = plainTextRenderer(c); // Rescurse!
    } else {
      block = renderPropertyPlainText(c);
    }

    if (block) {
      result += block;
      result += "\n";
    }
  }

  return result;
};
