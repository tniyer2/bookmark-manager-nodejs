
import {
    rethrowAs, isUdf,
    WebApiError, asyncWebApiToPromise
} from "./utility.js";

class DataManager {
    constructor(data) {
        this._data = data;
        this._tagCounter = new TagCounter();

        this._lastContentId = null;
        this._sameIdCount = 0;

        for (let i = 0; i < data.length; ++i) {
            const content = data[i];
            this._tagCounter.increment(content.tags);
        }
    }
    get allTags() {
        return this._tagCounter.tags;
    }
    get allContent() {
        return this._data;
    }
    _findContent(id) {
        return this._data.findIndex(c => c.id === id);
    }
    findContent(contentId) {
        const index = this._findContent(contentId);
        if (index === -1) {
            return Promise.reject(
                new ContentNotFoundError("Can not find content.")
            );
        }
        const content = this._data[index];

        return Promise.resolve(content);
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
        content.id = this._createNewId();

        this._data.push(content);
        const p = saveMetaData(this._data);
        this._data.pop();

        return p.then(() => {
            this._data.push(content);
            this._tagCounter.increment(content.tags);

            return true;
        });
    }
    updateContent(contentId, updates) {
        const index = this._findContent(contentId);
        if (index === -1) {
            return Promise.reject(
                new ContentNotFoundError("Not found, can not update content.")
            );
        }
        const content = this._data[index];

        // not allowed to update id
        delete updates.id;
        const updatedContent = Object.assign({}, content, updates);

        this._data[index] = updatedContent;
        const p = saveMetaData(this._data);
        this._data[index] = content;

        return p.then(() => {
            this._data[index] = updatedContent;

            if (!isUdf(updates.tags)) {
                this._tagCounter.decrement(content.tags);
                this._tagCounter.increment(updates.tags);
            }

            return true;
        });
    }
    deleteContent(contentId) {
        const index = this._findContent(contentId);
        if (index === -1) {
            return Promise.reject(
                new ContentNotFoundError("Not found, can not delete content.")
            );
        }
        const content = this._data[index];

        this._data.splice(index, 1);
        const p = saveMetaData(this._data);
        this._data.splice(index, 0, content);

        return p.then(() => {
            this._data.splice(index, 1);
            this._tagCounter.decrement(content.tags);

            return true;
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
    return getLocalStorageKeys("meta")
    .then((keys) => {        
        const serialized = keys.meta;
        if (isUdf(serialized)) {
            return [];
        }
        
        const data = serialized
            .split("\n")
            .filter(s => s.length > 0)
            .map(s => JSON.parse(s));

        return data;
    });
}

function saveMetaData(data) {
    const serialized = data
        .map(content => JSON.stringify(content))
        .join("\n");
    
    return setLocalStorageKeys({ meta: serialized });
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
