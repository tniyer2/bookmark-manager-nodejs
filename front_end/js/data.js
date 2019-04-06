
(function(){

	this.AppConnector = (function(){

		return class {
			constructor(appName, timeout)
			{
				this._appName = appName;
				this._timeout = timeout;
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
				}, this._timeout);

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
		};
	}).call(this);

	const DataManager = (function(){
		const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES - 1000;
		const TAGS_KEY = "tags";
		const ID_LENGTH = 40;

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

			get meta()
			{
				return this._meta;
			}

			// success: {success}
			// error: errors from save
			async addContent(content, successCallback, errorCallback)
			{
				content.id = getRandomString(ID_LENGTH);
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
			// error: {error}, errors from searchId, errors from save
			async deleteContent(contentId, successCallback, errorCallback)
			{
				let i;
				try {
					i = searchId(this._meta, contentId);
				} catch(e) {
					errorCallback(e);
					return;
				}
				let content = this._meta[i];
				if (!content)
				{
					errorCallback({error: true});
					return;
				}

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
			// error: {error}, errors from searchId
			async findContent(contentId, successCallback, errorCallback)
			{
				let i;
				try {
					i = searchId(this._meta, contentId);
				} catch(e) {
					console.warn(e);
					errorCallback(e);
					return;
				}

				let content = this._meta[i];
				console.log("i:", i);
				console.log("meta:", this._meta);
				console.log("content:", content);
				if (content)
				{
					successCallback({content: content});
				}
				else
				{
					errorCallback({error: true});
				}
			}
		};

		this.Outer = {};
		Object.defineProperty(this.Outer, "instance", { get: () => {
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

	this.RequestManager = (function(){
		const APP_ID_PREFIX = "app_";

		return class {
			constructor(connector)
			{
				this._connector = connector;
			}

			async getContent(sender, successCallback, errorCallback)
			{
				let port;
				let final = {};
				let blockAddResult = false;

				function addResult(v, a)
				{
					if (!v)
					{
						blockAddResult = true;
						console.log("result should not be " + v);
						errorCallback(null);
						return;
					}
					if (blockAddResult)
					{
						return;
					}

					let s = a ? "app" : "local";
					final[s] = v;
					if ((!port && final.local) ||
						(port && final.local && final.app))
					{
						successCallback(final);
					}
				}

				port = await wrap(this._connector.connect
							 .bind(this._connector))
							 .catch(e => console.warn(e));

				if (port)
				{
					let myTag = makeTag(sender.tab.id, "get");
					let request = { type: "get",
									tag: myTag };

					port.postMessage(request);
					port.onMessage.addListener((response) => {
						if (response.tag === myTag)
						{
							addResult(response, true);
						}
					});
				}

				let dm = await DataManager.instance;
				addResult({meta: dm.meta});
			}

			async addContent(content, cache, sender, successCallback, errorCallback)
			{
				let port = await wrap(this._connector.connect
						 		 .bind(this._connector))
						 		 .catch(e => console.warn(e));

				if (port)
				{
					let myTag = makeTag(sender.tab.id, "add");
					let appMessage = { type: "add",
									   tag: myTag,
									   content: content,
									   download: cache };

					console.log("content:", content);
					port.postMessage(appMessage);
					port.onMessage.addListener((response) => {
						if (response.tag === myTag)
						{
							successCallback(response);
						}
					});
				}
				else
				{
					let dm = await DataManager.instance;
					dm.addContent(content, successCallback, successCallback);
				}
			}

			// mode can be 'get' or 'delete'.
			async findContent(contentId, mode, sender, successCallback, errorCallback)
			{
				let modeIsFind   = mode === "find";
				let modeIsDelete = mode === "delete";

				if (!modeIsFind && !modeIsDelete)
				{
					console.warn("mode should not be:", mode);
					errorCallback(null);
					return;
				}

				if (fromApp(contentId))
				{
					let port = await wrap(this._connector.connect
									 .bind(this._connector))
									 .catch(e => console.warn(e));

					if (port)
					{
						let myTag = makeTag(sender.tab.id, mode);
						let request = { type: mode,
										tag: myTag,
										id: contentId };

						port.postMessage(request);
						port.onMessage.addListener((response) => {
							if (response.tag === myTag)
							{
								successCallback(response);
							}
						});
					}
					else
					{
						console.warn(`Cannot connect to app. Connection required 
									  for '${mode}' mode.`);
						successCallback({nmError: true});
					}
				}
				else
				{
					let dm = await DataManager.instance;
					if (modeIsFind)
					{
						dm.findContent(contentId, successCallback, successCallback);
					}
					else if (modeIsDelete)
					{
						dm.deleteContent(contentId, successCallback, successCallback);
					}
					else {/*should already be handled*/}
				}
			}

			async getTags(sender, successCallback, errorCallback)
			{
				let dm = await DataManager.instance;
				let localTags = dm.tags;

				let port = await wrap(this._connector.connect
								 .bind(this._connector))
								 .catch(e => console.warn(e));
				if (port)
				{
					let myTag = makeTag(sender.tab.id, "tags");
					let request = { type: "tags",
									tag: myTag };

					port.postMessage(request);
					port.onMessage.addListener((response) => {
						if (response.tag === myTag)
						{
							let obj = {};
							let f = (tag) => {obj[tag] = true;};
							localTags.forEach(f);
							response.tags.forEach(f);
							let tags = Object.keys(obj);
							successCallback(tags);
						}
					});
				}
				else
				{
					successCallback(localTags);
				}
			}
		};

		// Returns true if id is prefixed with APP_ID_PREFIX.
		function fromApp(contentId)
		{
			let sub = contentId.substring(0, 4);
			return sub === APP_ID_PREFIX;
		}
	}).call(this);

}).call(this);
