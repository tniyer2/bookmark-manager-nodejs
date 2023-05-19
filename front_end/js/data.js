
import {
    rethrowAs, isUdf,
    Mutex,
    WebApiError, asyncWebApiToPromise
} from "./utility.js";

class DataManager {
    constructor(data) {
        this._data = new Mutex(data);
                
        this._lastContentId = null;
        this._sameIdCount = 0;

        this._tagCounter = new TagCounter();

        for (let i = 0; i < data.length; ++i) {
            const content = data[i];
            this._tagCounter.increment(content.tags);
        }
    }
    get allTags() {
        return this._tagCounter.tags;
    }
    get allContent() {
        return this._data.get();
    }
    _findContent(data, id) {
        const index = data.findIndex(c => c.id === id);
        if (index === -1) {
            throw new ContentNotFoundError("Can not find content.");
        }
        
        const content = data[index];

        return { index, content };
    }
    findContent(contentId) {
        return this._data.acquire((getData) => {
            const data = getData();
            const { content } = this._findContent(data, contentId);
            return content;
        });
    }
    _createNewId() {
        const id = String(Date.now());

        if (id === this._lastContentId) {
            this._sameIdCount += 1;
            return id + String(this._sameIdCount);
        } else {
            this._lastContentId = id;
            this._sameIdCount = 0;
            return id;
        }
    }
    addContent(content) {
        return this._data.acquire((getData) => {
            const data = getData();
            content.id = this._createNewId();

            const mutate = () => data.push(content);
            const undo = () => data.pop();

            mutate();
            const p = saveMetaData(data);
            undo();

            return p.then(() => {
                mutate();
                this._tagCounter.increment(content.tags);

                return true;
            });
        });
    }
    updateContent(contentId, updates) {
        return this._data.acquire((getData) => {
            const data = getData();
            const { index, content } = this._findContent(data, contentId);

            // not allowed to update id
            delete updates.id;
            const updatedContent = Object.assign({}, content, updates);

            const mutate = () => { data[index] = updatedContent; };
            const undo = () => { data[index] = content; };

            mutate();
            const p = saveMetaData(data);
            undo();

            return p.then(() => {
                mutate();

                if (!isUdf(updates.tags)) {
                    this._tagCounter.decrement(content.tags);
                    this._tagCounter.increment(updates.tags);
                }

                return true;
            });
        });
    }
    deleteContent(contentId) {
        return this._data.acquire((getData) => {
            const data = getData();
            const { index, content } = this._findContent(data, contentId);

            const mutate = () => data.splice(index, 1);
            const undo = () => data.splice(index, 0, content);

            mutate();
            const p = saveMetaData(data);
            undo();

            return p.then(() => {
                mutate();
                this._tagCounter.decrement(content.tags);

                return true;
            });
        });
    }
}

class TagCounter {
    constructor() {
        this._tags = new Map();
    }
    get tags() {
        return Array.from(this._tags.keys());
    }
    increment(keys) {
        for (let i = 0; i < keys.length; ++i) {
            this._increment(keys[i]);
        }
    }
    decrement(keys) {
        for (let i = 0; i < keys.length; ++i) {
            this._decrement(keys[i]);
        }
    }
    _increment(key) {
        if (this._tags.has(key)) {
            const v = this._tags.get(key);
            this._tags.set(key, v + 1);
        } else {
            this._tags.set(key, 1);
        }
    }
    _decrement(key) {
        if (!this._tags.has(key)) return;

        const v = this._tags.get(key);
        if (v === 1) {
            this._tags.delete(key);
        } else {
            this._tags.set(key, v - 1);
        }
    }
}

class ContentNotFoundError extends Error {}

function getDataManager() {
    return loadMetaData()
    .then(data => new DataManager(data));
}

function loadMetaData() {
    return getLocalStorageKeys(["version", "meta"])
    .then((keys) => {
        const version = keys.version;
        const json = keys.meta;

        if (isUdf(json) || json === null) {
            return [];
        }

        try {
            if (version === 2) {
                return parseVersion2(json);
            } else {
                return parseVersion1(json);
            }
        } catch (err) {
            console.warn("Unable to parse local storage metadata.");
            return [];
        }
    });
}

function parseVersion1(json) {
    return json
        .split("\n")
        .filter(s => s.length > 0)
        .map(s => JSON.parse(s));
}

function parseVersion2(json) {
    return JSON.parse(json);
}

function saveMetaData(data) {
    const meta = JSON.stringify(data);
    return setLocalStorageKeys({ meta, version: 2 });
}

function getLocalStorageKeys(keys) {
    return getStorageKeys(chrome.storage.local, keys);
}

function setLocalStorageKeys(keys) {
    return setStorageKeys(chrome.storage.local, keys);
}

function getStorageKeys(storage, keys) {
    return asyncWebApiToPromise(
        cb => storage.get(keys, cb)
    );
}

function setStorageKeys(storage, keys) {
    return asyncWebApiToPromise(
        cb => storage.set(keys, cb)
    ).catch((err) => {
        if (err instanceof WebApiError) {
            rethrowAs(err, LocalStorageMemoryError);
        } else {
            throw err;
        }
    });
}

class LocalStorageMemoryError extends WebApiError {}

export {
    getDataManager, LocalStorageMemoryError,
    getLocalStorageKeys, setLocalStorageKeys
};
