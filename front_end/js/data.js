
import { rethrowAs, isUdf, WebApiNoResponse, asyncWebApiToPromise } from "./utility.js";
import {
    TagCounter, getRandomString, searchId
} from "./metaUtility.js";

class LocalStorageMemoryError extends WebApiNoResponse {}

const DataManager = new (function(){
    const TAG_KEY = "tags";
    const ID_LENGTH = 40;

    let instance;
    let self = this;

    this.getKey = function(keys) {
        return asyncWebApiToPromise(
            cb => chrome.storage.local.get(keys, cb)
        );
    };

    this.setKey = function(data) {
        return asyncWebApiToPromise(
            cb => chrome.storage.local.set(data, cb)
        ).catch((err) => {
            if (err instanceof WebApiNoResponse) {
                rethrowAs(err, LocalStorageMemoryError);
            } else {
                throw err;
            }
        });
    };

    Object.defineProperty(this, "instance", { get: () => {
        return new Promise((resolve, reject) => {
            if (instance)
            {
                resolve(instance);
            }
            else
            {
                load().then((meta) => {
                    instance = new Inner(meta);
                    resolve(instance);
                }).catch(reject);
            }
        });
    }});

    class Inner {
        constructor(meta)
        {
            this._tagTracker = new TagCounter();

            meta.forEach((content) => {
                this._tagTracker.increment(content[TAG_KEY]);
            });
            this._meta = meta;
        }

        get tags()
        {
            return this._tagTracker.tags;
        }

        get meta()
        {
            return this._meta;
        }

        get _successResponse()
        {
            return {success: true};
        }

        get _notFoundError()
        {
            return {notFound: true};
        }

        addContent(content) {
            content.id = getRandomString(ID_LENGTH);
            this._meta.push(content);

            return save(this._meta)
            .then(() => {
                this._tagTracker.increment(content[TAG_KEY]);
                return this._successResponse;
            }).catch((err) => {
                this._meta.pop();
                throw err;
            });
        }
        deleteContent(contentId) {
            const { content, index } = searchId(this._meta, contentId);

            if (content) {
                this._meta.splice(index, 1);

                return save(this._meta).then(() => {
                    this._tagTracker.decrement(content[TAG_KEY]);

                    return this._successResponse;
                }).catch((err) => {
                    this._meta.splice(index, 0, content);
                    
                    throw err;
                });
            } else {
                return Promise.reject(this._notFoundError);
            }
        }
        findContent(contentId) {
            const { content } = searchId(this._meta, contentId);

            if (content) {
                return Promise.resolve({ content });
            } else {
                return Promise.reject(this._notFoundError);
            }
        }
        // @TODO find a way to undo update if save fails.
        updateContent(contentId, info) {
            const { content, index } = searchId(this._meta, contentId);

            if (content) {
                delete info.id;

                this._meta[index] = Object.assign({}, content, info);

                return save(this._meta).then(() => {
                    if (info[TAG_KEY]) {
                        this._tagTracker.decrement(content[TAG_KEY]);
                        this._tagTracker.increment(info[TAG_KEY]);
                    }

                    return this._successResponse;
                }).catch((err) => {
                    this._meta[index] = content;
                    throw err;
                });
            } else {
                return Promise.reject(this._notFoundError);
            }
        }
    }

    function load() {
        return self.getKey("meta")
        .then((data) => {
            if (isUdf(data)) {
                throw new Error("data is undefined.");
            }
            
            const json = data.meta;
            if (!json) {
                return [];
            }
            
            const meta = json.split("\n").filter(Boolean).map(s => JSON.parse(s));

            return meta;
        });
    }

    function save(meta) {
        const serialized = meta
            .map(content => JSON.stringify(content))
            .join("\n");
        
        return self.setKey({ meta: serialized });
    }
})();

const RequestManager = (function(){
    return class {
        getContent() {
            return DataManager.instance.then(dm => dm.meta);
        }
        getTags() {
            return DataManager.instance.then(dm => dm.tags);
        }
        addContent(content) {
            return DataManager.instance.then(dm => dm.addContent(content));
        }
        findContent(contentId) {
            return DataManager.instance.then(dm => dm.findContent(contentId));
        }
        deleteContent(contentId) {
            return DataManager.instance.then(dm => dm.deleteContent(contentId));
        }
        updateContent(contentId, info) {
            return DataManager.instance.then(dm =>
                dm.updateContent(contentId, info)
            );
        }
    };
})();

export { DataManager, LocalStorageMemoryError, RequestManager };
