/* eslint-disable react/no-unescaped-entities */
import Head from "next/head";
import React, { createElement, FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { autocomplete } from "@algolia/autocomplete-js";
import { render } from "react-dom";
import { Client, LogLevel } from "@notionhq/client";
import cx from "classnames";
import { AutocompleteOptions, BaseItem } from "@algolia/autocomplete-core";
import { Database, Page, PropertyValue, RichText } from "@notionhq/client/build/src/api-types";
import { SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import reactStringReplace from "react-string-replace";
import { Switch } from "@headlessui/react";

// Oh hai, just a dev logger here
const log = (...args) => {
  if (process.env.NODE_ENV === "development" || localStorage.getItem("debug")) {
    console.log(...args);
  }
};

// Like a loading spinner, but in pure text form
const TextSpinner = ({ className = "" }) => {
  return <div className={cx("text-spinner w-8", className)}></div>;
};

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

// Get a URL to the desktop version of Notion
const getLocalNotionUrl = ({ id }: { id: string }) => {
  const idWithoutHyphens = id.replace(/-/g, "");
  return `notion:/` + idWithoutHyphens;
};

// Format an object that came back from the search results
const formatObject = (obj: Page | Database) => {
  switch (obj.object) {
    case "page":
      const titleProp = Object.values(obj.properties).find((x) => x.type === "title");
      return renderPropertyPlainText(titleProp);
    case "database":
      return renderRichPlainText(obj.title);
  }
};

function Autocomplete(props: Partial<AutocompleteOptions<BaseItem>>) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    // @ts-ignore - Why does ts dislike prop spreading like this...
    const search = autocomplete({
      container: containerRef.current,
      renderer: { createElement, Fragment },
      render({ children }, root) {
        render(children, root);
      },
      ...props,
    });

    return () => {
      search.destroy();
    };
  }, [props]);

  return <div ref={containerRef} />;
}

// @note I know what you're thinking: What is this storage provider all about? Maybe it will prove useful later, but for now it's a not-very-interesting wrapper over localStorage
class StorageProvider {
  backend: typeof window.localStorage;

  constructor() {
    // @ts-ignore - TS doesn't like my localStorage shim, but this is only for getting past initial server render
    this.backend =
      typeof window !== "undefined"
        ? window.localStorage
        : {
            getItem: () => "",
            setItem: () => {},
            removeItem: () => {},
            length: 0,
            clear: () => {},
          };
  }

  async clear() {
    return this.backend.clear();
  }

  async getItem<T>(key: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        const value = this.backend.getItem(key);
        resolve(JSON.parse(value));
      } catch (e) {
        reject(e);
      }
    });
  }

  async setItem(key: string, value: any): Promise<void> {
    this.backend.setItem(key, JSON.stringify(value));
  }
}

// Auth box props with onSaveToken handler
interface AuthBoxProps {
  onSaveToken: (token: string) => void;
  disabled?: boolean;
  error?: Error;
}

// A component that accepts a single user input
function AuthBox(props: AuthBoxProps) {
  const [value, setValue] = useState("");

  // A react form submit handler
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    props.onSaveToken(value);
  };

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <input
        className={cx(
          "w-full border-2 border-black rounded-lg py-2 px-4 focus:border-indigo-600 outline-none mb-4",
          { "border-red-600": props.error },
        )}
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter your integration token"
      />

      <button
        type="submit"
        className={cx("mb-4 py-2 px-4 bg-black text-white hover:bg-indigo-600 rounded-lg", {
          "pointer-events-none opacity-75": props.disabled,
        })}>
        Save
      </button>

      {props.error && (
        <div className="bg-red-200 text-red-800 border-2 border-red-300 rounded-lg px-4 py-2 mb-4">
          {props.error.message}
        </div>
      )}

      <div className="flex flex-col space-y-2">
        <p className="text-sm text-gray-700">
          In order to search over your Notion database this app needs an integration token.
        </p>
        <p className="text-sm text-gray-700">
          This token will only ever be stored in your browser and it will only be used to{" "}
          <em>read</em> from your Notion workspace.{" "}
          <strong>No data will be modified or removed.</strong>
        </p>
        <p className="text-sm text-gray-700">
          Your data will be stored in the browser using <code>localStorage</code>.
        </p>
      </div>
    </form>
  );
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const IconRefresh = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
      clipRule="evenodd"
    />
  </svg>
);

const IconDocument = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
      clipRule="evenodd"
    />
  </svg>
);

const IconDatabase = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor">
    <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
    <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
    <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
  </svg>
);

