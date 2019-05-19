
const fs  	= require("fs"),
	  http  = require("http"),
	  https = require("https");

const parseDataUri = require("parse-data-uri"),
	  fileType = require("file-type");

const {U} = require("../../front_end/js/utility");

// @param srcUrl a url object of the resource to be downloaded.
// @param filePath path of the file without a file extension.
// 				   the extension is added on after the download. 
module.exports = function(srcUrl, filePath) {
	if (srcUrl.protocol === "http:")
	{
		return new HttpDownloader(http, srcUrl, filePath);
	}
	else if (srcUrl.protocol === "https:")
	{
		return new HttpDownloader(https, srcUrl, filePath);
	}
	else if (srcUrl.protocol === "data:")
	{
		return new DataURIDownloader(srcUrl, filePath);
	}
	else
	{
		let m = `${srcUrl.protocol} is not supported.\nOnly 'http', 'https', and 'data' are supported.`
		throw new Error(m);
	}
};

class HttpDownloader {
	constructor(protocol, srcUrl, filePath)
	{
		this._protocol = protocol;
		this._srcUrl   = srcUrl;
		this._filePath = filePath;
		this._headers  = {"User-Agent": "Mozilla/5.0"};

		let arr = U.parseFileName(srcUrl.pathname, true);
		this._ext = arr ? arr[1] : null;
	}

	// success: true
	// error: null
	async download(successCallback, errorCallback)
	{
		if (!this._ext)
		{
			this._ext = await U.bindWrap(this._getRemoteExtension, this).catch(() => {
				this._ext = "";
			});
		}

		let wStream = fs.createWriteStream(this._filePath + this._ext);

		this._protocol.get(this._srcUrl, {headers: this._headers}, (rStream) => {
			console.log("download: connecting to", this._srcUrl.toString());

			rStream.pipe(wStream);
			wStream.on("finish", () => {
				console.log("\t", "download completed");
				wStream.close(() => successCallback(true));
			});
		}).on("error", (err) => {
			console.warn(err);
			fs.unlink(this._filePath, U.noop);
			errorCallback(null);
		});
	}

	// success: the file extension
	// error: null
	_getRemoteExtension(successCallback, errorCallback)
	{
		let firstTime = true;

		this._protocol.get(this._srcUrl, {headers: this._headers}, (rStream) => {
			rStream.on("readable", () => {
				if (firstTime) {
					firstTime = false;
				} else {
					return;
				}

				const buf = rStream.read(fileType.minimumBytes);
				rStream.destroy();

				if (buf === null)
				{
					console.warn("Could not get fileType.minimumBytes from remote.");
					errorCallback(null);
					return;
				}

				let ft  = fileType(buf);
				if (!ft)
				{
					errorCallback(null);
					return;
				}
				let ext = "." + ft.ext;
				successCallback(ext);
			});
		}).on("error", (err) => {
			console.warn(err);
			errorCallback(null);
		});
	}

	get filePath()
	{
		return fs.realpathSync(this._filePath + this._ext);
	}
}

class DataURIDownloader {
	constructor(srcUrl, filePath)
	{
		this._srcUrl   = srcUrl;
		this._filePath = filePath;

		let parsed = parseDataUri(srcUrl.toString());
		this._data = parsed.data;

		let slash = parsed.mimeType.indexOf("/");
		if (slash === -1)
		{
			throw new Error(`Could not parse mimeType into 
							type and subtype: ${parsed.mimeType}`);
		}

		let type = parsed.mimeType.substring(0, slash);
		if (type !== "image" && type !== "video")
		{
			throw new Error(`type of data uri is not 'image' or 'video': ${type}`);
		}

		let ext = parsed.mimeType.substring(slash+1);
		this._ext = "." + ext;
	}

	// success: true
	// error: null
	download(successCallback, errorCallback)
	{
		console.log("downloading data uri:");

		fs.writeFile(this._filePath + this._ext, this._data, (err) => {
			if (err)
			{
				console.warn(err);
				errorCallback(null);
			}
			else
			{
				console.log("\t", "download completed");
				successCallback(true);
			}
		});
	}

	get filePath()
	{
		return fs.realpathSync(this._filePath + this._ext);
	}
}
