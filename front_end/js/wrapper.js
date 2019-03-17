
(function(){
	// Wraps a function in a Promise
	this.wrap = function(f, ...args) {

		return new Promise((resolve, reject) => {
			f(...args, response => resolve(response), 
					   error => reject(error));
		});
	}
}).call(this);
