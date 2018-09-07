import * as fs from 'fs';
import * as luaparse from "luaparse";
import * as rd from 'rd';
import { URL } from 'url';
import { CompletionItem, CompletionItemKind, InsertTextFormat, Definition, Location } from "vscode-languageserver";
import URI from 'vscode-uri';
import { parseDoc } from './AstParser';
import { Config } from './Config';
import { DocItem, FileDoc } from './types';
import { ServerProxy } from './Proxy';
import { setLineEnding } from 'crlf-helper';

// luaparse解析参数
interface ParseOption {
    comments: boolean;
    scope: boolean;
    locations: boolean;
    ranges: boolean;
    luaVersion: string;
}

/**
 * 生成自动列表
 */
class Builder0 {

    // 解析参数
    private _option: ParseOption;

    // c++预加载列表
    private _cppList: DocItem[];
    // 关键字列表
    private _keyList: CompletionItem[];
    // 文档列表，包括系统函数
    private _fileList: FileDoc[];

    // 客户端最后发送的文字，自动完成时不用重复加载
    private _lastText: string = "";

    // 是否已初始化了，解析完项目内所有的lua文件
    private _inited: boolean = false;
    private _total: number;
    private _count: number;

    constructor() {
        this._option = <ParseOption>{};
        this._option.comments = false;
        this._option.scope = true;
        this._option.locations = true;
        this._option.ranges = false;
        this._option.luaVersion = '5.1';

        this._cppList = [];
        this._fileList = [];
        this._keyList = [];
        this.initKeys();
    }
    /**
     * 关键字
     */
    private initKeys(): void {
        var strs = ["and", "break", "if", "else", "elseif", "end", "false", "function", "local", "in", "nil", "not", "or", "return", "then", "true", "while"];
        for (let i = 0; i < strs.length; i++) {
            const str = strs[i];
            let item = <CompletionItem>{};
            item.label = str;
            item.kind = CompletionItemKind.Keyword;
            this._keyList.push(item);
        }
    }
    /**
     * 初始化整个工作区，解析所有的lua代码文件
     */
    public initWorkspace(): void {
        // 在任务栏显示提示
        let statusText = "初始化 Quickx 项目...";
        if (!Config.isQuickX) {
            statusText = "初始化 lua 项目...";
        }
        ServerProxy.showStatusBar("$(zap)", "#00ff00");
        ServerProxy.showStatusBar(statusText);

        // 延时
        setTimeout(() => {
            this.initWorkspace2();
        }, 150);
    }
    private initWorkspace2(): void {
        if (Config.isQuickX) {
            this.initCpp();
        }
        this.initLuaSystem();

        let rootPath = URI.parse(Config.workspaceRoot).fsPath;
        rd.readFileFilter(rootPath, /\.lua$/, (err: Error, paths: string[]) => {
            this._total = paths.length;
            this._count = 0;
            for (let i = 0; i < paths.length; i++) {
                const p = paths[i];
                fs.readFile(p, "utf-8", (err1: NodeJS.ErrnoException, data: string) => {
                    // console.log("read", p);
                    this._count++;
                    let fileuri = URI.file(p).toString();
                    this.parse(fileuri, data);
                    if (this._count >= this._total) {
                        this._inited = true;
                        ServerProxy.hideStatusBar();
                        // console.log("inited");
                        // this.initedTest();
                    }
                })
            }
        })
    }
    /**
     * 初始化lua系统变量及函数
     */
    private initLuaSystem(): void {
        let path = Config.root + "/files/lua5_1.lua";
        path = URI.parse(path).fsPath;
        fs.readFile(path, "utf-8", (err1: NodeJS.ErrnoException, data: string) => {
            // console.log("read", path);
            let fileuri = URI.file(path).toString();
            this.parse(fileuri, data);

            // 第一个为模块
            for (let i = 0; i < this._fileList.length; i++) {
                const file = this._fileList[i];
                if (file.uri == fileuri) {
                    for (let j = 0; j < file.globals.length; j++) {
                        const docItem = file.globals[j];
                        if (docItem.items && docItem.items.length > 0) {
                            docItem.completion.kind = CompletionItemKind.Module;
                        }
                    }
                }
            }
        });
    }
    private initedTest(): void {
        for (let i = 0; i < this._fileList.length; i++) {
            const fileDoc = this._fileList[i];
            for (let j = 0; j < fileDoc.globals.length; j++) {
                const item = fileDoc.globals[j];
                if (item.name == "CONFIG_SCREEN_HEIGHT") {
                    console.log(item.virtual, fileDoc.uri, item.loc);
                }
            }
        }
    }
    /**
     * 建立cpp列表
     */
    private initCpp(): void {
        this._cppList = [];
        let cppPath = Config.root + "/files/cpp.json";
        let data = fs.readFileSync(new URL(cppPath), "utf-8");
        let jsonData = JSON.parse(data);
        for (let i = 0; i < jsonData.length; i++) {
            const moduleItem = jsonData[i];
            let loc = this.getCppLoc(moduleItem["loc"]);
            let moduleDocItem = this.createVarDocItem(moduleItem["name"], null, true, loc);
            moduleDocItem.items = [];
            this._cppList.push(moduleDocItem);
            let classes: Object[] = moduleItem["classes"];
            if (classes && classes.length > 0) {
                for (let j = 0; j < classes.length; j++) {
                    const classItem = classes[j];
                    let loc = this.getCppLoc(classItem["loc"]);
                    let classDocItem = this.createVarDocItem(classItem["name"], moduleDocItem.name, false, loc);
                    classDocItem.items = [];
                    moduleDocItem.items.push(classDocItem);
                    let funcs: Object[] = classItem["functions"];
                    if (funcs && funcs.length > 0) {
                        for (let k = 0; k < funcs.length; k++) {
                            const funcItem = funcs[k];
                            let loc = this.getCppLoc(funcItem["loc"]);
                            let funcDocItem = this.createFuncDocItem(funcItem["name"], classDocItem.name, funcItem["params"], loc);
                            classDocItem.items.push(funcDocItem);
                        }
                    }
                }
            }
        }
    }
    private createVarDocItem(name: string, base: string, isModule: boolean, loc: any[]): DocItem {
        var docItem = <DocItem>{};
        docItem.name = name;
        let completion = <CompletionItem>{};
        completion.label = name;
        if (isModule) {
            completion.kind = CompletionItemKind.Module;
        }
        else {
            completion.kind = CompletionItemKind.Variable;
        }
        var detail = name;
        if (base) {
            detail = "(" + base + ") " + detail;
        }
        completion.detail = detail;
        docItem.completion = completion;
        docItem.loc = loc;
        return docItem;
    }
    private createFuncDocItem(name: string, base: string, params: string[], loc: any[]): DocItem {
        let params2 = "";
        let params3 = "";
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            if (i != 0) {
                params2 += ", ";
                params3 += ", ";
            }
            params2 += "${" + (i + 1) + ":" + p + "}";
            params3 += p;
        }
        let completion = <CompletionItem>{};
        completion.label = name;
        completion.kind = CompletionItemKind.Function;
        completion.insertTextFormat = InsertTextFormat.Snippet;
        completion.insertText = name + "(" + params2 + ")";
        let detail = name + "(" + params3 + ")";
        if (base) {
            detail = "(" + base + ") " + detail;
        }
        completion.detail = detail;

