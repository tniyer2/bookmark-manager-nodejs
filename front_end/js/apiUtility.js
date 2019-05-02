
this.ApiUtility = new (function(){
	
	this.makeRequest = function(request) {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(request, (response) => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
					reject();
				}
				else if (response && typeof response === "object" && "error" in response)
				{
					reject();
				}
				else
				{
					resolve(response);
				}
			});
		});
	};
})();
