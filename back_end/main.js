
const {app}   = require("electron"),
	  console = require("console");

const NativeMessagingServer = require("./server"),
	  MetaLoader = require("./appdata");

const META_PATH = "back_end/meta/meta.txt",
	  PORT_PATH = "native_messaging/port";

function main()
{
	try
	{
		let loader = new MetaLoader(META_PATH);
		let server = new NativeMessagingServer(loader, PORT_PATH);
		server.run();
	}
	catch (e)
	{
		console.log(e);
		throw e;
	}
}

app.on("ready", () => {
	main();
});
