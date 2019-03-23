
(function(){
	// Wraps a function in a Promise
	this.wrap = function(f, ...args) {

		return new Promise((resolve, reject) => {
			f(...args, response => resolve(response),
					   error => reject(error));
		});
	};

	// returns a filename from a url
	// if split is true, returns [filename, ext]
	this.parseFileName = function(pathname, split) {

		const full = /\w+(?:\.\w{3,4})+(?!.+\w+(?:\.\w{3,4})+)/;
		let matches = pathname.match(full);

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
}).call(this);
