
const ContentCreator = {};
(function(){

	const FAVICON_CRAWLER_URL = "https://www.google.com/s2/favicons";
	const FAVICON_PATH = "/favicon.ico";

	this.createImage = function(source) {
		let image = document.createElement("img");
		image.src = source;
		return image;
	};

	this.createVideo = function(source) {
		let video = document.createElement("video");
		video.controls = true;
		video.loop = true;
		video.src = source;
		return video;
	};

	this.createIframe = function(source) {
		let iframe = document.createElement("iframe");
		iframe.src = source;
		return iframe;
	};

	this.getFaviconUrl = function(source) {
		let url = new URL(source);
		let faviconUrl = url.origin + FAVICON_PATH;
		return faviconUrl;
	};
}).call(ContentCreator);
