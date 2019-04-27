
this.ContentCreator = new (function(){

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

	this.createBookmark = function(source, link) {
		let bookmark = document.createElement("a");
		bookmark.classList.add("content__favicon");
		bookmark.href = link;
		bookmark.target = "_blank";

		let favicon = this.createImage(source);
		bookmark.appendChild(favicon);
		return bookmark;
	};
})();
