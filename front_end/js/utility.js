
this.U = new (function(){
	let self = this;

	this.noop = function(){}; // eslint-disable-line no-empty-function

	this.isUdf = function(arg) {
		return typeof arg === "undefined";
	};

	// @return concatenation of arguments and current date.
	this.makeTag = function() {
		let arr = Array.from(arguments);
		arr.push(Date.now());
		return arr.join("-");
	};

	// wraps f(...args, resolve, reject) in a Promise
	this.wrap = function(f, ...args) {
		return new Promise((resolve, reject) => {
			f(...args, resolve, reject);
		});
	};

	this.bindWrap = function(f, context, ...args) {
		return self.wrap(f.bind(context), ...args);
	};

	// @return an array of funcs bound to context
	this.bindAll = function(context, ...funcs) {
		return funcs.map(f => f.bind(context));
	};

	this.extend = function() {
        var master = {};
        for (var i = 0, l = arguments.length; i < l; i+=1) {
            var object = arguments[i];
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    master[key] = object[key];
                }
            }
        }
        return master;
    };

	this.removeDuplicates = function(arr, sorter) {
		arr.sort(sorter);
		for (let i = arr.length - 1; i >= 0; i-=1)
		{
			let a = arr[i];
			let b = arr[i-1];
			if ((sorter && sorter(a, b) === 0) || a === b)
			{
				arr.splice(i, 1);
			}
		}
		return arr;
	};

	this.getRandomDate = function(days) {
		let rand = Math.random() * days;
		let offset = rand * 24 * 60 * 60 * 1000;
		return Date.now() - offset;
	};

    // parses a filename from a url.
	// @return the filename or [name, .extension] if split is true.
	this.parseFileName = (function(){
		const rgx = /\w+(?:\.\w{3,4})+(?!.+\w+(?:\.\w{3,4})+)/;
		
		return function(pathname, split) {
			let matches = pathname.match(rgx);

			if (matches && matches.length > 0)
			{
				let match = matches[0];

				if (split)
				{
					let p = match.lastIndexOf(".");
					return [match.substring(0, p), match.substring(p)];
				}
				else
				{
					return match;
				}
			}
			else
			{
				return null;
			}
		};
	})();

	this.addClass = function(elm, classname) {
		if (!elm.classList.contains(classname))
		{
			elm.classList.add(classname);
		}
	};

	this.removeClass = function(elm, classname) {
		if (elm.classList.contains(classname))
		{
			elm.classList.remove(classname);
		}
	};

	this.injectCss = function(elm, url) {
		let link  = document.createElement("link");
		link.rel  = "stylesheet";
		link.type = "text/css";
		link.href = chrome.runtime.getURL(url);
		elm.appendChild(link);
	};

	this.injectThemeCss = function(elm, cssList, theme) {
		cssList.forEach((css) => {
			let url = "css/" + css + "-theme-" + theme + ".css";
			self.injectCss(elm, url);
		});
	};
})();
