
const fs = require("fs");
const console = require("console");

class MetaLoader
{
	constructor(metaPath)
	{
		this.metaPath = metaPath;
	}

	loadSync()
	{
		console.log("loading meta . . .");
		let meta = [];

		if (!fs.existsSync(this.metaPath))
		{
			fs.writeFileSync(this.metaPath, "");
			return meta;
		}

		let s = fs.readFileSync(this.metaPath, {encoding: "utf8"});
		if (!s) return meta;

		let all = JSON.parse(s);
		for (let obj of all.list)
		{
			meta.push(obj);
		}

		return meta;
	}

	saveSync(meta)
	{
		console.log("saving meta . . .");

		let all = {list: meta};
		let s = JSON.stringify(all);
		fs.writeFileSync(this.metaPath, s);
	}
}

module.exports = {MetaLoader: MetaLoader};
