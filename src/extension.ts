import * as vscode from 'vscode';
import * as fs from 'fs';

let previousEdits: { [uri: string]: string } = {}; // To store the state for undo

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.searchReplaceTool', () => {
        const panel = vscode.window.createWebviewPanel(
            'searchReplaceTool',
            'Search Replace Tool',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        panel.webview.html = getInitialHtml();

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'start':
                    panel.webview.html = getSearchReplaceHtml();
                    break;
                case 'replace':
                    const stats = await performReplace(message.fileSearch, message.search, message.replace);
                    panel.webview.postMessage({ command: 'done', stats });
                    break;
                case 'undo':
                    await undoReplace();
                    vscode.window.showInformationMessage('Undo completed.');
                    break;
            }
        });
    });

    context.subscriptions.push(disposable);
}

function getInitialHtml(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Search Replace Tool</title>
        </head>
        <body>
            <h1>Search and Replace Tool</h1>
            <button id="startButton">Start</button>
            <script>
                const vscode = acquireVsCodeApi();
                document.getElementById('startButton').addEventListener('click', () => {
                    vscode.postMessage({ command: 'start' });
                });
            </script>
        </body>
        </html>
    `;
}

function getSearchReplaceHtml(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Search Replace Tool</title>
        </head>
        <body>
            <h1>Search and Replace Tool</h1>
            <label for="fileSearch">File Filter:</label>
            <input type="text" id="fileSearch" placeholder="File Filter"/><br>
            <label for="search">Search String:</label>
            <input type="text" id="search" placeholder="Search Text"/><br>
            <label for="replace">Replace With:</label>
            <input type="text" id="replace" placeholder="Replace Text"/><br>
            <button id="replaceButton">Replace</button><br>
            <button id="undoButton">Undo</button><br>
            <div id="results"></div>
            <script>
                const vscode = acquireVsCodeApi();
                document.getElementById('replaceButton').addEventListener('click', () => {
                    const fileSearch = document.getElementById('fileSearch').value;
                    const search = document.getElementById('search').value;
                    const replace = document.getElementById('replace').value;
                    vscode.postMessage({ command: 'replace', fileSearch, search, replace });
                });

                document.getElementById('undoButton').addEventListener('click', () => {
                    vscode.postMessage({ command: 'undo' });
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'done') {
                        document.getElementById('results').innerText = message.stats;
                    }
                });
            </script>
        </body>
        </html>
    `;
}

// Function to determine if a file is likely a binary file
function isBinaryFile(fileUri: vscode.Uri): boolean {
    const fileBuffer = fs.readFileSync(fileUri.fsPath);
    // Check for non-text characters in the first 1 KB
    const nonTextChars = fileBuffer.toString('binary', 0, 1024).replace(/[\x09\x0A\x0D\x20-\x7E]/g, '');
    return nonTextChars.length > 0;
}

// Function to perform the search/replace with statistics
async function performReplace(fileSearch: string, search: string, replace: string): Promise<string> {
    if (!fileSearch || !search || !replace) {
        vscode.window.showErrorMessage('All fields are required.');
        return 'Error: Missing input fields.';
    }

    const allFiles = await vscode.workspace.findFiles('**/*');
    let totalReplacements = 0;
    let totalFiles = 0;
    const filteredFiles: vscode.Uri[] = [];

    for (const file of allFiles) {
        if (!isBinaryFile(file)) { // Check if the file is not binary
            const document = await vscode.workspace.openTextDocument(file);
            if (document.getText().includes(fileSearch)) {
                filteredFiles.push(file);
            }
        }
    }

    const edits = new vscode.WorkspaceEdit();
    previousEdits = {}; // Reset the undo history

    for (const documentUri of filteredFiles) {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const fullText = document.getText();
        previousEdits[documentUri.toString()] = fullText; // Save for undo

        const regex = new RegExp(search, 'g');
        const replacedText = fullText.replace(regex, () => {
            totalReplacements++;
            return replace;
        });

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(fullText.length)
        );
        edits.replace(document.uri, fullRange, replacedText);
        totalFiles++;
    }

    await vscode.workspace.applyEdit(edits);
    return `Replaced ${totalReplacements} occurrence(s) in ${totalFiles} file(s).`;
}

// Function to undo the last replace
async function undoReplace() {
    const edits = new vscode.WorkspaceEdit();
    for (const [uri, oldText] of Object.entries(previousEdits)) {
        const documentUri = vscode.Uri.parse(uri);
        const document = await vscode.workspace.openTextDocument(documentUri);
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        edits.replace(documentUri, fullRange, oldText);
    }
    await vscode.workspace.applyEdit(edits);
    previousEdits = {}; // Clear undo history after applying undo
}
