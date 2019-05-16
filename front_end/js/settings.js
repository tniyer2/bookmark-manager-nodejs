
(function(){

	const cl_noTransition = "noanim";

	const el_appCheckbox = document.getElementById("app-checkbox"),
		  el_appSettings = document.getElementById("app-settings");

	async function main()
	{
		U.injectThemeCss(document.head, ["settings"], "light");
		el_appCheckbox.addEventListener("change", (evt) => {
			if (el_appCheckbox.checked) {
				U.show(el_appSettings);
			} else {
				U.hide(el_appSettings);
			}
		});
		await load();
		attachChangeEvents();
	}

	async function load()
	{
		let settings = await ApiUtility.makeRequest({to: "background.js", request: "get-settings"}).catch(U.noop);

		setChecked(settings.enableNativeMessaging, el_appCheckbox);
	}

	function setChecked(checked, input)
	{
		U.addClass(input, cl_noTransition);
		if (checked) {
			input.setAttribute("checked", "checked");
		} else {
			input.removeAttribute("checked");
		}
		input.dispatchEvent(new Event("change"));
		setTimeout(() => {
			U.removeClass(input, cl_noTransition);
		}, 10);
	}

	function attachChangeEvents()
	{
		attachChecked(el_appCheckbox, "enableNativeMessaging");
	}

	function attachChecked(input, settingName)
	{
		inner();
		function inner()
		{	
			input.addEventListener("change", () => {
				updateSettings({[settingName]: input.checked}).then(() => {
					inner();
				});
			}, {once: true});
		}
	}

	function updateSettings(settings)
	{
		return ApiUtility.makeRequest({to: "background.js", request: "update-settings", settings: settings});
	}

	main();
})();
