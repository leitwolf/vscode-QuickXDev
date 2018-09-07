import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { ServerProxy } from './Proxy';
import { Builder } from './Builder';
import URI from 'vscode-uri';

/**
 * 插件配置，定义于package.json文件中
 */
interface Settings {
    root: string;
}
// 当前插件配置选项，要跟client发送过来的一样
interface MySettings {
    quickxdev: Settings;
}

class Config0 {

    // 设置
    private _settings: Settings;
    // 插件所在目录uri
    private _root: string;
    // 项目根目录uri
    private _workspaceRoot: string;
    // Quick目录uri
    private _quickRoot: string;
    // 是否是Quick-cocos2dx项目
    private _isQuickX: boolean = false;

    // 是否已初始化过Setting
    private _initSettinged: boolean = false;

    constructor() {
    }
    /**
     * 初始化
     */
    public initWorkspace(workspaceRoot: string) {
        this._workspaceRoot = workspaceRoot;
        let cocos2d = workspaceRoot + "/src/cocos/cocos2d";
        this._isQuickX = fs.existsSync(new URL(cocos2d));

        // 插件所在目录
        let root = path.join(__dirname, "../../../");
        root = path.resolve(root);
        this._root = URI.file(root).toString();
    }
    /**
     * 初始化配置
     */
    public changeSettings(settings: any) {
        let s = <MySettings>settings;
        this._settings = s.quickxdev;
        if (!this._settings.root) {
            // 没有设置root，则从系统环境变量中获取
            this._settings.root = process.env.QUICK_V3_ROOT;
        }
        // 转换为uri
        this._quickRoot = null;
        if (this._settings.root) {
            this._quickRoot = URI.file(this._settings.root).toString();
        }
        console.log("QuickX root:", this._quickRoot);

        // 通知前端quick目录
        ServerProxy.sendRequest("quickRoot", this.quickRoot);

        if (this._isQuickX && !this.quickRoot) {
            ServerProxy.showMessageWarning("还没有设置Quick引擎目录!");
        }

        if (!this._initSettinged) {
            // console.log("init setting");
            // 开始初始化项目
            Builder.initWorkspace();
            this._initSettinged = true;
        }
    }
    /**
     * 配置选项
     */
    public get settings(): Settings {
        return this._settings;
    }
    /**
     * Quick-Cocos2dx 根目录
     */
    public get quickRoot(): string {
        return this._quickRoot;
    }
    /**
     * 项目目录
     */
    public get workspaceRoot(): string {
        return this._workspaceRoot;
    }
    /**
     * 插件目录
     */
    public get root(): string {
        return this._root;
    }
    /**
     * 是否是quick-cocos2dx项目
     */
    public get isQuickX(): boolean {
        return this._isQuickX;
    }
}
/**
 * 配置文件管理
 */
export const Config = new Config0();