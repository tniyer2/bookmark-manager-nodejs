
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

		let INNER_INSTANCE; 

		this.Inner = class {
			constructor(meta)
			{
				this._tagTracker = new TagCounter();

				meta.forEach((content) => {
					content[TAGS_KEY].forEach((tag) => {
						this._tagTracker.increment(tag);
					});
				});
				this._meta = meta;
			}

			get tags()
			{
				return this._tagTracker.tags;
			}

			// success: {meta}
			// error: {badQuery}
			async getContent(q, successCallback, errorCallback)
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
			// error: from save
			async addContent(content, successCallback, errorCallback)
			{
				content.id = getRandomString();
				this._meta.push(content);

				let success = await wrap(save, this._meta).catch(errorCallback);
				if (isUdf(success)) return;

				let tags = content[TAGS_KEY];
				tags.forEach((tag) => {
					this._tagTracker.increment(tag);
				});

				successCallback({success: true});
			}

			// success: {success}
			// error: from _searchId, from save
			async deleteContent(contentId, successCallback, errorCallback)
			{
				let i;
				try {
					i = this._searchId(contentId);
				} catch(e) {
					errorCallback(e);
					return;
				}
				let content = this._meta[i];

				this._meta.splice(i, 1);

				let success = await wrap(save, this._meta).catch(errorCallback);
				if (isUdf(success)) return;

				let tags = content[TAGS_KEY];
				tags.forEach((tag) => {
					this._tagTracker.decrement(tag);
				});

				successCallback({success: true});
			}

			// success: {content}
			// error: from _searchId
			async findContent(contentId, successCallback, errorCallback)
			{
				let i;
				try {
					i = this._searchId(contentId);
				} catch(e) {
					errorCallback(e);
					return;
				}

				let content = this._meta[i];

				successCallback({content: content});
			}

			// success: index of content with contentId
			// error: {error}, {badQuery}
			_searchId(contentId)
			{
				let index = getId(this._meta, contentId);

				if (Number.isNaN(index))
				{
					console.warn("index is not of type Number:", index);
					throw {error: true};
				}
				else if (index === -1)
				{
					let e = `Could not find content with id: '${contentId}'`;
					console.warn(e);
					throw {badQuery: true};
				}
				else if (index < 0 || index >= this._meta.length)
				{
					console.warn(`index is out of range. 
								  this._meta.length: ${this._meta.length}, 
								  index: ${index}`);
					throw {error: true};
				}
				else
				{
					return index;
				}
			}
		};

		this.Outer = function(){};
		Object.defineProperty(this.Outer, "Operator", { get: () => {
			return new Promise((resolve, reject) => {
				if (INNER_INSTANCE)
				{
					resolve(INNER_INSTANCE);
				}
				else
				{
					(async () => {
						let meta = await wrap(load).catch(reject);
						if (isUdf(meta)) return;

						INNER_INSTANCE = new Inner(meta);
						resolve(INNER_INSTANCE);
					})();
				}
			});
		}});

		return this.Outer;

		// success: meta
		// error: {error}
		async function load(successCallback, errorCallback)
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
			let list = serialized.split("\n").filter(o => o);
			for (let i = 0, l = list.length; i < l; i+=1)
			{
				let s = list[i];
				try
				{
					let content = JSON.parse(s);
					meta.push(content);
				}
				catch (e)
				{
					console.warn(e);
					errorCallback({error: true});
					return;
				}
			}

			successCallback(meta);
		}

		// success: true
		// error: {error}, {memoryError}
		async function save(meta, successCallback, errorCallback)
		{
			let serialized = "";
			for (let i = 0, l = meta.length; i < l; i+=1)
			{
				let content = meta[i];
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

		// success: object with keys
		// error: {error}
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
