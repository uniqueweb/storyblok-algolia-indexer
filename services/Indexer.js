"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Indexer = void 0;
const storyblok_js_client_1 = __importDefault(require("storyblok-js-client"));
const algoliasearch_1 = __importDefault(require("algoliasearch"));
class Indexer {
    constructor(config) {
        this.config = config;
        this.batchSize = 1000;
        this.algoliaClient = (0, algoliasearch_1.default)(config.algoliaAppId, config.algoliaApiAdminToken);
        this.storyblokClient = new storyblok_js_client_1.default({
            accessToken: config.storyblokAccessToken,
        });
        const defaultOptions = {
            starts_with: '',
            per_page: 100,
            page: 1,
            version: 'published'
        };
        this.options = Object.assign(Object.assign({}, defaultOptions), config.options);
    }
    setOptions(newOptions) {
        this.options = Object.assign(Object.assign({}, this.options), newOptions);
    }
    indexStories() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const index = this.algoliaClient.initIndex(this.config.algoliaIndexName);
                const { perPage, total } = yield this.storyblokClient.get('cdn/stories/', this.options);
                const maxPage = Math.ceil(total / perPage);
                const requests = [];
                for (let page = 1; page <= maxPage; page++) {
                    requests.push(this.storyblokClient.get('cdn/stories/', Object.assign(Object.assign({}, this.options), { page })));
                }
                const responses = yield Promise.all(requests);
                let records = responses.flatMap(res => res.data.stories) || [];
                records = records.map(record => (Object.assign(Object.assign({}, record), { objectID: record.id })));
                for (let i = 0; i < records.length; i += this.batchSize) {
                    const batchedRecords = records.slice(i, i + this.batchSize);
                    yield index.saveObjects(batchedRecords, {
                        autoGenerateObjectIDIfNotExist: false
                    }).wait();
                }
                console.log(`✅ Index stored with ${records.length} entries.`);
            }
            catch (e) {
                console.error("❌ Error indexing stories:", e);
            }
        });
    }
}
exports.Indexer = Indexer;
