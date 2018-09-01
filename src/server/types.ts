import { CompletionItem } from "vscode-languageserver";

// 基础项
export interface DocItem {
    name: string;
    completion: CompletionItem;
    items: DocItem[];
    // 已在别的地方定义，一般是一个lua文件中引用别的地方的全局变量
    virtual:boolean;
    // 引用，c=cc Node=c.Node => c.refer=cc Node.refer=cc.Node
    // 得到一个DocItem时，要先检测这一项
    refer:DocItem;
    // 所在位置，lua只有两项[line,col]，c++有三项[line,col,src]
    loc: any[];
}
// 一个文档
export interface FileDoc {
    uri: string;
    // 全局变量
    globals: DocItem[];
    // 局部变量
    locals: DocItem[];
}
