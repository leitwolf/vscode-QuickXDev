import { DocItem, FileDoc } from "./types";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";

const enum AstType {
    // 最终单词
    Identifier = "Identifier",
    // cc.aa.bb
    MemberExpression = "MemberExpression",
    VarargLiteral = "VarargLiteral"
}
/**
 * 工具类
 * 分析ast结构，生成文档类
 */
class AstParser0 {

    // 全局和局部
    private _globals: DocItem[];
    private _locals: DocItem[];
    // 别称的情况，如local a=aa a.bb=1，那么aa.bb=1，最后的时候再汇总
    // name:[aa,bb] alias:a isLocal是指name的情况
    private _alias: { name: string[], alias: string, isLocal: boolean }[] = [];

    constructor() {
    }
    /**
     * 沿路径查找,如没有则建立一个项
     * @param names 
     * @param list 
     * @param isNewVirtual 是否是新建的是virtual
     */
    private findOrCreateItem(names: string[], list: DocItem[], isNewVirtual: boolean = false): DocItem {
        if (names.length == 0) {
            return null;
        }
        // 最后的DocItem，生成或已存在的
        let lastItem: DocItem;
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            let has = false;
            // console.log(list);
            for (let j = 0; j < list.length; j++) {
                let item = list[j];
                if (item.name == name) {
                    if (item.refer) {
                        item = item.refer;
                    }
                    if (!item.items) {
                        item.items = [];
                    }
                    list = item.items;
                    lastItem = item;
                    has = true;
                    break;
                }
            }
            if (!has) {
                let completion = <CompletionItem>{};
                completion.label = name;
                completion.kind = CompletionItemKind.Variable;
                let newItem = <DocItem>{};
                newItem.name = name;
                newItem.completion = completion;
                newItem.items = [];
                if (isNewVirtual) {
                    newItem.virtual = true;
                }
                list.push(newItem);
                list = newItem.items;
                lastItem = newItem;
            }
        }
        return lastItem;
    }
    private getTopList(isLocal: boolean): DocItem[] {
        if (isLocal) {
            return this._locals;
        }
        return this._globals;
    }
    /**
     * 加入到一个父项，连同加入到其refer中
     * @param item 
     * @param base 
     */
    private add2DocItem(item: DocItem, base: DocItem): void {
        if (!base) {
            return;
        }
        if (base.refer) {
            base = base.refer;
        }
        this.add2List(item, base.items);
    }
    /**
     * 加入到列表中，已有则替换
     * @param item 
     * @param list 
     */
    private add2List(item: DocItem, list: DocItem[]): void {
        for (let i = 0; i < list.length; i++) {
            const element = list[i];
            if (element.name == item.name) {
                element.completion = item.completion;
                element.refer = item.refer;
                return;
            }
        }
        // 新加入
        list.push(item);
    }
    /**
     * 赋值或定义
     * cc.VAR or local abc=1
     * 
     * @param data
     */
    private genVar(data: Object, refer: { names: string[], isLocal: boolean }): void {
        let identifier = this.getChain(data, []);
        var names = identifier.names;
        if (names.length == 0) {
            // 错误的名称
            return;
        }
        // console.log("var", identifier);
        // 之后names就是父类的路径了
        let name = names.pop();

        let completion = <CompletionItem>{};
        completion.label = name;
        completion.kind = CompletionItemKind.Variable;
        completion.detail = name;

        let docItem = <DocItem>{};
        docItem.name = name;
        docItem.loc = this.p_loc(data["loc"]);
        docItem.completion = completion;
        // 找出refer
        if (refer.names.length == 1 && names.length == 1 && refer.names[0] == name) {
            // 引用其它地方 cc = cc or {}
            docItem.virtual = true;
        }
        else {
            docItem.refer = this.findOrCreateItem(refer.names, this.getTopList(refer.isLocal), true);
        }

        // 查找docItem的父类
        let list = this.getTopList(identifier.isLocal);
        let base = this.findOrCreateItem(names, list, true);
        if (base) {
            docItem.completion.detail = "(" + base.name + ") " + docItem.completion.detail;
            this.add2DocItem(docItem, base);
        }
        else {
            this.add2List(docItem, list);
        }
    }
    /**
     * 生成函数的自动完成
     * @param data 
     */
    private genFunc(data: Object): void {
        let identifier = this.getChain(data["identifier"], []);
        var names = identifier.names;
        if (names.length == 0) {
            // 错误的名称
            return;
        }
        let name = names.pop();
        let params = this.getFuncParams(data["parameters"]);
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
        completion.insertTextFormat = 2;
        completion.insertText = name + "(" + params2 + ")";
        completion.detail = name + "(" + params3 + ")";

        let docItem = <DocItem>{};
        docItem.name = name;
        docItem.loc = this.p_loc(data["loc"]);
        docItem.completion = completion;

        // 查找docItem的父类
        let list = this.getTopList(identifier.isLocal);
        let base = this.findOrCreateItem(names, list, true);
        if (base) {
            docItem.completion.detail = "(" + base.name + ") " + docItem.completion.detail;
            this.add2DocItem(docItem, base);
        }
        else {
            this.add2List(docItem, list);
        }

        // 处理方法体
        this.parseList(data["body"]);
    }
    /**
     * 获取链式的变量，如aa.bb:dd
     * @param data 
     */
    private getChain(data: Object, names: string[]): { names: string[], isLocal: boolean } {
        var reObj = { names: [], isLocal: true };
        // 有可能是匿名函数
        if (!data) {
            return reObj;
        }
        let type: string = data["type"];
        if (type == AstType.Identifier) {
            names.unshift(data["name"]);
            reObj.names = names;
            reObj.isLocal = data["isLocal"];
        }
        else if (type == AstType.MemberExpression) {
            names.unshift(data["identifier"]["name"]);
            return this.getChain(data["base"], names);
        }
        return reObj;
    }
    /**
     * 函数参数列表
     * @param params 
     */
    private getFuncParams(params: Object[]): string[] {
        let ps: string[] = [];
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            let type: string = p["type"];
            if (type == "Identifier") {
                ps.push(p["name"]);
            }
            else if (type == AstType.VarargLiteral) {
                ps.push("...");
            }
        }
        return ps;
    }
    /**
     * 检测是全局变量
     * cc.VAR=1 如果cc是全局的则cc.VAR是全局的
     * @param data 
     */
    private checkGlobalAssign(data: Object): boolean {
        let type: string = data["type"];
        let isLocal: boolean = data["isLocal"];
        if (type == AstType.Identifier) {
            return !isLocal;
        }
        else if (type == AstType.MemberExpression) {
            return this.checkGlobalAssign(data["base"]);
        }
        return false;
    }
    /**
     * 解析一个文档，返回解析结果 
     * @param data 
     */
    public parseDoc(data: Object): FileDoc {
        this._globals = [];
        this._locals = [];
        this._alias = [];
        this.parseNode(data);
        let file = <FileDoc>{};
        file.globals = this._globals;
        file.locals = this._locals;
        return file;
    }
    /**
     * 检测节点，根据节点类型选择相应的方法
     * @param data 
     */
    public parseNode(data: Object): void {
        let type: string = data["type"];
        // 找到相应的方法
        if (this["p_" + type] != null) {
            this["p_" + type](data);
        }
        else {
            // 没有相应的方法
            console.log("<warning>Unkown type: " + type);
            // console.log(data);
        }
    }
    private parseList(list: Object[]): void {
        for (let i = 0; i < list.length; i++) {
            this.parseNode(list[i]);
        }
    }
    private p_loc(data: Object): number[] {
        return [data["start"]["line"], data["start"]["column"]];
    }
    private p_Identifier(data: Object): void {
        // let obj = this.init(data, EntryType.Identifier);
        // obj["name"] = data["name"];
        // obj["isLocal"] = data["isLocal"] ? data["isLocal"] : true;
        // return obj;
    }
    private p_NumericLiteral(data: Object): void {
    }
    private p_StringLiteral(data: Object): void {
    }
    private p_NilLiteral(data: Object): void {
    }
    private p_BooleanLiteral(data: Object): void {
    }
    private p_VarargLiteral(data: Object): void {
    }
    private p_UnaryExpression(data: Object): void {
        this.parseNode(data["argument"]);
    }
    private p_BinaryExpression(data: Object): void {
        this.parseNode(data["left"]);
        this.parseNode(data["right"]);
    }
    private p_LogicalExpression(data: Object): void {
        this.p_BinaryExpression(data);
    }
    private p_CallExpression(data: Object): void {
        this.parseNode(data["base"]);
        this.parseList(data["arguments"]);
    }
    private p_MemberExpression(data: Object): void {
    }
    private p_StringCallExpression(data: Object): void {
    }
    private p_TableCallExpression(data: Object): void {
    }
    private p_TableConstructorExpression(data: Object): void {
    }
    private p_TableValue(data: Object): void {
    }
    private p_TableKeyString(data: Object): void {
    }
    private p_TableKey(data: Object): void {
    }
    private p_IndexExpression(data: Object): void {
    }
    private p_LocalStatement(data: Object): void {
        if (this.isFuncDeclare(data)) {
            return;
        }
        let vars: Object[] = data["variables"];
        let inits: Object[] = data["init"];
        // 普通变量
        for (let i = 0; i < vars.length; i++) {
            let var1 = vars[i];
            var refer: { names: string[], isLocal: boolean } = { names: [], isLocal: true };
            if (i < inits.length) {
                // 引用的情况
                let value = inits[i];
                if (var1["type"] == AstType.Identifier) {
                    if (value["type"] == AstType.Identifier || value["type"] == AstType.MemberExpression) {
                        refer = this.getChain(value, []);
                    }
                    else if (value["type"] == "LogicalExpression") {
                        // cc = cc or {}
                        refer = this.getChain(value["left"], []);
                    }
                    else if (value["type"] == "CallExpression" && value["base"]["name"] == "require") {
                        // 声明模块 device = require(cc.PACKAGE_NAME .. ".device")
                        continue
                    }
                    // console.log(refer);
                }
            }
            this.genVar(var1, refer);
        }
    }
    // 是否是函数定义
    private isFuncDeclare(data): boolean {
        let vars: Object[] = data["variables"];
        let inits: Object[] = data["init"];
        if (vars.length == 1 && inits.length == 1 && inits[0]["type"] == "FunctionDeclaration") {
            // 函数定义在后面的情况，local func=function ... end
            let funcObj = inits[0];
            funcObj["identifier"] = vars[0];
            this.genFunc(funcObj);
            return true;
        }
        return false;
    }
    private p_AssignmentStatement(data: Object): void {
        this.p_LocalStatement(data);
        // if (this.isFuncDeclare(data)) {
        //     return;
        // }
        // // 如果var是global或者value是变量或函数的时候记录
        // let vars: Object[] = data["variables"];
        // let inits: Object[] = data["init"];
        // for (let i = 0; i < vars.length; i++) {
        //     let var1 = vars[i];
        //     let isLocal: boolean = var1["isLocal"];
        //     var refer: { names: string[], isLocal: boolean } = { names: [], isLocal: true };
        //     if (i < inits.length) {
        //         // 引用的情况
        //         let value = inits[i];
        //         if (var1["type"] == AstType.Identifier && (value["type"] == AstType.Identifier || value["type"] == AstType.MemberExpression)) {
        //             refer = this.getChain(value, []);
        //         }
        //     }
        //     if (!isLocal || refer.names.length > 0) {
        //         this.genVar(var1, refer);
        //     }
        // }
    }
    private p_IfStatement(data: Object): void {
        this.parseList(data["clauses"]);
    }
    private p_IfClause(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_ElseifClause(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_ElseClause(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_DoStatement(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_WhileStatement(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_RepeatStatement(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_ForNumericStatement(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_ForGenericStatement(data: Object): void {
        this.parseList(data["body"]);
    }
    private p_BreakStatement(data: Object): void {
    }
    private p_ReturnStatement(data: Object): void {
    }
    private p_CallStatement(data: Object): void {
        return this.parseNode(data["expression"]);
    }
    private p_FunctionDeclaration(data: Object): void {
        this.genFunc(data);
        this.parseList(data["body"]);
    }
    private p_Comment(data: Object): void {
    }
    private p_Chunk(data: Object): void {
        this.parseList(data["body"]);
        // 最后一个是return语句则是一个模块
        let list: Object[] = data["body"];
        if (list.length > 0) {
            let last = list[list.length - 1];
            let type: string = last["type"];
            if (type == "ReturnStatement") {
                let vars: Object[] = last["arguments"];
                if (vars.length == 1 && vars[0]["type"] == AstType.Identifier) {
                    let name = vars[0]["name"];
                    // 找出local中对应的模块
                    for (let i = 0; i < this._locals.length; i++) {
                        const item = this._locals[i];
                        if (item.name == name) {
                            item.completion.kind = CompletionItemKind.Module;
                            this._locals.splice(i, 1);
                            // 放入到globals中
                            this._globals.push(item);
                            break;
                        }
                    }
                }
            }
        }
    }
}
/**
 * 解析文档
 * @param data 
 */
export function parseDoc(data: Object): FileDoc {
    let parser = new AstParser0();
    return parser.parseDoc(data);
}