const icons = {
  page: IconDocument,
  database: IconDatabase,
};

const highlight = (str: string, target: string) => {
  return reactStringReplace(str, target, (match, i) => (
    <em key={i} className="bg-yellow-200 border-b border-yellow-400">
      {match}
    </em>
  ));
};

function SearchResultItem({ hit, components, query }) {
  const k = "plain_text_title";
  const Icon = icons[hit.object];
  return (
    <a href={hit.url} className="aa-ItemLink">
      <div className="aa-ItemWrapper">
        <div className="flex justify-between">
          {Icon && (
            <div className="mr-2">
              <Icon />
            </div>
          )}
          <div className="aa-ItemContentBody">
            <div className="aa-ItemContentTitle h-5">{highlight(hit[k], query)}</div>
            <div className="aa-ItemContentDescription flex space-x-4 font-mono opacity-60">
              <div>
                <span className="uppercase text-xs">Updated</span>{" "}
                {formatDate(new Date(hit.last_edited_time))}
              </div>
              <div>
                <span>Created</span> {formatDate(new Date(hit.created_time))}
              </div>
            </div>
          </div>
        </div>
        <div className="aa-ItemActions">
          <button
            className="aa-ItemActionButton aa-DesktopOnly aa-ActiveOnly"
            type="button"
            title="Select">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M18.984 6.984h2.016v6h-15.188l3.609 3.609-1.406 1.406-6-6 6-6 1.406 1.406-3.609 3.609h13.172v-4.031z" />
            </svg>
          </button>
        </div>
      </div>
    </a>
  );
}

class SearchPane extends React.Component<{
  getClient: () => null | Client;
  state: AppState;
  onReauth?: () => void;
  getSources: ({ query: string }) => any[];
}> {
  render() {
    const { getClient, state } = this.props;
    return (
      <div className="SearchPane">
        <Autocomplete
          onSubmit={({ event }) => {
            event.preventDefault();
            event.stopPropagation();
            log("[submit] submission should be handled already, not submitting the form");
          }}
          openOnFocus
          getSources={this.props.getSources}
        />
      </div>
    );
  }
}

// A component that will display all the keys and values of the state prop
const DebugInfo = ({ state, status }: { state: AppState; status: string }) => {
  return (
    <div className="border-2 border-gray-400 bg-gray-200 rounded-lg px-2 py-2 font-mono mt-8 max-w-lg mx-auto overflow-auto w-full flex flex-col space-y-2">
      <div>
        <h2 className="uppercase text-xs text-gray-700">Status</h2>
        <pre>{status}</pre>
      </div>
      <div>
        <h2 className="uppercase text-xs text-gray-700">Document Count</h2>
        <pre>{state.results.length}</pre>
      </div>
      <div>
        <h2 className="uppercase text-xs text-gray-700">Last Checked</h2>
        <pre>{state.lastChecked ? formatDate(new Date(state.lastChecked)) : "--"}</pre>
      </div>
    </div>
  );
};

interface AppState {
  openDesktopApp: boolean;
  lastChecked?: number;
  results: Array<(Page | Database) & { plain_text_title: string }>;
  auth?: {
    username?: string;
    token: string;
  };
}

const initNotion = (token: string) => {
  // Notion doesn't like relative URLs so just construct a full one
  const baseUrl = new URL(window.location.toString());
  baseUrl.pathname = "/api/notion";
  const url = baseUrl.toString();

  log("[init notion] with url", baseUrl);

  // Initializing a client
  const notion = new Client({
    auth: token,
    baseUrl: url,
    logLevel: LogLevel.DEBUG,
  });

  // @ts-ignore
  window.notion = notion;

  return notion;
};

// Recursively fetch everything the token has access to. This populates the
// searchable results. We fetch everything all at once like this so as to
// avoid hitting the API too often. This does mean we need to re-fetch
// occasionally though.
const fetchAll = (client: Client, cursor = undefined): Promise<SearchResponse["results"]> => {
  log("[fetch all]", cursor);
  return client
    .search({
      query: "",
      sort: {
        direction: "descending", // Newer first
        timestamp: "last_edited_time",
      },
      start_cursor: cursor,
    })
    .then((res) => {
      // const results = res.results.map((x) => {
      //   return { ...x, plain_text_title: formatObject(x) };
      // });
      if (res.has_more) {
        return fetchAll(client, res.next_cursor).then((x) => {
          return [...res.results, ...x];
        });
      } else {
        return res.results;
      }
    });
};

