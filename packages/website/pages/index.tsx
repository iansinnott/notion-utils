import Head from "next/head";
import Image from "next/image";
import React, { createElement, FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { autocomplete } from "@algolia/autocomplete-js";
import { render } from "react-dom";
import { Client } from "@notionhq/client";
import cx from "classnames";

const TextSpinner = ({ className = "" }) => {
  return <div className={cx("text-spinner w-8", className)}></div>;
};

function Autocomplete(props) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

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

class StorageProvider {
  backend: typeof window.localStorage;

  constructor() {
    // @ts-ignore
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
          "w-full border-2 border-black rounded-lg py-2 px-4 focus:border-pink-600 outline-none mb-4",
          { "border-red-600": props.error },
        )}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter your integration token"
      />

      <button
        type="submit"
        className={cx("mb-4 py-2 px-4 bg-black text-white hover:bg-pink-600 rounded-lg", {
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
          Your data will not leave the browser. If you decide you no longer want your data stored
          here you can remove it from <code>localStorage</code>.
        </p>
      </div>
    </form>
  );
}

class SearchPane extends React.Component<{
  client: null | Client;
  state: AppState;
  onReauth?: () => void;
}> {
  render() {
    const { client, state } = this.props;
    return (
      <div className="SearchPane">
        <Autocomplete />
      </div>
    );
  }
}

// A component that will display all the keys and values of the state prop
const DebugInfo = ({ state }: { state: AppState }) => {
  return (
    <div>
      <h2 className="text-sm text-gray-700">Debug Info</h2>
      <pre>
        <code>{JSON.stringify(state, null, 2)}</code>
      </pre>
    </div>
  );
};

interface AppState {
  auth?: {
    username?: string;
    token: string;
  };
}

export default function Home() {
  const storage = useRef(new StorageProvider());
  const [status, setStatus] = useState("hydrating");
  const [state, setState] = useState<AppState>({});
  const [err, setErr] = useState(null);
  const client = useRef<null | Client>(null);

  const mergeState = (state: Partial<AppState>) => {
    return setState((x) => ({ ...x, ...state }));
  };

  useEffect(() => {
    setStatus("hydrating");
    setErr(null);

    storage.current
      .getItem("appState")
      .then((data) => {
        setState(data || {});
        setStatus("idle");
      })
      .catch((err) => {
        setErr(err);
        setStatus("error");
      });
  }, []);

  const handleSaveToken = (token: string) => {
    // Notion doesn't like relative URLs so just construct a full one
    const baseUrl = new URL(window.location.toString());
    baseUrl.pathname = "/api/notion";

    // Initializing a client
    const notion = new Client({
      auth: token,
      baseUrl: baseUrl.toString(),
    });

    setStatus("loading");
    setErr(null);

    // Try out a request to confirm that the token actually works
    notion.users
      .list()
      .then((res) => {
        mergeState({ auth: { token } });
        client.current = notion;
        console.log(res);
      })
      .catch((err) => {
        console.warn(err);
        setErr(new Error("Failed to fetch. This usually means the token is invalid or expired."));
      })
      .finally(() => setStatus("idle"));
  };

  const deauthorize = () => {
    storage.current.clear();
    mergeState({ auth: { token: "" } });
  };

  const loading = status === "loading";

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

        <p className="mb-4">
          I created this site because I like Notion but the search feature could be much faster. I
          want to get to my notes NOW!
        </p>

        {state.auth?.token ? (
          <div className={"autocomplete"}>
            <SearchPane state={state} client={client.current} onReauth={deauthorize} />
            <DebugInfo state={state} />
          </div>
        ) : (
          <AuthBox onSaveToken={handleSaveToken} disabled={loading} error={err} />
        )}

        {loading && <TextSpinner className="mt-4" />}
      </main>
    </div>
  );
}

// get static props
export async function getStaticProps() {
  return { props: {} };
}
