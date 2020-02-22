# vscode版QuickXDev
强大的quick-cocos2dx开发工具，目前适配 Quick-Cocos2dx-Community 3.7.x版及部分适配Cocos2d-Lua-Community 4.0版。

QuickXDev交流群：625657444，欢迎进群提问，讨论问题。

## Cocos2d-Lua-Community 4.0 版本说明
- 目前已部分适配该版本，其中LuaGameRunner（旧版中的Player）可用。这一特性的用法跟之前版本一样，都是右键 -> 在Player中运行，插件会根据引擎的目录结构自行判断是哪个版本。
- 因为该版本已没有环境变量，也就无法从系统中获取引擎的根目录，所以要想使用4.0版本，用户必须主动设置插件quickxdev.root，即引擎的根目录。
- 如果想同时开发3.7.x与4.0版本的项目，则在项目的工作目录中设置quickxdev.root，这样不同项目的设置就分隔开了，互不影响。

## 安装
在vscode扩展商店中搜索"QuickXDev"即可找到。

## 特性
- cocos2dx c++端的代码提示
- quick lua端的代码提示
- lua 5.1系统代码提示
- if,while,function等snippets
- 转到定义功能
- 在Player中运行功能 (F6)

## 配置
- quickxdev.root quick引擎的目录，如果是正常安装quick(执行了setup_win.bat/setup_mac.sh)，插件则自动获取该变量。如果是4.0版本则需要手动设置。

## 打开Player
项目中任意lua文件右键 -> 在Player中运行，或者按F6，即可运行该项目。

## 第三方库
本插件中使用 [luaparse](https://github.com/oxyc/luaparse) 作为lua代码解析库，在此向原作者表示感谢！

## 几个功能的gif
- 自动完成
![completion](https://user-images.githubusercontent.com/1720546/44968155-c290b580-af78-11e8-8d58-4e5d43a31cd7.gif)
- 转到定义
![godef](https://user-images.githubusercontent.com/1720546/44968156-c58ba600-af78-11e8-8a98-3f73c5a51b34.gif)
- 运行Player
![runplayer](https://user-images.githubusercontent.com/1720546/44968157-c6243c80-af78-11e8-8490-920d2db74789.gif)
