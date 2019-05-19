
const net 	  = require("net"),
	  url     = require("url"),
	  fs  	  = require("fs"),
	  path    = require("path"),
	  buffer  = require("buffer"),
	  console = require("console");

const getDownloader = require("./downloader");

const {U} = require("../../front_end/js/utility");
const {MetaUtility} = require("../../front_end/js/metaUtility");

const RESOURCES_PATH = "back_end/resources",
	  APP_ID_PREFIX	= "app_",
	  ID_LENGTH = 40;

module.exports = class {
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

		    let sendResponse = (jsonifiable) => {
				let json = JSON.stringify(jsonifiable);
				let buf = Buffer.from(json, "utf8");

				let lbuf = Buffer.alloc(4);
				lbuf.writeInt32LE(buf.length, 0);

				stream.write(lbuf);
				stream.write(buf);
			};

		    stream.on("data", (buff) => {
		    	let request;
		    	try {
		    		let s = buff.toString("utf8", 4);
		    		request = JSON.parse(s);
		    	} catch (e) {
		    		console.log(e);
		    		return;
		    	}

		    	let t = request.type;
		    	let handle = t === "get-meta" 		? this._get:
		    				 t === "add-content" 	? this._add:
		    				 t === "update-content" ? this._update:
		    				 t === "find-content" 	? this._find:
		    				 t === "remove-content" ? this._remove:
		    				 t === "get-tags" 		? this._getTags:
		    				 this._handleInvalid;

		    	let sendResponseWrapper = (m) => {
		    		sendResponse({ tag: request.tag, 
		    					   message: m });
		    	};

				let m = handle.call(this, request.message, sendResponseWrapper);
				sendResponseWrapper(m);
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
			let m = `NM Server: closed
					${hadError ? " with transmission error" : ""}`;
			console.log(m);
		});
	}

	_get(request, callback)
	{
		console.log("NM Server: client requested meta");
		return {meta: this._loader.meta};
	}

	_add(request, callback)
	{
		console.log(`NM Server: adding content to meta: '${request.content.title}'`);

		let content = request.content;
		content.id = APP_ID_PREFIX + MetaUtility.getRandomString(ID_LENGTH);

		this._loader.add(content);

		if (request.download === true)
		{
			(async () => {

				let srcUrl   = new URL(content.srcUrl);
				let fileName = content.id;
				let filePath = path.join(RESOURCES_PATH, fileName);

				let d;
				try {
					d = getDownloader(srcUrl, filePath);
					await U.bindWrap(d.download, d);
				} catch (e) {
					console.log(e.message);
					return;
				}
				
				this._loader.update(content.id, {path: d.filePath});
			})();
		}

		console.log("\t", "content has been added");
		return {success: true};
	}

	_find(request, callback)
	{
		console.log("NM Server: retrieving", request.id);

		let content = this._loader.find(request.id);
		if (content)
		{
			return {content: content};
		}
		else
		{
			console.log("\t", "could not find", request.id);
			return {notFound: true};
		}
	}

	_remove(request, callback)
	{
		console.log("NM Server: removing", request.id);

		let content = this._loader.remove(request.id);
		if (content)
		{
			let filePath = content.path;
			if (filePath)
			{
				fs.unlink(filePath, (err) => {
					if (err) console.warn("\t", err);
				});
			}

			return {success: true};
		}
		else
		{
			console.log("\t", "could not find", request.id);
			return {notFound: true};
		}
	}

	_update(request, callback)
	{
		let contentId = request.id;
		let updateInfo = request.params.info;
		console.log("NM Server: updating", contentId);
		console.log("\t", "keys to update:", updateInfo);

		let content = this._loader.update(contentId, updateInfo);
		if (content)
		{
			return {success: true};
		}
		else
		{
			console.log("\t", "could not find", contentId);
			return {notFound: true};
		}
	}

	_getTags(request, callback)
	{
		return {tags: this._loader.tags};
	}

	_handleInvalid(request, callback)
	{
		let e = `NM Server: client sent invalid request type: '${request.type}'`;
		console.log(e);
		return {error: e};
	}
};
