import { installLog } from './config';
import { Commands, Events } from "../Drupal";
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import install from './installer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import startServer from './php-server';
import * as Sentry from "@sentry/electron/main";

Sentry.init({
    beforeSend: async (event, hint) => {
        try {
            hint.attachments = [{
                filename: 'install.log',
                data: await readFile(installLog, { encoding: 'utf-8' }),
                contentType: 'text/plain',
            }];
        }
        catch {
            // Couldn't read the install log, so just omit it.
        }
        return event;
    },
    dsn: "https://12eb563e258a6344878c10f16bbde85e@o4509476487233536.ingest.de.sentry.io/4509476503683152",
    // We don't need to send any PII at all, so explicitly disable it. It's disabled
    // by default, but we don't want it changing unexpectedly.
    sendDefaultPii: false,
});

ipcMain.on( Commands.Start, async ({ sender: win }): Promise<void> => {
    try {
        await install(win);

        const { url, serverProcess } = await startServer();
        app.on('will-quit', () => serverProcess.kill());

        win.send(Events.Started, url);
    }
    catch (e) {
        // Send the exception to Sentry so we can analyze it later, without requiring
        // users to file a GitHub issue.
        Sentry.captureException(e);
        win.send(Events.Error, e);
    }
} );

ipcMain.on(Commands.Open, (undefined, url: string): void => {
    shell.openExternal(url);
} );

// Quit the app when all windows are closed. Normally you'd keep keep the app
// running on macOS, even with no windows open, since that's the common pattern.
// But for a pure launcher like this one, it makes more sense to just quit.
app.on('window-all-closed', app.quit);

function createWindow (): void
{
    const win = new BrowserWindow({
        width: 800,
        height: 500,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        },
    });
    Menu.setApplicationMenu(null);
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then((): void => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
