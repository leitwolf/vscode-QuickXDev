'use strict';
import * as path from "path";
import { ServerOptions, TransportKind, LanguageClientOptions, LanguageClient } from "vscode-languageclient";
import { OutputChannel, WorkspaceFolder, TextDocument, workspace, ExtensionContext, window, StatusBarItem, StatusBarAlignment, env, commands } from "vscode";
import { existsSync, readFileSync } from "fs";
import { URL } from "url";
import { execFile, ChildProcess } from "child_process";
import URI from "vscode-uri";

/**
 * 每个工作空间一个后端服务
 */

// 客户端列表，以路径为key
let clients: Map<string, LanguageClient> = new Map();

// 服务器模块文件路径
let serverModule: string;
// 当前调试端口，每加一个则+1
let debugPort = 6009;
let outputChannel: OutputChannel;

// 任务栏信息
let statusBars: StatusBarItem[] = [];
// Quick目录
let quickRoot: string;
let playerProcess: ChildProcess;

/**
 * 建立一个客户端
 * @param folder 
 */
function createClient(folder: WorkspaceFolder) {
    // 语言服务器调试参数
    debugPort++;
    let debugOptions = { execArgv: ["--nolazy", "--inspect=" + debugPort] };
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    }
    let clientOptions: LanguageClientOptions = {
        // 语言服务器输出channel,console.log(...)
        outputChannel: outputChannel,
        // 服务端要处理的语言类型
        documentSelector: [{ scheme: 'file', language: 'lua' }],
        workspaceFolder: folder,
        // 需要同步的内容
        synchronize: {
            // 同步设置选项到语言服务器
            configurationSection: 'quickxdev',
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        },
    }
    let client = new LanguageClient('QuickXDev', 'QuickXDevServer', serverOptions, clientOptions);
    // 定义自定义事件
    client.onReady().then(() => {
        // 显示/隐藏任务栏
        client.onRequest("showStatusBar", (message: { text: string, color: string }) => {
            let statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 0);
            if (message.color != "") {
                statusBar.color = message.color;
            }
            statusBar.text = message.text;
            statusBar.show();
            statusBars.push(statusBar);
        });
        client.onRequest("hideStatusBar", () => {
            for (let i = 0; i < statusBars.length; i++) {
                statusBars[i].dispose();
            }
            statusBars = [];
        });
        // 后端发送Quick目录
        client.onRequest("quickRoot", (text: string) => {
            quickRoot = text;
        });
        // 后端请求当前文档指定行数信息，当前文档的uri与参数相符
        client.onRequest("getDocLine", (params: { filepath: string, line: number }): string => {
            let activeDoc = window.activeTextEditor.document;
            if (activeDoc.fileName != params.filepath || activeDoc.lineCount < params.line) {
                return "";
            }
            return activeDoc.lineAt(params.line).text;
        });
    });
    client.start();
    clients.set(folder.uri.toString(), client);
}

/**
 * 打开一个文档时调用
 * @param document 
 */
function didOpenTextDocument(document: TextDocument) {
    // 只处理lua文件
    if (document.languageId !== "lua" || document.uri.scheme !== "file") {
        return;
    }
    let folder = workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
        return;
    }
    if (!clients.get(folder.uri.toString())) {
        // 还没有建立该工作目录对应的客户端
        createClient(folder);
    }
}

/**
 * 运行Player
 */
function runPlayer() {
    // 先关闭之前的
    if (playerProcess) {
        playerProcess.kill();
        playerProcess = null;
    }
    if (!quickRoot) {
        window.showErrorMessage("没有设置QuickX目录");
        return;
    }
    let playerPath = quickRoot + "/quick/player/";
    if (process.platform == "win32") {
        playerPath += "win32/player3.exe";
    }
    else if (process.platform == "darwin") {
        playerPath += "player3.app/Contents/MacOS/player3";
    }
    else {
        window.showErrorMessage("抱歉，不支持当前制作系统!");
        return;
    }

    if (!existsSync(new URL(playerPath))) {
        window.showErrorMessage("Player不存在");
        return;
    }

    let activeFile = window.activeTextEditor.document.fileName;
    let workDirUri = workspace.getWorkspaceFolder(URI.file(activeFile)).uri;
    let client = clients.get(workDirUri.toString());
    if (!client) {
        return
    }
    client.sendRequest("isQuickX").then((isQuickX: boolean) => {
        if (!isQuickX) {
            window.showErrorMessage("非 quick 项目下不能运行 Player！");
            return;
        }

        let playerFsPath = URI.parse(playerPath).fsPath;
        // 加上参数
        let args: string[] = [];
        args.push("-workdir");
        args.push(workDirUri.fsPath);
        let configPath = workDirUri.toString() + "/src/config.lua";
        let config = getQuickConfig(configPath);
        if (config) {
            let debug = config.debug;
            if (debug == 0) {
                args.push("-disable-write-debug-log");
                args.push("-disable-console");
            }
            else if (debug == 1) {
                args.push("-disable-write-debug-log");
                args.push("-console");
            }
            else if (debug == 2) {
                args.push("-write-debug-log");
                args.push("-console");
            }
            args.push("-size");
            args.push(config.width + "x" + config.height);
        }

        // 运行
        playerProcess = execFile(playerFsPath, args);
    });
}
// 获取Quick项目配置信息
function getQuickConfig(configPath: string): { debug: number, width: number, height: number } {
    if (!existsSync(new URL(configPath))) {
        return null;
    }
    let re = { debug: 1, width: 640, height: 480 };
    let data: string = readFileSync(new URL(configPath), "utf-8");
    let lines = data.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("--")) {
            continue;
        }
        let arr = line.split("=");
        if (arr.length == 2) {
            let key = arr[0].trim();
            let value = arr[1].trim();
            if (key == "DEBUG") {
                re.debug = parseInt(value);
            } else if (key == "CONFIG_SCREEN_WIDTH") {
                re.width = parseInt(value);
            } else if (key == "CONFIG_SCREEN_HEIGHT") {
                re.height = parseInt(value);
            }
        }
    }
    return re;
}

// 激活插件
export function activate(context: ExtensionContext) {
    serverModule = context.asAbsolutePath(path.join("out", "src", "server", "server.js"));
    outputChannel = window.createOutputChannel("QuickXDev");

    workspace.onDidOpenTextDocument(didOpenTextDocument);
    // 已打开文件的调用
    workspace.textDocuments.forEach(didOpenTextDocument);
    // 关闭时删除对应的客户端
    workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.removed) {
            let client = clients.get(folder.uri.toString());
            if (client) {
                clients.delete(folder.uri.toString());
                client.stop();
            }
        }
    });

    // 注册命令
    let openPlayerCmd = commands.registerCommand("quickxdev.runPlayer", runPlayer);
    context.subscriptions.push(openPlayerCmd);
}

// 插件停止激活时调用
export function deactivate(): Thenable<void> {
    let promises: Thenable<void>[] = [];
    for (const client of clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}