
const {app}   = require("electron");
const console = require("console");

const {NativeMessagingServer}  = require("./server");
const {MetaLoader} = require("./metaLoader");

const META_PATH = "back_end/meta/meta.txt";
const PORT_PATH = "native_messaging/port";

function main()
{
	let loader = new MetaLoader(META_PATH);
	let server = new NativeMessagingServer(loader, PORT_PATH);
	server.run();
}

app.on("ready", () => {
	main();
});