
(function(){

	injectThemeCss("light", ["alerts", "single-view"]);

	const CONTENT_ID = getIdFromHref();

	const el_main = document.getElementById("main");
	const el_log = el_main.querySelector("#log");
	const el_deleteBtn = el_main.querySelector("#delete-btn");

	const alerter = new Widgets.AwesomeAlerter(document.body, {BEMBlock: "alerts"});

	chrome.runtime.sendMessage({request: "find-meta", id: CONTENT_ID}, (response) => {

		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			return;
		}

		if (response.content)
		{
			let textNode = document.createTextNode(JSON.stringify(response.content));
			el_log.appendChild(textNode);
			el_deleteBtn.disabled = false;
		}
		else
		{
			console.warn("Could not handle response:", response);
		}
	});

	el_deleteBtn.addEventListener("click", requestDelete, {once: false});

	function createContent(content){}

	function requestDelete()
	{
		let message = {request: "delete-meta", id: CONTENT_ID};
		makeRequest(message, () => {
			window.close();
		}, () => {
			alerter.alert("could not delete. something went wrong.", 3);
		});
	}

	function getIdFromHref()
	{
		let decoded = decodeURI(location.search);
		let index 	= decoded.indexOf("?");

		let id;
		if (index == decoded.length - 1)
		{
			id = "";
		}
		else
		{
			id = decoded.substring(index + 1);
		}

		return id;
	}
}).call(this);
