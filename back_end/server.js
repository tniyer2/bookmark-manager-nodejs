
const net 	  = require("net");
const url     = require("url");
const fs  	  = require("fs");
const path    = require("path");
const buffer  = require("buffer");
const console = require("console");

const getDownloader   = require("./downloader.js");

const searcher = require("../front_end/js/query.js");
const {wrap}   = require("../front_end/js/wrapper.js");

const RESOURCES_PATH = "back_end/resources";
const APP_ID_PREFIX	= "app_";

class NativeMessagingServer
{
	constructor(metaLoader, portPath)
	{
		this.metaLoader = metaLoader;
		this.meta = metaLoader.loadSync();

		this.portPath = portPath;
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
		    		request = JSON.parse(buff.toString("utf8", 4));
		    	}
		    	catch (e)
		    	{
		    		console.log(e);
		    		return;
		    	}

		    	let handle = request.type === "get"    ?  (r, cb) => this.get(r, cb):
					    	 request.type === "add"    ?  (r, cb) => this.add(r, cb):
					    	 request.type === "update" ?  (r, cb) => this.update(r, cb):
					    	 request.type === "pick"   ?  (r, cb) => this.pick(r, cb):
					    	 request.type === "delete" ?  (r, cb) => this.remove(r, cb):
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

		    fs.writeFileSync(this.portPath, lbuf);
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

	get(request, callback)
	{
		console.log("NM Server: client requested meta");
		console.log("\t", "query:", request.query);

		let result = searcher.query(this.meta, request.query);
		console.log("\t", "meta has been sent");

		return {tag: request.tag, meta: result};
	}

	add(request, callback)
	{
		console.log("NM Server: adding content to meta:", "'" + request.content.title + "'");

		let content = request.content;
		content.id  = APP_ID_PREFIX + searcher.getRandomString();

		if (request.download === true)
		{
			(async () => {
				
				let srcUrl   = new URL(content.srcUrl);
				let fileName = content.id;
				let filePath = path.join(RESOURCES_PATH, fileName);

				let d = getDownloader(srcUrl, filePath);
				await wrap(d.download.bind(d));

				content.path = d.getPath();
				this.metaLoader.saveSync(this.meta);
			})();
		}

		this.meta.push(content);
		console.log("\t", "content has been added");

		this.metaLoader.saveSync(this.meta);

		return {tag: request.tag, success: true};
	}

	update(request, callback)
	{
		throw new Error("handling update requests is not implemented.");
	}

	pick(request, callback)
	{
		console.log("NM Server: retrieving", request.id);

		let index = searcher.getId(this.meta, request.id);

		if (index === -1)
		{
			console.warn("\t", "Could not find element with id:", "'" + request.id + "'");
			return {tag: request.tag, badQuery: true};
		}

		let content = this.meta[index];
		return {tag: request.tag, content: content};
	}

	remove(request, callback)
	{
		console.log("NM Server: removing", request.id);

		let index = searcher.getId(this.meta, request.id);

		if (index === -1)
		{
			console.warn("\t", "Could not find element with id:", "'" + request.id + "'");
			return {tag: request.tag, badQuery: true};
		}

		let filePath = this.meta[index].path; 
		if (filePath)
		{
			fs.unlink(filePath, (err) => {
				if (err) console.warn("\t", err);
			});
		}

		this.meta.splice(index, 1);
		console.log("\t", "removed", request.id);

		this.metaLoader.saveSync(this.meta);
		return {tag: request.tag, success: true};
	}

	handleInvalid(request, callback)
	{
		console.log("NM Server: client sent invalid request type:", 
					"'" + request.type + "'");

		return {tag: request.tag, clientError: "Invalid Request Type"};
	}
}

module.exports = NativeMessagingServer;
