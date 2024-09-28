import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // Register the command to open the search/replace tool
    let disposable = vscode.commands.registerCommand('extension.searchReplaceTool', () => {
        const panel = vscode.window.createWebviewPanel(
            'searchReplaceTool',
            'Search Replace Tool',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        // Initial content with the "Start" button
        panel.webview.html = getInitialHtml();

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'start':
                    panel.webview.html = getSearchReplaceHtml();
                    break;
                case 'replace':
                    await performReplace(message.fileSearch, message.search, message.replace);
                    panel.webview.postMessage({ command: 'done', stats: 'Replacement complete!' });
                    break;
                case 'undo':
                    vscode.window.showInformationMessage('Undo functionality not implemented yet.');
                    break;
            }
        });
    });

    context.subscriptions.push(disposable);
}

// Initial HTML content with the Start button
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

// HTML content with the 3 input fields
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
            </script>
        </body>
        </html>
    `;
}

// Function to perform the search/replace
async function performReplace(fileSearch: string, search: string, replace: string) {
    if (!fileSearch || !search || !replace) {
        vscode.window.showErrorMessage('All fields are required.');
        return;
    }

    const allFiles = await vscode.workspace.findFiles('**/*');
    let totalReplacements = 0;
    const filteredFiles: vscode.Uri[] = [];

    // Filter files based on the file search input
    for (const file of allFiles) {
        const document = await vscode.workspace.openTextDocument(file);
        if (document.getText().includes(fileSearch)) {
            filteredFiles.push(file);
        }
    }

    const edits = new vscode.WorkspaceEdit();
    for (const documentUri of filteredFiles) {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const fullText = document.getText();
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
    }

    await vscode.workspace.applyEdit(edits);
    vscode.window.showInformationMessage(`Replaced ${totalReplacements} occurrence(s) in ${filteredFiles.length} file(s).`);
}
