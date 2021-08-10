# Notion Utils

🚧 WIP 🚧  This repo is very much a work in progress. Just a heads up.

## Official API

Utilize the Typescript utils.

### Dev

```sh
# With no debugging
NOTION_TOKEN='secret_...' DEBUG= node dist/backup.js

# Run with debugging
NOTION_TOKEN='secret_...' DEBUG=1 node dist/backup.js
```

## Unofficial API

Utilize the Python utils. These utils are very much experimental and not (yet) meant to resemble anything approaching stable code.

That being said, the official API is not yet powerful enough to meet all user needs, so some functionality still requires the unofficial API.

Examples:

* Accessing everything in a workspace
  * A workaround is to put all your Notion data under a single page, and then share that page with an official API integration. However, if you really want to access everything within a workspace you will need the unofficial API.
* Multiple work spaces
  * There is currently no official API for this.
  
That being said, it's still early days and the Notion devs are iterating on the official API. Hopefully soon anything will be possible!