
const fs = require("fs");
const console = require("console");

const {U} = require("../../front_end/js/utility");
const {MetaUtility} = require("../../front_end/js/metaUtility");

const TAGS_KEY = "tags";

module.exports = class {
	constructor(metaPath)
	{
		this._metaPath = metaPath;
		this._tracker = new MetaUtility.TagCounter();
	}

	get meta()
	{
		return this._meta;
	}

	get tags()
	{
		return this._tracker.tags;
	}

	add(content)
	{
		this._meta.push(content);
		this._tracker.increment(content[TAGS_KEY]);
		this._saveSync();
	}

	find(contentId)
	{
		let {content} = MetaUtility.searchId(this._meta, contentId);
		return content;
	}

	remove(contentId)
	{
		let {content, index} = MetaUtility.searchId(this._meta, contentId);
		if (!content) return null;

		this._tracker.decrement(content[TAGS_KEY]);
		this._meta.splice(index, 1);

		this._saveSync();

		return content;
	}

	update(contentId, info)
	{
		let {content, index} = MetaUtility.searchId(this._meta, contentId);
		if (!content) return null;

		if (info[TAGS_KEY])
		{
			this._tracker.decrement(content[TAGS_KEY]);
			this._tracker.increment(info[TAGS_KEY]);
		}

		delete info.id;
		this._meta[index] = U.extend(content, info);
		
		this._saveSync();

		return content;
	}

	loadSync()
	{
		console.log("MetaLoader: loading meta");

		this._meta = [];

		if (!fs.existsSync(this._metaPath))
		{
			fs.writeFileSync(this._metaPath, "");
			return;
		}

		let serializedData = fs.readFileSync(this._metaPath, {encoding: "utf8"});
		if (!serializedData)
		{
			return;
		}

		let data = JSON.parse(serializedData);
		for (let content of data.meta)
		{
			this._meta.push(content);
		}

		this._meta.forEach((content) => {
			this._tracker.increment(content[TAGS_KEY]);
		});
	}

	_saveSync()
	{
		console.log("MetaLoader: saving meta");

		let data = {meta: this._meta};
		let serializedData = JSON.stringify(data);
		fs.writeFileSync(this._metaPath, serializedData);
	}
};
