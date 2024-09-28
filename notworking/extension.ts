import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Activating Search Replace Tool Extension'); // Log to confirm activation

    // Register the Tree View Provider
    const searchReplaceProvider = new SearchReplaceProvider();
    vscode.window.registerTreeDataProvider('searchReplaceView', searchReplaceProvider);

    // Register the command to activate the panel
    context.subscriptions.push(vscode.commands.registerCommand('extension.searchReplaceTool', () => {
        console.log('Command triggered: extension.searchReplaceTool'); // Check if this logs
        searchReplaceProvider.showReplaceTool();
    }));

    // Register the command to undo the last replace
    context.subscriptions.push(vscode.commands.registerCommand('extension.undoReplace', () => {
        searchReplaceProvider.undoLastReplace();
    }));
}

class SearchReplaceProvider implements vscode.TreeDataProvider<SearchReplaceItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SearchReplaceItem | undefined | null | void> = new vscode.EventEmitter<SearchReplaceItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SearchReplaceItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Show the search and replace tool in the sidebar
    showReplaceTool() {
        console.log('showReplaceTool called'); // Log when this method is called
        // Display the tool in a webview
        const panel = vscode.window.createWebviewPanel(
            'searchReplaceTool',
            'Search and Replace Tool',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
            }
        );

        // Set the webview's HTML content
        panel.webview.html = this.getWebviewContent();

        // Listen for messages from the webview
        panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'replace':
                    await this.replace(message.fileSearch, message.search, message.replace);
                    return;
                case 'undo':
                    await this.undoLastReplace();
                    return;
            }
        });
    }

    getTreeItem(element: SearchReplaceItem): SearchReplaceItem {
        return element;
    }

    getChildren(): vscode.ProviderResult<SearchReplaceItem[]> {
        return [new SearchReplaceItem(this)];
    }

    private getWebviewContent(): string {
        console.log('Generating webview content'); // Log when generating content
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Search and Replace Tool</title>
            </head>
            <body>
                <h1>Search and Replace Tool</h1>
                <label for="fileSearch">File Search String:</label>
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
            </html>`;
    }

    async replace(fileSearch: string, search: string, replace: string) {
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

    async undoLastReplace() {
        // Implement your undo logic here
        vscode.window.showInformationMessage('Undo functionality not implemented yet.');
    }
}

class SearchReplaceItem extends vscode.TreeItem {
    private provider: SearchReplaceProvider;

    constructor(provider: SearchReplaceProvider) {
        super('Search and Replace Tool', vscode.TreeItemCollapsibleState.None);
        this.provider = provider;
    }
}
