# @uniqueweb/storyblok-algolia-indexer

## Setup

```sh
yarn add @uniqueweb/storyblok-algolia-indexer # yarn
npm i @uniqueweb/storyblok-algolia-indexer # npm
```

## Basic usage

Initialize `storyblok-algolia-indexer` in your Node.js based serverless function

```javascript
const algoliaIndexer = new StoryblokAlgoliaIndexer({
  algoliaAppId,
  algoliaApiAdminToken,
  algoliaIndexName,
  storyblokAccessToken
})

// Optional
algoliaIndexer.setOptions({
  starts_with: 'articles/'
})
```