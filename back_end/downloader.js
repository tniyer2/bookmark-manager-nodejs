
const fs  	= require("fs");
const http  = require("http");
const https = require("https");

function download(srcUrl, filePath, successCallback, errorCallback)
{
	let makeRequest = (protocol) => {
		fs.writeFileSync(filePath, "");

		let wStream = fs.createWriteStream(filePath);
		protocol.get(srcUrl, (rStream) => {
			rStream.on("close", () => successCallback(true));
			rStream.pipe(wStream);
		});
	};

	if (srcUrl.protocol === "https:")
	{
		makeRequest(https);
	}
	else if (srcUrl.protocol === "http:")
	{
		makeRequest(http);
	}
	else if (srcUrl.protocol === "data:")
	{
		errorCallback("downloading from data URI not supported yet.");
	}
	else
	{
		errorCallback("srcUrl to download has an unkown protocol: " + srcUrl.protocol);
	}
}

module.exports = {download: download};
