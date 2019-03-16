
(function(){
	// Wraps a function in a Promise
	function wrap(f, ...args)
	{
		return new Promise((resolve, reject) => {
			f(...args, response => resolve(response), 
					   error => reject(error));
		});
	}

	this.wrap = wrap;
}).call(this);
