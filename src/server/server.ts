/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
import { CompletionItem, createConnection, IConnection, InitializeResult, ProposedFeatures, TextDocumentPositionParams, TextDocumentSyncKind, DidChangeTextDocumentParams, Definition, InitializeParams, DidChangeConfigurationParams, DidChangeWatchedFilesParams, Location } from 'vscode-languageserver';
import { Builder } from './Builder';
import { Config } from './Config';
import { ServerProxy } from './Proxy';
import URI from 'vscode-uri';


// 建立连接
let connection: IConnection = createConnection(ProposedFeatures.all);

// 初始化
connection.onInitialize((params: InitializeParams): InitializeResult => {
	console.log("Init project: ", params.rootUri);
	Config.initWorkspace(params.rootUri);
	ServerProxy.init(connection);
	return {
		// 返回服务端提供的功能
		capabilities: {
			// 文档内容同步类型，无|全部|增量
			textDocumentSync: TextDocumentSyncKind.Full,
			// 告诉客户端支持代码自动完成
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: [".", ":"]
			},
			definitionProvider: true
		}
	}
});

// 回应客户端信息
connection.onRequest("isQuickX", () => {
	return Config.isQuickX;
});

/**
 * 配置初始化或内容改变时
 */
connection.onDidChangeConfiguration((params: DidChangeConfigurationParams) => {
	Config.changeSettings(params.settings);
});
connection.onDidChangeWatchedFiles((params: DidChangeWatchedFilesParams) => {
	// Monitored files have change in VSCode
	console.log('We recevied an file change event');
});

/**
 * 自动完成
 */
connection.onCompletion(async (params: TextDocumentPositionParams): Promise<CompletionItem[]> => {
	let uri = params.textDocument.uri;
	let line = params.position.line;
	let character = params.position.character;
	let p = { filepath: URI.parse(uri).fsPath, line: line };
	let lineData = await ServerProxy.connection.sendRequest<string>("getDocLine", p);
	if (lineData.length < character) {
		return [];
	}
	let prevContent = lineData.substring(0, character);
	return Builder.handleComplete(uri, prevContent);
});

// 当上下选中自动完成选项时要显示的更多信息
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	return item;
});

/**
 * 内容改变时
 */
connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
	// console.log("content",params.contentChanges.length);
	if (params.contentChanges.length > 0) {
		for (let i = 0; i < params.contentChanges.length; i++) {
			const data = params.contentChanges[i].text;
			Builder.parseCode(params.textDocument.uri, data);
		}
	}
});

/**
 * 转到定义
 */
connection.onDefinition(async (params: TextDocumentPositionParams): Promise<Definition> => {
	let uri = params.textDocument.uri;
	let line = params.position.line;
	let character = params.position.character;

	// console.log(line);
	let p = { filepath: URI.parse(uri).fsPath, line: line };
	let lineData = await ServerProxy.connection.sendRequest<string>("getDocLine", p);
	return Builder.handleDefinition(uri, lineData, character);
})


// 开始监听
connection.listen();