const FAQ = () => {
  return (
    <div className="faq flex flex-col space-y-4">
      <div>
        <p className="question mb-2 text-lg">How is my data stored?</p>
        <p className="text-gray-800">
          Its stored in your web browser, in <code>localStorage</code> to be specific.
        </p>
      </div>
      <div>
        <p className="question mb-2 text-lg">Is the code open source?</p>
        <p className="text-gray-800">
          Yes. As I write this I haven't yet pushed it to GitHub, so I don't have a link yet, but by
          the time you read this it will be up.
        </p>
      </div>
      <div>
        <p className="question mb-2 text-lg">Why do you require an integration token?</p>
        <p className="text-gray-800">Without this token we can't access the Notion API.</p>
      </div>
      <div>
        <p className="question mb-2 text-lg">Why don't you use OAuth?</p>
        <p className="text-gray-800">
          OAuth would probably provide a better experience but pasting in your own integration token
          was quicker to set up.
        </p>
      </div>
      <div>
        <p className="question mb-2 text-lg">What is this?</p>
        <p className="text-gray-800">
          A search box that will let you search through your Notion documents. Technically, this
          project just stores your Notion docs in local storage and then lets you search them. It's
          sort of like offline search for Notion.
        </p>
      </div>
      <div>
        <p className="question mb-2 text-lg">Who made this?</p>
        <p className="text-gray-800">
          <span className="mr-3">👋 </span>
          <a href="https://twitter.com/ian_sinn">@ian_sinn</a>
        </p>
      </div>
      <div>
        <p className="question mb-2 text-lg">Why did you make this?</p>
        <p className="text-gray-800">
          I created this site because I like Notion but the search feature could be much faster. I
          want to get to my notes NOW!
        </p>
        <p className="text-gray-800">I also just wanted to try out the new Notion API.</p>
      </div>
      <div>
        <p className="question mb-2 text-lg">What's the license?</p>
        <p className="text-gray-800">MIT</p>
      </div>
      <div>
        <p className="question mb-2 text-lg">Is this actually useful?</p>
        <p className="text-gray-800">
          It's questonable. Quickly jumping to pages in Notion is very useful, but having to open a
          separate website in order to do so is definitely not ideal. For now this is an experiment.
        </p>
      </div>
    </div>
  );
};

