
this.DataManager = new (function(){
	const TAG_KEY = "tags";
	const ID_LENGTH = 40;

	let instance;
	let self = this;

	// resolves data, rejects undefined
	this.getKeyWrapper = function(keys) {
		return new Promise((resolve, reject) => {
			ApiUtility.getLocalData(keys, (data) => {
				if (ApiUtility.lastError)
				{
					console.warn(ApiUtility.lastError.message);
					reject();
				}
				else
				{
					resolve(data);
				}
			});
		});
	};

	// resolves undefined, rejects {memoryError: true}
	this.setKeyWrapper = function(data) {
		return new Promise((resolve, reject) => {
			ApiUtility.setLocalData(data, () => {
				if (ApiUtility.lastError)
				{
					console.warn(ApiUtility.lastError.message);
					reject({memoryError: true});
				}
				else
				{
					 resolve();
				}
			});
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
				U.wrap(load).then((meta) => {
					instance = new Inner(meta);
					resolve(instance);
				}).catch(reject);
			}
		});
	}});

	class Inner {
		constructor(meta)
		{
			this._tagTracker = new MetaUtility.TagCounter();

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

		addContent(content, cb, onErr)
		{
			content.id = MetaUtility.getRandomString(ID_LENGTH);
			this._meta.push(content);

			U.wrap(save, this._meta).then(() => {
				this._tagTracker.increment(content[TAG_KEY]);
				cb(this._successResponse);
			}).catch((err) => {
				this._meta.pop();
				onErr(err);
			});
		}

		deleteContent(contentId, params, cb, onErr)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				this._meta.splice(index, 1);

				U.wrap(save, this._meta).then(() => {
					this._tagTracker.decrement(content[TAG_KEY]);
					cb(this._successResponse);
				}).catch((err) => {
					this._meta.splice(index, 0, content);
					onErr(err);
				});
			}
			else
			{
				onErr(this._notFoundError);
			}
		}

		findContent(contentId, params, cb, onErr)
		{
			let {content} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				cb({content: content});
			}
			else
			{
				onErr(this._notFoundError);
			}
		}

		// @todo find a way to undo update if save fails.
		updateContent(contentId, params, cb, onErr)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				delete params.info.id;

				this._meta[index] = U.extend(content, params.info);

				U.wrap(save, this._meta).then(() => {
					if (params.info[TAG_KEY])
					{
						this._tagTracker.decrement(content[TAG_KEY]);
						this._tagTracker.increment(params.info[TAG_KEY]);
					}
					cb(this._successResponse);
				}).catch((err) => {
					this._meta[index] = content;
					onErr(err);
				});
			}
			else
			{
				onErr(this._notFoundError);
			}
		}
	}

	async function load(cb, onErr)
	{
		let data = await self.getKeyWrapper("meta").catch(onErr);
		if (U.isUdf(data)) return;

		let json = data.meta;
		if (!json)
		{
			cb([]);
			return;
		}

		let meta;
		try {
			meta = json.split("\n").filter(Boolean).map(s => JSON.parse(s));
		} catch (e) {
			console.warn(e);
			onErr();
			return;
		}
		cb(meta);
	}

	function save(meta, cb, onErr)
	{
		let serialized = meta.map(content => JSON.stringify(content)).join("\n");
		self.setKeyWrapper({meta: serialized}).then(cb, onErr);
	}
})();

this.RequestManager = (function(){
	return class {
		getContent(cb, onErr)
		{
			DataManager.instance.then((dm) => {
				cb(dm.meta);
			}).catch(onErr);
		}

		getTags(cb, onErr)
		{
			DataManager.instance.then((dm) => {
				cb(dm.tags);
			}).catch(onErr);
		}

		addContent(content, cb, onErr)
		{
			DataManager.instance.then((dm) => {
				dm.addContent(content, cb, onErr);
			}).catch(onErr);
		}

		findContent(contentId, cb, onErr)
		{
			DataManager.instance.then((dm) => {
				dm.findContent(contentId, null, cb, onErr);
			}).catch(onErr);
		}

		deleteContent(contentId, cb, onErr)
		{
			DataManager.instance.then((dm) => {
				dm.deleteContent(contentId, null, cb, onErr);
			}).catch(onErr);
		}

		updateContent(contentId, updateInfo, cb, onErr)
		{
			DataManager.instance.then((dm) => {
				dm.updateContent(contentId, {info: updateInfo}, cb, onErr);
			}).catch(onErr);
		}
	};
})();
