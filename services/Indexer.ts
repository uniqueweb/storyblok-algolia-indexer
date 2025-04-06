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

interface StoryblokSpace {
  id: number
  name: string
  domain: string
  version: number
  language_codes: string[]
}

interface StoryblokSpaceResponse {
  space: StoryblokSpace
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
      per_page: 100,
      page: 1,
      version: 'published'
    };

    this.options = {
      ...defaultOptions,
      ...config.options
    }
  }

  private async getStoryblokCv(): Promise<number> {
    const res = await this.storyblokClient.get('cdn/spaces/me');
    const data = res.data as StoryblokSpaceResponse;

    return data.space.version;
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
      const cv = await this.getStoryblokCv();

      const { perPage, total } = await this.storyblokClient.get('cdn/stories/', { ...this.options, cv });
      const maxPage = Math.ceil(total / perPage);

      const requests = [];
      for (let page = 1; page <= maxPage; page++) {
        requests.push(this.storyblokClient.get('cdn/stories/', {...this.options, page, cv }));
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

  async deleteStories(objectIds: string[]): Promise<void> {
    try {
      const index = this.algoliaClient.initIndex(this.config.algoliaIndexName);
      await index.deleteObjects(objectIds);
    } catch (e) {
      console.error("❌ Error deleting stories:", e);
    }
  }

  async deleteIndex(): Promise<void> {
    try {
      const index = this.algoliaClient.initIndex(this.config.algoliaIndexName);
      await index.delete();
    } catch (e) {
      console.error("❌ Error deleting stories:", e);
    }
  }
}