        let funcDocItem = <DocItem>{};
        funcDocItem.name = name;
        funcDocItem.loc = loc;
        funcDocItem.completion = completion;

        return funcDocItem;
    }
    /**
     * 生成cpp类的Loc
     * @param data 
     */
    private getCppLoc(data: Object): any[] {
        let loc = [];
        if (data && Config.quickRoot) {
            let root = Config.quickRoot;
            if (!root.endsWith("/")) {
                root += "/";
            }
            loc = [data["line"], data["char"], root + data["src"]];
        }
        return loc;
    }
    /**
     * 真正解析
     * @param uri 
     * @param data 
     */
    private parse(uri: string, data: string) {
        // 要转成crlf结尾，不然解析的时候行号不对
        data = setLineEnding(data, "CRLF");
        try {
            let ast = luaparse.parse(data, this._option);

            // test
            // let p = new URL(Config.workspaceRoot + "/p.json");
            // fs.writeFileSync(p, JSON.stringify(ast));

            let file = parseDoc(ast);
            file.uri = uri;

            // if (uri.includes("display")) {
            //     console.log(file);
            // }            

            // test
            // p = new URL(Config.workspaceRoot + "/a2.json");
            // fs.writeFileSync(p, JSON.stringify(file));

            // 先删除之前的
            for (let i = 0; i < this._fileList.length; i++) {
                const f = this._fileList[i];
                if (f.uri == uri) {
                    this._fileList.splice(i, 1);
                    break;
                }
            }
            this._fileList.push(file);
        } catch (error) {
            // console.log(error);
        }
    }
    /**
     * 解析代码内容，一般是内容改变时
     */
    public parseCode(uri: string, code: string) {
        if (this._inited) {
            this._lastText = code;
            this.parse(uri, code);
        }
    }
    /**
     * 处理转到定义
     * @param lineData 
     * @param character 
     */
    public handleDefinition(uri: string, lineData: string, character: number): Definition {
        let prevContent = lineData.substring(0, character);
        let afterContent = lineData.substring(character);
        let arr = prevContent.split(/[^\w+|\.|\:]/);
        let prev = arr[arr.length - 1];
        if (prev.startsWith(".") || prev.startsWith(":")) {
            // :align的情况
            prev = prev.substr(1);
        }
        // 后面的不需要.或:之后的字符
        arr = afterContent.split(/[^\w+]/);
        let after = arr[0];
        let str = prev + after;
        // console.log("def", str, prev, after);

        let paths = str.split(/\.|\:/);
        if (paths.length == 0) {
            return [];
        }
        let locations: Location[] = [];
        this.findLocation(paths, this._cppList, null, locations);
        for (let i = 0; i < this._fileList.length; i++) {
            const file = this._fileList[i];
            if (file.uri == uri) {
                this.findLocation(paths, file.locals, file.uri, locations);
            }
            this.findLocation(paths, file.globals, file.uri, locations);
        }
        if (locations.length == 0) {
            // 如果找不到，则只检测最后一项
            let name = paths[paths.length - 1];
            this.addAllDefinition(name, this._cppList, null, locations);
            for (let i = 0; i < this._fileList.length; i++) {
                const file = this._fileList[i];
                if (file.uri == uri) {
                    this.addAllDefinition(name, file.locals, file.uri, locations);
                }
                this.addAllDefinition(name, file.globals, file.uri, locations);
            }
        }
        // console.log("---");
        return locations;
    }
    /**
     * 找到定义，并加入列表
     * @param paths 
     * @param list 
     * @param locations 
     */
    private findLocation(paths: string[], list: DocItem[], fileUri: string, locations: Location[]): void {
        let item = this.findDocItem(paths, list);
        if (item) {
            this.add2Definition(item, fileUri, locations);
        }
    }
    /**
     * 添加所有附合的到定义列表，当路径只有一个的时候
     * @param name 
     * @param fileUri 
     * @param locations 
     */
    private addAllDefinition(name: string, list: DocItem[], fileUri: string, locations: Location[]): void {
        for (let i = 0; i < list.length; i++) {
            const item1 = list[i];
            if (item1.name == name) {
                this.add2Definition(item1, fileUri, locations);
            }
            if (item1.items && item1.items.length > 0) {
                this.addAllDefinition(name, item1.items, fileUri, locations);
            }
        }
    }
    /**
     * 添加DocItem到定义列表中
     * @param item 
     * @param fileUri 
     * @param locations 
     */
    private add2Definition(item: DocItem, fileUri: string, locations: Location[]): void {
        // console.log("find", item);
        if (!item.loc) {
            return;
        }
        // 路径在loc中
        if (!fileUri && item.loc.length == 3) {
            fileUri = item.loc[2];
        }
        if (!fileUri || item.loc.length < 2) {
            return;
        }
        let line: number = item.loc[0] - 1;
        let character: number = item.loc[1];
        // console.log("loc", line, character, fileUri);
        let location = Location.create(fileUri, {
            start: { line: line, character: character },
            end: { line: line, character: character }
        });
        locations.push(location);
    }

    /**
     * 处理生成自动完成列表
     * @param uri 
     * @param prevContent 光标之前的字符串
     */
    public handleComplete(uri: string, prevContent: string): CompletionItem[] {
        prevContent.trim();
        let arr = prevContent.split(/[^\w+|\.|\:]/);
        prevContent = arr[arr.length - 1];
        // console.log("prevContent", prevContent);
        // 是否含有单词字符，没有单词字符则不是
        let index = prevContent.search(/\w+/);
        if (index >= 0) {
            return this.handleCompleteText(uri, prevContent);
        }
        return [];
    }
    /**
     * 对一段文字进行补全
     * @param uri 
     * @param str 
     */
    private handleCompleteText(uri: string, str: string): CompletionItem[] {
        let completions: CompletionItem[] = [];
        // 对str进行分析，取父路径的列表，如aa.bb.cc取aa.bb下的items
        let paths = str.split(/\.|\:/);
        // 最后一个不算，不管是空还是有文字的
        paths.pop();
        // console.log("paths",arr);

        this.findCompletions(paths, this._cppList, completions);
        let curFile: FileDoc;
        for (let i = 0; i < this._fileList.length; i++) {
            const f = this._fileList[i];
            this.findCompletions(paths, f.globals, completions);
            if (f.uri == uri) {
                curFile = f;
            }
        }

        if (completions.length == 0) {
            // 如果是局部变量，则加上所有的定义
            this.pickAllGlobal(completions);
            if (curFile) {
                this.pickItems(curFile.locals, completions, true);
            }
        } else if (curFile) {
            this.findCompletions(paths, curFile.locals, completions);
        }
        // console.log(completions);
        // if (curFile) {
        //     this.findCompletions(paths, curFile.locals, completions);
        // }
        // 加上关键字
        if (paths.length == 0) {
            completions = completions.concat(this._keyList);
        }

        return completions;
    }
    /**
     * 加上所有全局
     * @param completions 
     */
    private pickAllGlobal(completions: CompletionItem[]): void {
        this.pickItems(this._cppList, completions, true);
        for (let i = 0; i < this._fileList.length; i++) {
            const f = this._fileList[i];
            this.pickItems(f.globals, completions, true);
        }
    }
    /**
     * 从列表中找到对应路径的Completion
     * @param paths 
     * @param list 
     * @param completions 
     */
    private findCompletions(paths: string[], list: DocItem[], completions: CompletionItem[]) {
        if (!paths || paths.length == 0) {
            // 没有则选择第一个
            this.pickItems(list, completions, false);
            return;
        }
        // 找到的最后点
        let lastItem: DocItem;
        for (let i = 0; i < paths.length; i++) {
            const p = paths[i];
            // 是否有相关节点
            let has = false;
            for (let j = 0; j < list.length; j++) {
                let item = list[j];
                if (item.name == p) {
                    if (item.refer) {
                        item = item.refer;
                    }
                    if (item.items && item.items.length > 0) {
                        list = item.items;
                        lastItem = item;
                        has = true;
                        break;
                    }
                    else {
                        // 当前路径节点下没有子项，则无可加入的Completion
                        return;
                    }
                }
            }
            if (!has) {
                // 没有当前节点，不符合，pass
                return;
            }
        }
        // 有这一路径的节点
        if (lastItem) {
            if (lastItem.refer) {
                lastItem = lastItem.refer;
            }
            if (lastItem.items && lastItem.items.length > 0) {
                this.pickItems(lastItem.items, completions, false);
            }
        }
    }
    /**
     * 查找paths列表对应的节点
     * @param paths 
     * @param list 
     */
    private findDocItem(paths: string[], list: DocItem[]): DocItem {
        if (!paths || paths.length == 0) {
            return null;
        }
        let findList = list;
        for (let i = 0; i < paths.length; i++) {
            const p = paths[i];
            // 当前节点
            let curItem: DocItem;
            for (let j = 0; j < findList.length; j++) {
                let item = findList[j];
                if (item.name == p) {
                    curItem = item;
                    break;
                }
            }
            if (!curItem) {
                // 没有当前节点，不符合，pass
                return null;
            }
            if (i == paths.length - 1) {
                // 已经找完整个路径了，已找到
                return curItem;
            }
            if (curItem.refer) {
                curItem = curItem.refer;
            }
            // 路径没找完，继续向下找
            if (curItem.items && curItem.items.length > 0) {
                findList = curItem.items;
            }
            else {
                // 当前路径节点下没有子项
                return null;
            }
        }
        // 都没找到
        return null;
    }
    /**
     * 多个DocItem放入列表中
     * @param items 
     * @param completions 
     * @param pickChildren 
     */
    private pickItems(items: DocItem[], completions: CompletionItem[], pickChildren: boolean) {
        for (let i = 0; i < items.length; i++) {
            this.pickItem(items[i], completions, pickChildren);
        }
    }
    /**
     * 把一个DocItem放置到列表中
     * @param item 
     * @param completions 
     * @param pickChildren 是否添加子项
     */
    private pickItem(item: DocItem, completions: CompletionItem[], pickChildren: boolean): void {
        if (!item.virtual) {
            completions.push(item.completion);
        }
        if (item.refer) {
            return;
        }
        if (pickChildren && item.items && item.items.length > 0) {
            this.pickItems(item.items, completions, true);
        }
    }
}
/**
 * 解析器，导出单例
 */
export const Builder = new Builder0();