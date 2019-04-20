
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

	function createYoutube(source)
	{
		let iframe = document.createElement("iframe");
		iframe.src = source;
		return iframe;
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
		let content;
		if (meta.category === "image")
		{
			content = createImage(source);
		}
		else if (meta.category === "video")
		{
			content = createVideo(source);
		}
		else if (meta.category === "youtube")
		{
			content = createYoutube(meta.srcUrl);
		}
		else if (meta.category === "bookmark")
		{
			content = createIcon(source);
		}
		else
		{
			console.log("invalid category:", meta.category);
			return;
		}

		sourceBlock.appendChild(content);
		contentBlock.appendChild(sourceBlock);
		contentBlock.appendChild(title);

		return contentBlock;
	};
}).call(this);
