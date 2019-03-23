
class ListCreator
{
	constructor()
	{
		this.test = document.createElement("canvas");
	}

	createList(srcUrl, category, title, options)
	{
		options = this._extend(options);

		let li = document.createElement("li");
		li.classList.add("sourceMenu__list__element");

		let arr = parseFileName(srcUrl, true);
		let ext = arr ? arr[1].substring(1) : null;

		let filenameTextNode = document.createTextNode(title);
		li.appendChild(filenameTextNode);
		if (ext)
		{
			this._addTag(li, ext);
		}

		if (options.showDimensions === true)
		{
			if (category === "image")
			{
				this._testDimensions(srcUrl, "img", (w, h) => {
					this._addTag(li, w + "x" + h);
				});
			}
			else if (category === "video")
			{
				this._testDimensions(srcUrl, "video", (w, h) => {
					this._addTag(li, w + "p");
				});
			}
			else
			{
				let e = "category should not be " + category;
				throw Error(e);
			}
		}

		return li;
	}

	_extend(options) 
	{
		const DEFAULTS = { showDimensions: true };

		let final = {};
		let all = [DEFAULTS, options];

		for (let obj of all)
		{
		    for (let key in obj) 
		    {
		        if (obj.hasOwnProperty(key)) 
		        {
		            final[key] = obj[key];
		        }
		    }
		}

		return final;
	}

	_testDimensions(url, tagname, callback)
	{
		let elm = document.createElement(tagname);
		elm.src = url;

		elm.addEventListener("load", () => {
			callback(elm.naturalWidth, elm.naturalHeight);
			this.test.removeChild(elm);
		});
		elm.addEventListener("error", (e) => {
			console.warn(e);
		});

		this.test.appendChild(elm);
	}

	_addTag(li, text)
	{
		let pixelTag = document.createElement("div");
			pixelTag.classList.add("sourceMenu__tag");
		let textNode = document.createTextNode(text);
		
		pixelTag.appendChild(textNode);
		li.appendChild(pixelTag);
	}
}
