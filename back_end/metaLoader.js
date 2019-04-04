
const fs = require("fs");
const console = require("console");
const {TagCounter} = require("../front_end/js/utility.js");

const TAGS_KEY = "tags";

class MetaLoader
{
	constructor(metaPath)
	{
		this._metaPath = metaPath;
		this._tracker = new TagCounter();
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
		content[TAGS_KEY].forEach((tag) => {
			this._tracker.increment(tag);
		});
	}

	remove(index)
	{
		let content = this._meta[index];
		content[TAGS_KEY].forEach((tag) => {
			this._tracker.decrement(tag);
		});
		this._meta.splice(index, 1);
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
			content[TAGS_KEY].forEach((tag) => {
				this._tracker.increment(tag);
			});
		});
	}

	saveSync()
	{
		console.log("MetaLoader: saving meta");

		let data = {meta: this._meta};
		let serializedData = JSON.stringify(data);
		fs.writeFileSync(this._metaPath, serializedData);
	}
}

module.exports = MetaLoader;
