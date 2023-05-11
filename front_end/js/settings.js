
import { injectThemeCss, sendMessage } from "./utility.js";
import { RadioManager } from "./widgets.js";

(function(){
    const el_tagRules = document.getElementById("tag-rules"),
          el_addTagRuleBtn = document.getElementById("add-tag-rule-btn"),
          el_downloadMetaBtn = document.getElementById("download-meta-btn"),
          el_themeRadio = document.getElementById("theme-radio");

    const cl_tagRule = "rule",
          cl_name = "name",
          cl_value = "value",
          cl_deleteBtn = "delete";

    let g_settings,
        g_tagRules;

    async function main() {
        g_settings = await getSettings();
        injectThemeCss(["settings"], g_settings.theme);

        g_tagRules = g_settings.tagRules || [];
        initTagRules(g_tagRules);
        el_addTagRuleBtn.addEventListener("click", () => {
            const info = {};
            createTagRuleDom(info);
            g_tagRules.push(info);
            updateTagRules();
        });

        el_downloadMetaBtn.addEventListener("click", () => {
            sendMessage({
                to: "background.js",
                request: "get-meta"
            }).then((meta) => {
                const s = JSON.stringify(meta);
                const b = new Blob([s]);
                const url = URL.createObjectURL(b, {type: "text/plain"});
                chrome.downloads.download({url: url, filename: "bookmark_manager_data.txt"});
            }).catch((e) => {
                if (e) console.warn(e);
                console.warn("could not download data, something went wrong");
            });
        });

        initThemeRadio();
    }

    function initTagRules(tagRules) {
        tagRules.forEach((r) => {
            createTagRuleDom(r);
        });
    }

    function createTagRuleDom(info) {
        const root = document.createElement("div");
        root.classList.add(cl_tagRule);

        const valueInput = document.createElement("input");
        if (info.value) {
            valueInput.value = info.value;
        }
        valueInput.classList.add(cl_value);
        root.appendChild(valueInput);
        valueInput.addEventListener("change", (evt) => {
            const value = evt.target.value;
            if (value.length < 2) return;

            const arr = value.split("=");
            if (!arr || arr.length !== 2) {
                evt.target.value = "";
                return;
            }
            info.tag = arr[0].trim();
            info.links = arr[1].split(",").map(a => a.trim());
            info.value = value;
            console.log("info:", info, g_tagRules);
            updateTagRules();
        });
        valueInput.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
                valueInput.blur();
            }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "&times;";
        deleteBtn.classList.add(cl_deleteBtn);
        root.appendChild(deleteBtn);
        deleteBtn.addEventListener("click", () => {
            const i = g_tagRules.findIndex(a => a === info);
            if (i !== -1) {
                g_tagRules.splice(i, 1);
            }
            updateTagRules();
            root.remove();
        });

        el_tagRules.appendChild(root);
    }

    function updateTagRules() {
        updateSettings({tagRules: g_tagRules});
    }

    function initThemeRadio() {
        const inputs = el_themeRadio.querySelectorAll("input");
        const radio = new RadioManager(inputs);
        radio.select(g_settings.theme);
        radio.onSelect((input) => {
            updateSettings({theme: input.value});
        });
    }

    function getSettings() {
        return sendMessage({
            to: "background.js",
            request: "get-settings"
        });
    }

    function updateSettings(settings) {
        return sendMessage({
            to: "background.js",
            request: "update-settings",
            settings
        });
    }

    main();
})();
