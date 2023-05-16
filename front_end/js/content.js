
import { listenToOnMessage } from "./utility";

const POPUP_STYLE =
`position: fixed;
top: 0px;
left: 0px;
z-index: 1000;

display: none;
width: 100%;
height: 100%;

outline: none;
background: none;
border: none;`;

let el_popup;

function main() {
    el_popup = document.createElement("iframe");
    el_popup.style = POPUP_STYLE;
    document.body.insertBefore(el_popup, document.body.firstChild);

    listenToOnMessage((message) => {
        switch (message.request) {
            case "check-content-script-loaded":
                return true;
            case "open-popup": {
                loadPopup(message);

                return true;
            }
            case "close-popup":
                hidePopup();

                return true;
        }
    });
}

function loadPopup(message) {
    const query =
        `?tabId=${message.tabId}`
        + `&theme=${message.theme}`;

    el_popup.src = chrome.runtime.getURL("popup.html") + query;
    el_popup.addEventListener("load", () => {
        showPopup();
    });
}

function showPopup() {
    el_popup.style.display = "block";
}

function hidePopup() {
    el_popup.style.display = "none";
}

main();
