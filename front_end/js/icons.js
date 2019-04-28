
this.IconGrabber = new (function(){

	const INT_URL = "https://infinity-api.infinitynewtab.com/get-icons?type=search&lang=en-US&page=0&keyword=";
	const TIMEOUT = 20 * 1000;

	const FAVICON_CRAWLER_URL = "https://www.google.com/s2/favicons";
	const FAVICON_PATH = "/favicon.ico";
	
	function findFirstUrl(json)
	{
		let matches = json.match(/\"(?<urls>http[^\"]+(?:.png|.jpg))\"/);
		console.log("matches:", matches);
		if (!matches)
		{
			return null;
		}
		return matches.groups.urls;
	}

	this.getUrl = function(source, successCallback, errorCallback) {
		let url = new URL(source);
		let firstDot = url.hostname.indexOf("www.");
		if (firstDot !== -1)
		{
			firstDot += 4;	
		}
		let lastDot = url.hostname.lastIndexOf(".");
		let sitename = url.hostname.substring(firstDot, lastDot);
		let getUrl = INT_URL + sitename;

		let xhr = new XMLHttpRequest(); 
		xhr.open("GET", getUrl);
		xhr.timeout = TIMEOUT;
		xhr.onreadystatechange = function(){
			if (this.readyState === 4)
			{
				if (this.status === 200)
				{
					let iconUrl = findFirstUrl(this.responseText);
					if (!iconUrl)
					{
						errorCallback();
					}
					else
					{
						successCallback(iconUrl);
					}
				}
				else
				{
					errorCallback();
				}
			}
		};
		xhr.send();
	};

	this.getFaviconUrl = function(source) {
		let url = new URL(source);
		let faviconUrl = url.origin + FAVICON_PATH;
		return faviconUrl;
	};
})();
