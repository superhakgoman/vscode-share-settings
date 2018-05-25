const vscode = require('vscode');
const LZstring = require("lz-string");
const fs = require('fs');
var Output;
var Terminal;
const configPath = (function () {
    var path = undefined;
    switch (process.platform) {
        case "win32":
            path = `${process.env["APPDATA"]}/Code/User/`;
            break;
        case "darwin":
            path = `${process.env["HOME"]}/Library/Application Support/Code/User/`;
            break;
        case "linux":
            path = "~/.config/Code/User/";
            break;
        default:
            break;
    }
    return path;
}());

function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand("extension.getExtensions", function () {
        run({
            "extensions": getActiveExtensionList()
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("extension.getUserSettings", function () {
        run({
            "userSettings": getDataFromJSON(`settings.json`)
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("extension.getKeybinding", function () {
        run({
            "keybindings": getDataFromJSON(`keybindings.json`)
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("extension.getAll", function () {
        run({
            "extensions": getActiveExtensionList(),
            "userSettings": getDataFromJSON(`settings.json`),
            "keybindings": getDataFromJSON(`keybindings.json`)
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("extension.merge", function () {
        vscode.window.showInputBox({
            placeHolder: "Paste your shared text here"
        }).then(input => {
            mergeSettings(input);
        });
    }));
}

function getOutputChannel(){
    if(!Output){
        Output = vscode.window.createOutputChannel("Share-Settings");
    }
    return Output;
}

function getTerminal(){
    if(!Terminal){
        Terminal = vscode.window.createTerminal("Share-Settings");
    }
    return Terminal;
}

function run(data) {
    var shareStr = makeShareString(data);
    var out = getOutputChannel();
    out.clear();
    out.show();
    out.appendLine("아래 텍스트를 복사해서 전달하세요 : ");
    out.appendLine(shareStr);
}

function makeShareString(obj) {
    var str = JSON.stringify(obj);
    return LZstring.compressToBase64(str);
}

function getActiveExtensionList() {
    var list = [];
    for (const extension of vscode.extensions.all) {
        if (extension.packageJSON.isBuiltin === true) {
            continue;
        }
        list.push(extension.id);
    }
    return list;
}

function getDataFromJSON(fileName) {
    var data;
    var filePath = `${configPath}${fileName}`;
    try {
        var str = fs.readFileSync(filePath, "utf8");
        //파일 내부에 주석처리 된 것들은 삭제함 (JSON.parse할 때 에러나니까!)
        var regex = /(\/\/.*($|\n|\r))|(\/\*(.|\n|r)[^(\*\/)]*\*\/)/ig;
        var str = str.replace(regex, '');
        str = str.replace(/(\r|\n|\t)/ig, '');
        str = str.replace(/,}$/, "}");
        data = JSON.parse(str);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);        
        throw error;
    }
    return data;
}

// function getUserTheme() {
// }

function mergeSettings(sharedStr) {
    if (undefined === sharedStr || "" === sharedStr) {
        return;
    }
    var decompressed = LZstring.decompressFromBase64(sharedStr);
    if (null === decompressed || "" === decompressed) {
        return;
    }
    var settings = JSON.parse(decompressed);
    for (const name in settings) {
        if (settings.hasOwnProperty(name)) {
            const setting = settings[name];
            switch (name) {
                case "extensions":
                    installExtensions(setting);
                    break;
                case "userSettings":
                    mergeDataToJSON(setting, "settings.json");
                    break;
                case "keybindings":
                    mergeDataToJSON(setting, "keybindings.json");
                    break;
                default:
                    break;
            }
        }
    }
}

// function overwriteSettings(sharedStr){
    
// }

/**
 * 
 * @param {Array} eIdArr extension id 배열
 */
function installExtensions(eIdArr) {
    var notInstalled = [];
    eIdArr.forEach(extId => {
        if (undefined === vscode.extensions.getExtension(extId)) {
            notInstalled.push(extId);
        }
    });
    if(notInstalled.length > 0){
        var installScript = `code --install-extension ${notInstalled.join(";code --install-extension ")}`;
        var term = getTerminal();
        term.show();
        term.sendText(installScript);
    }else{
        vscode.window.showErrorMessage("설치할 확장 정보가 없거나 모든 요청된 확장이 이미 설치되어 있음");
    }
}

// TODO : 터미널 프로세스 종료되면 설치완료 알림 띄우기 

function mergeDataToJSON(sharedData, fileName){
    var curData = getDataFromJSON(fileName);
    var newData = Object.assign(curData, sharedData);
    try {
        var timestamp = Math.floor(Date.now() / 1000);
        fs.renameSync(`${configPath}${fileName}`, `${configPath}${fileName}.${timestamp}.backup`);
        fs.writeFileSync(`${configPath}${fileName}`, JSON.stringify(newData));
        vscode.window.showInformationMessage(`병합된 내용을 ${fileName}에 저장하였습니다. 기존의 설정은 ${fileName}.${timestamp}.backup에 보관되었습니다.`);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
        throw error;
    }
}

// this method is called when your extension is deactivated
function deactivate() {
    getTerminal().dispose();
    getOutputChannel().dispose();
}
exports.activate = activate;
exports.deactivate = deactivate;