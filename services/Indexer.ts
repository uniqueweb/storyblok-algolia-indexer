import StoryblokClient, { ISbStoriesParams, ISbStoryData } from "storyblok-js-client";
import algoliasearch, { SearchClient } from "algoliasearch";

interface IndexerOptions {
  algoliaAppId: string;
  algoliaApiAdminToken: string;
  algoliaIndexName: string;
  storyblokAccessToken: string;
  storyblokSpaceId: string;
  options?: Partial<ISbStoriesParams>
}

export class Indexer {
  private algoliaClient: SearchClient;
  private storyblokClient: StoryblokClient;
  private options: ISbStoriesParams;
  private batchSize: number = 1000;

  constructor(private config: IndexerOptions) {
    this.algoliaClient = algoliasearch(
      config.algoliaAppId,
      config.algoliaApiAdminToken
    );

    this.storyblokClient = new StoryblokClient({
      accessToken: config.storyblokAccessToken,
    });

    const defaultOptions: ISbStoriesParams = {
      starts_with: '',
      per_page: 100,
      page: 1,
      version: 'published'
    };

    this.options = {
      ...defaultOptions,
      ...config.options
    }
  }

  public setOptions(newOptions: Partial<ISbStoriesParams>) {
    this.options = {
      ...this.options,
      ...newOptions
    };
  }

  async indexStories(): Promise<void> {
    try {
      const index = this.algoliaClient.initIndex(this.config.algoliaIndexName);

      const { perPage, total } = await this.storyblokClient.get('cdn/stories/', this.options);
      const maxPage = Math.ceil(total / perPage);

      const requests = [];
      for (let page = 1; page <= maxPage; page++) {
        requests.push(this.storyblokClient.get('cdn/stories/', { ...this.options, page }));
      }

      const responses = await Promise.all(requests);
      let records: ISbStoryData[] = responses.flatMap(res => res.data.stories) || [];

      records = records.map(record => ({
        ...record,
        objectID: record.id
      }));

      for (let i = 0; i < records.length; i += this.batchSize) {
        const batchedRecords = records.slice(i, i + this.batchSize);
        await index.saveObjects(batchedRecords, {
          autoGenerateObjectIDIfNotExist: false
        }).wait();
      }

      console.log(`✅ Index stored with ${records.length} entries.`);
    } catch (e) {
      console.error("❌ Error indexing stories:", e);
    }
  }
}