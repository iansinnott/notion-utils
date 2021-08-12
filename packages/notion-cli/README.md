# `notion-cli`

A command line interface for the public Notion API.

Highly experimental. Did you check the `__tests__` dir yet? Good, don't. It won't lend you confidence in this code.

## Ethos

Provide a light wrapper around the Notion SDK / API. If the API can do it it should be possible to do it with this command line tool.

That being said, its still a work in progress. Not all endpoints are supported. Namely, as of this commit, functionality is mostly concerned with reading and transforming data, rather than writing data.

## Examples

```sh
# Default formatting is JSON. List everything
notion-cli search 

# A more readable list
notion-cli search --format list

# Find something specific (by title)
notion-cli search --query "something interesting" 

# List your pages
notion-cli pages list --format list

# List your databases
notion-cli databases list --format list

# Get a block
notion-cli blocks get "<block id>"

# Get a block and its child blocks
notion-cli blocks get "<block id>" --with_children

# (Experimental) Try to coerce a block's content to plain text. Unsupported block types are omitted
notion-cli blocks get "<block id>" --with_children --format plain_text
```

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
