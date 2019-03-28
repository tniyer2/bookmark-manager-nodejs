
(function(){

	this.createContent = function(meta) {
		
		let contentBlock = document.createElement("div");
		contentBlock.classList.add("content-block");

		let sourceBlock = document.createElement("div");
		sourceBlock.classList.add("content-block__source-block");

		let title = document.createElement("p");
		title.classList.add("content-block__title");
		let titleTextNode = document.createTextNode(meta.title);
		title.appendChild(titleTextNode);

		if (meta.category === "image")
		{
			let image = document.createElement("img");
			image.classList.add("content-block__image");
			image.src = meta.path ? meta.path : meta.srcUrl;

			sourceBlock.appendChild(image);
		}
		else if (meta.category === "video")
		{
			let video = document.createElement("video");
			video.classList.add("content-block__video");
			video.controls = true;
			video.loop = true;

			if (meta.path)
			{
				video.src = meta.path;
			}
			else
			{
				video.src = meta.srcUrl;
			}

			sourceBlock.appendChild(video);
		}
		else if (meta.category === "web")
		{
			// not supported for now
		}
		else
		{
			console.log("invalid category:", meta.category)
			return;
		}

		contentBlock.appendChild(sourceBlock);
		contentBlock.appendChild(title);

		return contentBlock;
	}
}).call(this);