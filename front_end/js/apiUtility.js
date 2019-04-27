
this.ApiUtility = new (function(){
	
	this.makeRequest = function(request, successCallback, errorCallback) {
		chrome.runtime.sendMessage(request, (response) => {

			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				errorCallback(null);
			}
			else if (response && typeof response === "object" && "error" in response)
			{
				console.log("error in request:", response.error);
				errorCallback(null);
			}
			else
			{
				successCallback(response);
			}
		});
	};
})();
