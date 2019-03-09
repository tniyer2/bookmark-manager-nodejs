
const fs  	= require("fs");
const http  = require("http");
const https = require("https");

function download(srcUrl, filePath, successCallback, errorCallback)
{
	let makeRequest = (protocol) => {
		let wStream = fs.createWriteStream(filePath);
		let headers = {"User-Agent": "Mozilla/5.0"};

		protocol.get(srcUrl, {headers: headers}, (rStream) => {
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