export default function Home() {
  const initialState = { results: [], auth: null, openDesktopApp: false };
  const storage = useRef(new StorageProvider());
  const [status, setStatus] = useState("hydrating");
  const [state, setState] = useState<AppState>(initialState);
  const [err, setErr] = useState(null);
  const client = useRef<null | Client>(null);

  const mergeState = (state: Partial<AppState>) => {
    return setState((x) => ({ ...x, ...state }));
  };

  const hydrate = () =>
    storage.current.getItem("appState").then((x: AppState) => {
      if (!x) return state;

      setState(x);

      if (x.auth?.token) {
        client.current = initNotion(x.auth?.token);
      }

      return x;
    });

  const persist = (): void => {
    log("[persist]", state);
    storage.current.setItem("appState", state);
  };

  const refresh = React.useCallback(() => {
    setStatus("loading");
    return fetchAll(client.current)
      .then((xs) =>
        xs.map((x) => {
          return { ...x, plain_text_title: formatObject(x) };
        }),
      )
      .then((results) => mergeState({ results, lastChecked: Date.now() }))
      .finally(() => setStatus("idle"));
  }, []);

  useEffect(() => {
    // @ts-ignore
    log("Root initialized");

    setStatus("hydrating");
    setErr(null);

    hydrate()
      .then((x) => {
        if (x.results.length === 0 && client.current) {
          return refresh();
        }
      })
      .then(() => {
        setStatus("idle");
      })
      .catch((err) => {
        console.warn(err);
        setErr(err);
        setStatus("error");
      });
    // Ignore exhaustive deps warning here. Just run once on init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(persist, [state]);

  const handleSaveToken = (token: string) => {
    const notion = initNotion(token);

    setStatus("loading");
    setErr(null);

    // Try out a request to confirm that the token actually works
    notion.users
      .list()
      .then((res) => {
        mergeState({ auth: { token } });
        client.current = notion;
        console.log(res);
        return refresh();
      })
      .catch((err) => {
        console.warn(err);
        setErr(new Error("Failed to fetch. This usually means the token is invalid or expired."));
      })
      .finally(() => setStatus("idle"));
  };

  const deauthorize = () => {
    storage.current.setItem("appState", "");
    setState(initialState);
  };

  const loading = status === "loading";

  useEffect(() => {
    // @ts-ignore
    window.try1 = () => {
      return client.current.request({
        path: "search",
        method: "post",
        body: { query: "" },
        auth: state.auth.token,
      });
    };
    // @ts-ignore
    window.try2 = () => {
      return fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: state.auth.token,
          query: {
            query: "",
            sort: {
              direction: "descending", // Newer first
              timestamp: "last_edited_time",
            },
            start_cursor: undefined,
          },
        }),
      }).then((x) => x.json());
    };
  }, [state.auth?.token]);

  return (
    <div className={""}>
      <Head>
        <title>Notion Quick Search</title>
        <meta
          name="description"
          content="A super fast search box for all your Notion pages and databases."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={"flex flex-col items-center p-2 sm:p-4 md:p-8 max-w-lg mx-auto"}>
        <h1 className={"text-center text-3xl my-8"}>Notion Quick Search</h1>

        <p className={"w-full mb-4"}>
          The unofficial Notion search box. Start typing and find your pages and databases.
        </p>

        {state.auth?.token && (
          <div className={"autocomplete w-full"}>
            <div className="flex justify-center">
              <Switch.Group as="div" className="flex items-center mb-4">
                <span className="flex flex-col">
                  <Switch.Label
                    as="span"
                    className="text-sm font-medium text-gray-900 mr-8"
                    passive>
                    Open links in desktop app
                  </Switch.Label>
                </span>
                <Switch
                  checked={state.openDesktopApp}
                  onChange={(open) => mergeState({ openDesktopApp: open })}
                  className={cx(
                    state.openDesktopApp ? "bg-indigo-600" : "bg-gray-200",
                    "relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600",
                  )}>
                  <span
                    aria-hidden="true"
                    className={cx(
                      state.openDesktopApp ? "translate-x-5" : "translate-x-0",
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200",
                    )}
                  />
                </Switch>
              </Switch.Group>
            </div>

            <SearchPane
              getSources={({ query }) => [
                {
                  sourceId: "notion_local",

                  // Yup, no sophisticated matching going on here. Just a simple call to `includes`.
                  getItems({ query }) {
                    return state.results.filter((x) =>
                      x.plain_text_title.toLowerCase().includes(query.toLowerCase()),
                    );
                  },

                  // @note Databases don't come with a URL prop for some reason, so hopefully Notion redirects URLs like the default here
                  getItemUrl({ item }) {
                    return item.url || `https://www.notion.so/${item.id.replace(/-/g, "")}`;
                  },

                  // Called when a list item is clicked or the enter key is pressed
                  // @note itemUrl is built by the above function
                  onSelect({ item, itemUrl, event }) {
                    event.preventDefault();
                    event.stopPropagation();

                    if (state.openDesktopApp) {
                      const url = getLocalNotionUrl(item);
                      log("[open] Opening desktop URL", url);
                      // @note For whateve reason using `window.open` is more janky than `window.location.href`. Might be browser-specific
                      window.location.href = url; // Open the external app
                    } else {
                      window.open(itemUrl); // Open a new tab
                    }
                  },
                  templates: {
                    item({ item, components }) {
                      return <SearchResultItem hit={item} components={components} query={query} />;
                    },
                    noResults() {
                      return "Nothing found";
                    },
                  },
                },
              ]}
              state={state}
              getClient={() => client.current}
              onReauth={deauthorize}
            />
            <DebugInfo state={state} status={status} />
            <div className="flex justify-between w-full mt-4">
              <button
                className={cx(
                  "px-2 py-1 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-black",
                  { "pointer-events-none opacity-60": status !== "idle" },
                )}
                onClick={refresh}>
                <span className={cx("mr-2", { "animate-spin": loading })}>
                  <IconRefresh />
                </span>
                Refresh
              </button>
              <button
                className="px-2 py-1 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-800 hover:bg-red-100"
                onClick={deauthorize}>
                <small>Re-authorize</small>
              </button>
            </div>
          </div>
        )}

        {!state.auth?.token && status !== "hydrating" && (
          <AuthBox onSaveToken={handleSaveToken} disabled={loading} error={err} />
        )}

        {status === "hydrating" && <TextSpinner className="mt-4" />}
        {loading && <TextSpinner className="mt-4" />}
        <hr className="my-12 border-b border-dashed border-gray-200 w-full" />
        <FAQ />
      </main>
    </div>
  );
}

// get static props
// @todo Not a log going on here...
export async function getStaticProps() {
  return { props: {} };
}
