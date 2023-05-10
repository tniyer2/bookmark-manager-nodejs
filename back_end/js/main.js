
const { Menu, Tray, app, BrowserWindow } = require("electron");
const console = require("console");

const NativeMessagingServer = require("./server"),
      MetaLoader = require("./appdata");

const META_PATH = "back_end/meta/meta.txt",
      PORT_PATH = "native_messaging/port",
      MAIN_PAGE_PATH = "back_end/html/index.html",
      ICON_PATH = "back_end/icon.png";

const TRAY_TOOLTIP = "my desktop app";

let g_win, g_tray;

app.on("ready", () => {
    runServer();
    createGUI();
});

function runServer()
{
    try
    {
        let loader = new MetaLoader(META_PATH);
        let server = new NativeMessagingServer(loader, PORT_PATH);
        server.run();
    }
    catch (e)
    {
        console.log(e);
        throw e;
    }
}

function createGUI()
{
    let g_win = createWindow(MAIN_PAGE_PATH, () => g_win = null);

    app.on("window-all-closed", () => {});

    g_tray = new Tray(ICON_PATH);
    const contextMenu = Menu.buildFromTemplate([{
        label: "Quit",
        click: () => {
            app.quit();
        }
    }]);

    g_tray.setToolTip(TRAY_TOOLTIP);
    g_tray.setContextMenu(contextMenu);
    g_tray.on("click", () => {
        if (!g_win)
        {
            g_win = createWindow(MAIN_PAGE_PATH, () => g_win = null);
        }
    });
}

function createWindow(src, deference)
{
    let win = new BrowserWindow();
    win.on('closed', () => {
        deference();
     });
    win.loadFile(src);
    return win;
}
