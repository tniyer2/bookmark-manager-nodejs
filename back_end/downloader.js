
const fs  	= require("fs");
const http  = require("http");
const https = require("https");

const parseDataUri = require("parse-data-uri");
const fileType = require("file-type");

const {wrap, parseFileName, noop} = require("../front_end/js/utility.js");

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
		throw new Error(srcUrl.protocol, "is not supported. Only 'http', 'https', and 'data' are supported.");
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

		let arr = parseFileName(srcUrl.pathname, true);
		this.ext = arr ? arr[1] : null;
	}

	async download(successCallback, errorCallback)
	{
		if (!this.ext)
		{
			this.ext = await wrap(this._getRemoteExtension.bind(this)).catch(() => {
				this.ext = "";
			});
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
			fs.unlink(this.filePath, noop);
			errorCallback({downloadError: err});
		});
	}

	_getRemoteExtension(successCallback, errorCallback)
	{
		let firstTime = true;

		this.protocol.get(this.srcUrl, {headers: this.headers}, (rStream) => {
			rStream.on("readable", () => {
				if (firstTime)
				{
					firstTime = false;
				}
				else
				{
					return;
				}

				const buf = rStream.read(fileType.minimumBytes);
				rStream.destroy();

				if (buf === null)
				{
					console.warn("Could not get file type from remote.");
					errorCallback(null);
					return;
				}

				let ft  = fileType(buf);
				let ext = "." + ft.ext;
				successCallback(ext);
			});
		}).on("error", (err) => {
			console.warn(err);
			errorCallback(null);
		});
	}

	getPath()
	{
		return fs.realpathSync(this.filePath + this.ext);
	}
}

class DataURIDownloader
{
	constructor(srcUrl, filePath)
	{
		let errorMessage = "Could not parse Data URI";

		this.srcUrl   = srcUrl;
		this.filePath = filePath;

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

		let ext  = parsed.mimeType.substring(slash+1);
		this.ext = "." + ext;
	}

	download(successCallback, errorCallback)
	{
		console.log("downloading data uri:");

		fs.writeFile(this.filePath + this.ext, this.data, (err) => {
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

	getPath()
	{
		return fs.realpathSync(this.filePath + this.ext);
	}
}

module.exports = getDownloader;
