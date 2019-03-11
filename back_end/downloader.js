
const fs  	= require("fs");
const http  = require("http");
const https = require("https");
const parseDataUri = require("parse-data-uri");
const fileType = require("file-type");

function getDownloader(srcUrl, filePath)
{
	if (srcUrl.protocol === "http:")
	{
		return new HttpDownloader(srcUrl, http, filePath);
	}
	else if (srcUrl.protocol === "https:")
	{
		return new HttpDownloader(srcUrl, https, filePath);
	}
	else if (srcUrl.protocol === "data:")
	{
		return new DataURIDownloader(srcUrl, filePath);
	}
	else
	{
		throw new Error(srcUrl.protocol, "is not supported. Only http, https, and data protocols are supported.");
	}
}

class HttpDownloader
{
	constructor(srcUrl, protocol, filePath)
	{
		this.srcUrl   = srcUrl;
		this.protocol = protocol;
		this.filePath = filePath;
		this.headers  = {"User-Agent": "Mozilla/5.0"};
		this.ext 	  = this.parseExtension(srcUrl.pathname);
	}

	getPath()
	{
		return fs.realpathSync(this.filePath + this.ext);
	}

	async download(successCallback, errorCallback)
	{
		if (!this.ext)
		{
			this.ext = await wrap((...args) => this.getRemoteExtension(...args));
		}

		let wStream = fs.createWriteStream(this.filePath + this.ext);

		this.protocol.get(this.srcUrl, {headers: this.headers}, (rStream) => {
			console.log("download: connecting to", this.srcUrl.toString());

			rStream.pipe(wStream);
			wStream.on("finish", () => {
				console.log("\t", "download completed");
				wStream.close(() => successCallback(true));
			});
		}).on("error", (err) => {
			fs.unlink(this.filePath);
			errorCallback(err);
		});
	}

	getRemoteExtension(successCallback, errorCallback)
	{
		this.protocol.get(this.srcUrl, {headers: this.headers}, (rStream) => {
			const buf = rStream.read(fileType.minimumBytes);
			rStream.destroy();
			let ext = "." + fileType(buf).ext;
			successCallback(ext);
		}).on("error", (err) => {
			errorCallback(err);
		});
	}

	parseExtension(pathname)
	{
		let i   = pathname.lastIndexOf(".");
		if (i !== -1)
		{
			return "." + pathname.substring(i+1);
		}

		return null;
	}
}

class DataURIDownloader
{
	constructor(srcUrl, filePath)
	{
		let errorMessage = "Could not parse Data URI";

		this.srcUrl = srcUrl;

		let parsed = parseDataUri(srcUrl.toString());
		this.data = parsed.data;

		let slash = parsed.mimeType.indexOf("/");
		if (slash === -1)
		{
			throw new Error(errorMessage);
		}

		let type = parsed.mimeType.substring(0, slash);
		if (type !== "image" && type !== "video")
		{
			throw new Error(errorMessage);
		}

		let ext = parsed.mimeType.substring(slash+1);
		this.filePath = filePath + "." + ext;
	}

	download(successCallback, errorCallback)
	{
		console.log("download: connecting to", this.srcUrl.toString());

		fs.writeFile(this.filePath, this.data, (err) => {
			if (err)
			{
				errorCallback(err);
			}
			else
			{
				console.log("\t", "download completed");
				successCallback(true);
			}
		});
	}
}

module.exports = getDownloader;
