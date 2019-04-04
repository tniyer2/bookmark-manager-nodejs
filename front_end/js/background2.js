
(function(){

	this.AppConnector = (function(){
		const APP_TIMEOUT = 1000;

		return class {
			constructor(appName)
			{
				this._appName = appName;
			}

			async connect(successCallback)
			{
				if (!this._port)
				{
					this._port = await bindWrap(this._getPort, this);

					if (!this._port)
					{
						successCallback(null);
						return;
					}
				}

				let connected = await bindWrap(this._getStatus, this);
				if (connected)
				{
					// console.log("app status: connected");
					this._port.onDisconnect.addListener(() => {
						if (chrome.runtime.lastError)
						{
							console.warn(chrome.runtime.lastError.message);
						}
						this._port = null;
					});
					successCallback(this._port);
				}
				else
				{
					// console.log("app status: disconnected");
					successCallback(null);
				}
			}

			async getStatus(successCallback)
			{
				if (this._port)
				{
					_getStatus(successCallback);
				}
				else
				{
					successCallback(false);
				}
			}

			async _getPort(successCallback)
			{
				let timeoutId = setTimeout(() => {
					port.onDisconnect.removeListener(l);
					successCallback(port);
				}, APP_TIMEOUT);

				let port = chrome.runtime.connectNative(this._appName);
				port.onDisconnect.addListener(l);

				function l()
				{
					if (chrome.runtime.lastError)
					{
						console.warn(chrome.runtime.lastError.message);
					}
					clearTimeout(timeoutId);
					port.onDisconnect.removeListener(l);
					successCallback(null);
				}
			}

			async _getStatus(successCallback, errorCallback)
			{
				if (!this._port)
				{
					console.warn("this.port is", this._port);
					successCallback(false);
					return;
				}

				this._port.postMessage("status");
				this._port.onMessage.addListener(l);

				function l(response, port)
				{
					if (response.tag !== "status")
					{ 
						return;
					}

					port.onMessage.removeListener(l);
					if (response.status === "connected")
					{
						successCallback(true);
					}
					else if (response.status === "disconnected")
					{
						successCallback(false);
					}
					else
					{
						console.warn("unknown response:", response);
						successCallback(false);
					}
				}
			}
		}
	}).call(this);

	this.DataManager = (function(){
		const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES - 1000;
		const TAGS_KEY = "tags";

		return class {
			constructor()
			{
				this._tagTracker = new TagCounter();
			}

			_getTags(successCallback, errorCallback)
			{
				successCallback(this._tagTracker.tags);
			}

			async do()
			{
				console.log("arguments:", arguments);
				let len = arguments.length; 
				if (len < 3)
				{
					throw new Error("There should be at least 3 arguments.");
				}

				let type = arguments[0];
				let successCallback = arguments[len-2];
				let errorCallback = arguments[len-1];

				let subArgs = [];
				for (let i = 1; i < len-2; i+=1)
				{
					subArgs.push(arguments[i]);
				}

				let f = bindAll(this, this._getContent, this._addContent, 
									  this._deleteContent, this._findContent, 
									  this._getTags);
				let m = type === "get"    ? f[0]:
						type === "add"    ? f[1]:
						type === "delete" ? f[2]:
						type === "find"   ? f[3]:
						type === "tags"   ? f[4]:
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

				let success = await bindWrap(this._save, this).catch(errorCallback);
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
			async _deleteContent(contentId, successCallback, errorCallback)
			{
				let i = this._searchId(contentId);
				let content = this._meta[i];

				this._meta.splice(i, 1);

				let success = await bindWrap(this._save, this).catch(errorCallback);
				if (success)
				{
					let tags = content[TAGS_KEY];
					tags.forEach((tag) => {
						this._tagTracker.decrement(tag);
					});

					successCallback({success: true});
				}
			}

			// success: {content}
			async _findContent(contentId, successCallback, errorCallback)
			{
				let i = this._searchId(contentId);
				let content = this._meta[i];

				successCallback({content: content});
			}

			// success: index of content with contentId
			// error: null, {badQuery}
			_searchId(contentId)
			{
				let index = getId(this._meta, contentId);

				if (Number.isNaN(index))
				{
					console.warn("index is not of type Number:", index);
					throw new Error(null);
				}
				else if (index === -1)
				{
					let e = `Could not find content with id: '${contentId}'`;
					console.warn(e);
					throw new Error({badQuery: true});
				}
				else if (index < 0 || index >= this._meta.length)
				{
					console.warn(`index is out of range. 
								  this._meta.length: ${this._meta.length}, 
								  index: ${index}`);
					throw new Error(null);
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

}).call(this);