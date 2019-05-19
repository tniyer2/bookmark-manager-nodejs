
(function(){

	const cl_noTransition = "noanim";

	const el_appCheckbox = document.getElementById("app-checkbox"),
		  el_appSettings = document.getElementById("app-settings");

	const NM_PERMISSIONS = { permissions: ["nativeMessaging"] };

	async function main()
	{
		U.injectThemeCss(document.head, ["settings"], "light", ApiUtility.cssDir);

		attachChangeEvents();
		await load();
	}

	function attachChangeEvents()
	{
		let requestPermission = (evt) => {
			if (evt.target.checked)
			{
				(async () => {
					let has = await hasNativeMessaging();
					if (!has)
					{
						let granted = await requestNativeMessaging();
						if (!granted)
						{
							evt.target.checked = false;
							return;
						}
						else
						{
							setTimeout(alert, 0, "Refresh the extension to see changes.");
						}
					}

					evt.target.removeEventListener(evt.type, requestPermission);
					
					attachUpdateOnChange(el_appCheckbox, "enableNativeMessaging");
					evt.target.addEventListener(evt.type, () => {
						if (el_appCheckbox.checked) {
							U.show(el_appSettings);
						} else {
							U.hide(el_appSettings);
						}
					});
					evt.target.dispatchEvent(new Event(evt.type));
				})();
			}
		};
		el_appCheckbox.addEventListener("change", requestPermission);
	}

	function attachUpdateOnChange(input, settingName)
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

	async function load()
	{
		let settings = await ApiUtility.makeRequest({to: "background.js", request: "get-settings"}).catch(U.noop);

		setChecked(settings.enableNativeMessaging, el_appCheckbox);
	}

	function setChecked(checked, input)
	{
		U.addClass(input, cl_noTransition);
		input.checked = Boolean(checked);
		input.dispatchEvent(new Event("change"));
		setTimeout(() => {
			U.removeClass(input, cl_noTransition);
		}, 10);
	}

	function updateSettings(settings)
	{
		return ApiUtility.makeRequest({to: "background.js", request: "update-settings", settings: settings});
	}

	function hasNativeMessaging()
	{
		return new Promise((resolve) => {
			chrome.permissions.contains(NM_PERMISSIONS, resolve);
		});
	}

	function requestNativeMessaging()
	{
		return new Promise((resolve) => {
			chrome.permissions.request(NM_PERMISSIONS, resolve);
		});
	}

	main();
})();
