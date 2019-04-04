
(function(){
	const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES - 1000;
	const TAGS_KEY = "tags";

	return class {

		constructor()
		{
			this._tagTracker = new TagCounter();
		}

		get tags()
		{
			return this._tagTracker.tags;
		}

		async do()
		{
			let len = arguments.length; 
			if (len < 3)
			{
				throw new Error("There should be at least 3 arguments.");
			}

			let type = arguments[0];
			let successCallback = arguments[len - 1];
			let errorCallback = arguments[len - 2];

			let subArgs = [];
			for (let i = 0; i < len-2; i+=1)
			{
				subArgs.push(arguments[i]);
			}

			let f = bindAll(this, _getContent, _addContent, 
							_deleteContent, _findContent);
			let m = type === "get"    ? f[0]:
					type === "add"    ? f[1]:
					type === "delete" ? f[2]:
					type === "find"   ? f[3]:
					null;
			if (!m)
			{
				throw new Error(`type is not valid: '${type}'`); 
			}
			else
			{
				if (isUdf(this._meta))
				{
					this._meta = await bindWrap(this._load, this).catch(errorCallback);
					if (isUdf(this._meta)) return;
				}
				m(...subArgs, successCallback, errorCallback);
			}
		}

		// success: {queried content}
		// error: badQuery
		async _getContent(q, successCallback, errorCallback)
		{
			let result;
			try
			{
				result = query(this._meta.slice(), q);
			}
			catch (e)
			{
				console.warn(e);
				errorCallback({badQuery: true});
				return;
			}

			successCallback({meta: result});
		}

		// success: {success}
		async _addContent(content, successCallback, errorCallback)
		{
			content.id = getRandomString();
			this._meta.push(content);

			let success = await wrap(save).catch(e => errorCallback(e));
			if (success)
			{
				let tags = content[TAGS_KEY];
				tags.forEach((tag) => {
					this._tagTracker.increment(tag);
				});
				successCallback({success: true});
			}
		}

		// success: {success}
		async _deleteContent(id, successCallback, errorCallback)
		{
			let index = await wrap(_findIndex, id).catch(errorCallback);
			if (isUdf(index)) return;
			let removed = this._meta.splice(index, 1)[0];

			let success = await wrap(save).catch(errorCallback);
			if (success)
			{
				let tags = removed[TAGS_KEY];
				tags.forEach((tag) => {
					this._tagTracker.decrement(tag);
				});

				successCallback({success: true});
			}
		}

		// success: {content}
		async _findContent(id, successCallback, errorCallback)
		{
			let index = await wrap(_findIndex, id).catch(errorCallback);
			if (isUdf(index)) return;
			let content = this._meta[index];

			successCallback({content: content});
		}

		// success: index in this._meta of the content with the matching id.
		// error: badQuery
		_findIndex(contentId)
		{
			let index = getId(this._meta, contentId);

			if (index === -1)
			{
				let e = `Could not find content with id: '${contentId}'`;
				console.warn(e);
				throw new Error({badQuery: true});
			}
			else
			{
				return index;
			}
		}

		// success: meta
		// error: {error}
		async _load(successCallback, errorCallback)
		{
			let data = await getKeyWrapper("meta").catch(errorCallback);
			if (isUdf(data)) return;
			let serialized = data.meta;
			if (!serialized)
			{
				successCallback([]);
				return;
			}

			let meta = [];
			let parts = serialized.split("\n").filter(i => i);
			for (let i = 0, l = parts.length; i < l; i+=1)
			{
				let s = parts[i];
				try
				{
					let obj = JSON.parse(s);
					meta.push(obj);
				}
				catch (e)
				{
					console.warn(e);
					errorCallback({error: true});
					return;
				}
			}

			meta.forEach((content) => {
				content[TAGS_KEY].forEach((tag) => {
					this._tagTracker.increment(tag);
				});
			});

			successCallback(meta);
		}

		// success: true
		// error: {error}, {memoryError}
		async _save(successCallback, errorCallback)
		{
			let serialized = "";
			for (let content of this._meta)
			{
				serialized += JSON.stringify(content) + "\n";
			}

			if (serialized.length > LOCAL_QUOTA)
			{
				errorCallback({memoryError: true});
				return;
			}

			chrome.storage.local.set({meta: serialized}, (response) => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
					errorCallback({error: true});
				}
				else
				{
					successCallback(true);
				}
			});
		}
	}

	// success: data retrieved from storage
	// error: error
	function getKeyWrapper(keys)
	{
		return new Promise((resolve, reject) => {
			chrome.storage.local.get(keys, (response) => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
					reject({error: true});
				}
				else
				{
					resolve(response);
				}
			});
		});
	}
}).call(this);
