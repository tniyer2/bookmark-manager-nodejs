
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
		console.log("MetaLoader: loading meta");
		let meta = [];

		if (!fs.existsSync(this.metaPath))
		{
			fs.writeFileSync(this.metaPath, "");
			return meta;
		}

		let s = fs.readFileSync(this.metaPath, {encoding: "utf8"});
		if (!s) return meta;

		let full = JSON.parse(s);
		for (let obj of full.list)
		{
			meta.push(obj);
		}

		return meta;
	}

	saveSync(meta)
	{
		console.log("MetaLoader: saving meta");

		let full = {list: meta};
		let s = JSON.stringify(full);
		fs.writeFileSync(this.metaPath, s);
	}
}

module.exports = MetaLoader;
