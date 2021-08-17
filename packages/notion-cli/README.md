# `notion-cli`

A command line interface for the public Notion API.

Highly experimental. Did you check the `__tests__` dir yet? Good, don't. It won't lend you confidence in this code.

## Ethos

Provide a light wrapper around the Notion SDK / API. If the API can do it it should be possible to do it with this command line tool.

That being said, its still a work in progress. Not all endpoints are supported. Namely, as of this commit, functionality is mostly concerned with reading and transforming data, rather than writing data.

## Install

You first need an integration token set in your environment as `NOTION_TOKEN=secret_...`. 

```sh
yarn global add @iansinnott/notion-cli
```

Or using NPM:

```sh
npm i -g @iansinnott/notion-cli
```

Or call directly with NPX:

```sh
npx @iansinnott/notion-cli --help
```

Specify the token in-line:

```sh
NOTION_TOKEN='secret_abc' npx @iansinnott/notion-cli --help
```


## Examples

```sh
# Default formatting is a list. List everything (limited to the default page size)
notion-cli search 

# The raw json
notion-cli search --format json

# Use the json for pipe-ing. Here's an example using jq to view all the URLs from the raw search output
notion-cli search --format json | jq '.results | map(.url)'

# Or store the output for inspection
notion-cli search --format json > search_results.json

# Find something specific (by title)
notion-cli search --query "something interesting" 

# List your pages
notion-cli pages list

# List your databases
notion-cli databases list

# Get a block
notion-cli blocks get "<block id>"

# Get a block and its child blocks
notion-cli blocks get "<block id>" --with_children

# (Experimental) Try to coerce a block's content to plain text. Unsupported block types are omitted
notion-cli blocks get "<block id>" --with_children --format plain_text
```

## CSV to Notion Database

Another experimental feature. You can create a database from a CSV file and also sync CSVs to a database.

```sh
# Create a database from a CSV file. The database title will be "Book Database"
# and the column named "title" in the CSV will be used as the title column in
# Notion. If you're unsure of your page ID you can view your pages using
# `notion-cli pages list`.
csv import --input ~/my/books.csv --parent_page_id <page_id> --delimiter "," --title "Book Database" --title_column "title"

# Now import all the data. This is the second step in the two-step process. This
# may take a while, depending on how many rows your CSV has.
csv sync --input ~/my/books.csv  --database_id "<database id from last command>" --delimiter ","
```

Importing a CSV is a two step process, as shown above, However, once the database is created you can run the `csv sync` command idempotently. For example, if you generate a CSV file once a day you can also add a cron job to `csv sync` that file into Notion.

## Usage

`--help` to get help.

```
notion-cli <command>

Commands:
  notion-cli search     Search objects accessible to your token. Leave query
                        empty to return everything.
                        Results are paginated. Use the --start_cursor flag to
                        fetch more.
  notion-cli databases  Interact with individual databases. If you want to
                        list databases use the `search` command.
  notion-cli pages      Interact with individual pages. If you want to list
                        pages use the `search` command.
  notion-cli blocks     Interact with block objects
  notion-cli users      Interact with user objects
  notion-cli status     Check the status of your environment.

Options:
      --version  Show version number                                   [boolean]
  -f, --format         [choices: "json", "list", "plain_text"] [default: "json"]
      --verbose                                       [boolean] [default: false]
      --help     Show help                                             [boolean]

Not enough non-option arguments: got 0, need at least 1
```
