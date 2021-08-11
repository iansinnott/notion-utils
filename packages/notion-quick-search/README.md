# Notion Quick Search

Aka more experiments with the Notion API, but this time with a UI!

![An image of the app](https://s3.us-west-001.backblazeb2.com/persistory-1/2021-08-11%20at%202.29%20PM.png)

Live demo: https://notion-quick-search.vercel.app/

The idea with this experiment was to create a fast search interface for Notion. More accuratley it's a fast filter interface, but that's often exactly what you want. For example, if you know the title of the note you're looking for a filter interface will likely get you there much faster than a full search interface.

You will need an API token in order to try it out. The code will store your token in local storage and use it to make requests on your behalf. 

## Issues

There's something wrong with large collections. Not sure if its my fault or the Notion API is acting up, but either way large collections don't seem to fetch properly. I tried with my "My Links" databaase and only about 300 of my 500 links were found using thes earch endpoint.

Not sure what's going on, but that's why we're here experimenting right?

## Dev

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
