
(function(){

	const FAVICON_CRAWLER_URL = "https://www.google.com/s2/favicons";

	function createImage(source)
	{
		let image = document.createElement("img");
		image.classList.add("content-block__image");
		image.src = source;
		return image;
	}

	function createVideo(source)
	{
		let video = document.createElement("video");
		video.classList.add("content-block__video");
		video.controls = true;
		video.loop = true;
		video.src = source;
		return video;
	}

	function createIcon(source)
	{
		let url = new URL(source);
		let faviconUrl = FAVICON_CRAWLER_URL + "?domain=" + url.hostname;
		return createImage(faviconUrl);
	}

	this.createContent = function(meta) {

		let contentBlock = document.createElement("div");
		contentBlock.classList.add("content-block");

		let sourceBlock = document.createElement("div");
		sourceBlock.classList.add("content-block__source-block");

		let title = document.createElement("p");
		title.classList.add("content-block__title");
		let titleTextNode = document.createTextNode(meta.title);
		title.appendChild(titleTextNode);

		let source = meta.path ? meta.path : meta.srcUrl;
		if (meta.category === "image")
		{
			let image = createImage(source);
			sourceBlock.appendChild(image);
		}
		else if (meta.category === "video")
		{
			let video = createVideo(source);
			sourceBlock.appendChild(video);
		}
		else if (meta.category === "bookmark")
		{
			let favicon = createIcon(source);
			sourceBlock.appendChild(favicon);
		}
		else
		{
			console.log("invalid category:", meta.category);
			return;
		}

		contentBlock.appendChild(sourceBlock);
		contentBlock.appendChild(title);

		return contentBlock;
	};
}).call(this);
