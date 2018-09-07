import { IConnection, MessageType, ShowMessageParams } from "vscode-languageserver";
import URI from "vscode-uri";


/**
 * 服务端功能集合，主要提供一些基础的功能
 */
class Proxy0 {

    private _connetion: IConnection;
    private _statusBar;

    constructor() {
    }

    /**
     * 初始化
     */
    public init(conn: IConnection): void {
        this._connetion = conn;
    }

    // ===========显示消息==========
    /**
     * 显示消息
     * @param type 消息类型
     * @param message 消息实体
     */
    public showMessage(type: MessageType, message: string) {
        let messageParams = {
            type: type,
            message: message
        };
        this._connetion.sendNotification("window/showMessage", <ShowMessageParams>messageParams);
    }
    /**
     * 显示Info消息
     * @param message 消息
     */
    public showMessageInfo(message: string) {
        this.showMessage(MessageType.Info, message);
    }
    /**
     * Log消息
     * @param message 消息
     */
    public showMessageLog(message: string) {
        this.showMessage(MessageType.Log, message);
    }
    /**
     * 显示Warning消息
     * @param message 消息
     */
    public showMessageWarning(message: string) {
        // this._connetion.window.showWarningMessage(message);
        this.showMessage(MessageType.Warning, message);
    }
    /**
     * 显示Error消息
     * @param message 消息
     */
    public showMessageError(message: string) {
        this.showMessage(MessageType.Error, message);
    }
    // ===================

    // =========任务栏==========
    /**
     * 显示任务栏信息
     * @param text 
     * @param color 
     */
    public showStatusBar(text: string, color: string = ""): void {
        this._connetion.sendRequest("showStatusBar", { text: text, color: color });
    }
    /**
     * 隐藏任务栏
     */
    public hideStatusBar(): void {
        this._connetion.sendRequest("hideStatusBar");
    }
    // ===================

    /**
     * 发送信息到客户端，没有返回值
     * @param method 
     * @param params 
     */
    public sendRequest(method: string, params: any): void {
        this._connetion.sendRequest(method, params);
    }

    /**
     * 与客户端的连接
     */
    public get connection(): IConnection {
        return this._connetion;
    }
}
/**
 * 服务端代码，基础功能集合
 */
export const ServerProxy = new Proxy0();