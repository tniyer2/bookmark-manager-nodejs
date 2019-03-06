
const net 	  = require("net");
const fs  	  = require("fs");
const buffer  = require("buffer");
const console = require("console");

class NativeMessagingServer
{
	constructor(metaLoader, portPath)
	{
		this.metaLoader = metaLoader;
		this.glb_meta = metaLoader.load();

		this.portPath = portPath;
	}

	run()
	{
		let tcpServer = net.createServer((stream) => {
		    console.log("NM Server: on connection");

	    	let writeObject = (jsonifiable) => {
	    		if (!jsonifiable)
	    			return;
	    		let s = JSON.stringify(jsonifiable);

				let lbuf = Buffer.alloc(4);
				lbuf.writeInt32LE(s.length, 0);
				stream.write(lbuf);
				stream.write(s);
			};

		    stream.on("data", (buff) => {
		    	console.log("NM Server: on data");

		    	let request = JSON.parse(buff.toString("utf8"));

		    	let handle = request.type === "get"    ?  (r, cb) => this.get(r, cb):
					    	 request.type === "add"    ?  (r, cb) => this.add(r, cb):
					    	 request.type === "update" ?  (r, cb) => this.update(r, cb):
					    	 request.type === "remove" ?  (r, cb) => this.remove(r, cb):
					    	 (r, cb) => this.handleInvalid(r, cb);

				let response = handle(request, writeObject);
				writeObject(response);
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
	}

	get(request, callback)
	{
		console.log("NM Server: sending meta");
		return {tag: request.tag, result: this.glb_meta};
	}

	add(request, callback)
	{
		console.log("NM Server: adding content to meta: ", "'" + request.content.title + "'");

		this.glb_meta.push(request.content);
		this.metaLoader.save(this.glb_meta);
		return {tag: request.tag};
	}

	update(request, callback)
	{

	}

	remove(request, callback)
	{

	}

	handleInvalid(request, callback)
	{
		console.log("NM Server: Cient sent invlalid request type: ", "'" + request.type + "'");
		return {tag: request.tag, clientError: "Invalid Request Method"};
	}
}

module.exports = {NativeMessagingServer: NativeMessagingServer};
