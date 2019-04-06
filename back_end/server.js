
const net 	  = require("net");
const url     = require("url");
const fs  	  = require("fs");
const path    = require("path");
const buffer  = require("buffer");
const console = require("console");

const getDownloader = require("./downloader");

const {Searcher} = require("../front_end/js/query");
const {wrap, getRandomString, searchId} = require("../front_end/js/utility");

const RESOURCES_PATH = "back_end/resources";
const APP_ID_PREFIX	= "app_";
const ID_LENGTH = 40;

class NativeMessagingServer
{
	constructor(loader, portPath)
	{
		loader.loadSync();
		this._loader = loader;

		this._portPath = portPath;
	}

	run()
	{
		let tcpServer = net.createServer((stream) => {
		    console.log("NM Server: on connection");

	    	let writeObject = (jsonifiable) => {
	    		if (!jsonifiable)
	    		{
	    			return;
	    		}
	    		let s = JSON.stringify(jsonifiable);
	    		let length = s.length;

				let lbuf = Buffer.alloc(4);
				lbuf.writeInt32LE(length, 0);
				stream.write(lbuf);
				stream.write(s);
			};

		    stream.on("data", (buff) => {
		    	console.log("NM Server: on data");

		    	let request;
		    	try
		    	{
		    		let s = buff.toString("utf8", 4);
		    		// console.log("unparsed data:", s);
		    		request = JSON.parse(s);
		    	}
		    	catch (e)
		    	{
		    		console.log(e);
		    		return;
		    	}

		    	let handle = request.type === "get"    ?  (r, cb) => this._get(r, cb):
					    	 request.type === "add"    ?  (r, cb) => this._add(r, cb):
					    	 request.type === "update" ?  (r, cb) => this._update(r, cb):
					    	 request.type === "find"   ?  (r, cb) => this._find(r, cb):
					    	 request.type === "delete" ?  (r, cb) => this._delete(r, cb):
					    	 request.type === "tags"   ?  (r, cb) => this._getTags(r, cb):
					    	 (r, cb) => this.handleInvalid(r, cb);

				let syncResponse = handle(request, writeObject);
				writeObject(syncResponse);
		    });
		});

		tcpServer.listen(0, "localhost", () => {
		    console.log("NM Server: on listening");

		    let port = tcpServer.address().port;
		    console.log("\t", "listening on port: " + port);

		    let lbuf = Buffer.alloc(4);
			lbuf.writeInt32LE(port, 0);

		    fs.writeFileSync(this._portPath, lbuf);
		});

		tcpServer.on("error", (err) => {
			console.log("NM Server:", err);
			tcpServer.close();
		});

		tcpServer.on("close", (hadError) => {
			if (hadError)
				console.log("NM Server: closed with transmission error");
			else
				console.log("NM Server: closed");
		});
	}

	_get(request, callback)
	{
		console.log("NM Server: client requested meta");
		console.log("\t", "meta has been sent");

		return {tag: request.tag, meta: this._loader.meta};
	}

	_add(request, callback)
	{
		console.log(`NM Server: adding content to meta: '${request.content.title}'`);

		let content = request.content;
		content.id = APP_ID_PREFIX + getRandomString(ID_LENGTH);

		if (request.download === true)
		{
			(async () => {

				let srcUrl   = new URL(content.srcUrl);
				let fileName = content.id;
				let filePath = path.join(RESOURCES_PATH, fileName);

				let d = getDownloader(srcUrl, filePath);
				await wrap(d.download.bind(d));

				content.path = d.getPath();
				this._loader.saveSync();
			})();
		}

		this._loader.add(content);
		console.log("\t", "content has been added");

		this._loader.saveSync();

		return {tag: request.tag, success: true};
	}

	_update(request, callback)
	{
		throw new Error("handling update requests is not implemented.");
	}

	_find(request, callback)
	{
		console.log("NM Server: retrieving", request.id);

		let index;
		try {
			index = searchId(this._loader.meta, request.id);
		} catch (e)  {
			console.warn("\t", e);
			return {tag: request.tag, content: null};
		}

		let content = this._loader.meta[index];
		return {tag: request.tag, content: content};
	}

	_delete(request, callback)
	{
		console.log("NM Server: removing", request.id);

		let index;
		try {
			index = searchId(this._loader.meta, request.id);
		} catch (e)  {
			console.warn("\t", e);
			return {tag: request.tag, content: null};
		}

		let filePath = this._loader.meta[index].path;
		if (filePath)
		{
			fs.unlink(filePath, (err) => {
				if (err) console.warn("\t", err);
			});
		}

		this._loader.remove(index);
		console.log("\t", "removed", request.id);

		this._loader.saveSync();
		return {tag: request.tag, success: true};
	}

	_getTags(request, callback)
	{
		return {tag: request.tag, tags: this._loader.tags};
	}

	_handleInvalid(request, callback)
	{
		let e = "NM Server: client sent invalid request type:" +
				"'" + request.type + "'";

		console.log(e);
		return {tag: request.tag, error: e};
	}
}

module.exports = NativeMessagingServer;
