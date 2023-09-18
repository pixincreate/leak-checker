import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	console.log("Code scanning has been initialized!");

	// Register the onDidSaveTextDocument event handler
	const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(onDocumentChanged);
	context.subscriptions.push(documentChangeDisposable);

	// Register the scanCodeBase command
	context.subscriptions.push(vscode.commands.registerCommand('leak-checker.scanCodeBase', scanCodeBase));
}

async function scanCodeBase() {
	const rootPath = vscode.workspace.rootPath;

	if (!rootPath) {
		vscode.window.showErrorMessage('No workspace or folder opened!');
		return;
	}

	await scanAndCheckFiles(rootPath);
	await doesPatternExistInActiveEditor();
}

// This function is called when a text document is changed
function onDocumentChanged(event: vscode.TextDocumentChangeEvent) {
	// Check if the event corresponds to a text document
	if (event && event.document) {
		scanAndCheckFiles(vscode.workspace.rootPath!);
		doesPatternExistInActiveEditor();
	}
}

function existInGitIgnore(filename: string): boolean {
	try {
		const gitignorePath = path.join(vscode.workspace.rootPath!, '.gitignore');
		// Check if the .gitignore file exists
		if (fs.existsSync(gitignorePath)) {
			const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
			// Check if the filename is in .gitignore
			if (gitignoreContent.includes(filename)) {
				return true;
			}
		}
	} catch (error) {
		console.error('Error checking .gitignore:', error);
	}
	return false;
}

function fileRiskAnalyze(filename: string, inGitignore: boolean): boolean {
	const filenamesToCheck = ["sample_auth.toml", "auth.toml", "connector_auth.toml"];
	// Check if `filename` is in the array and `inGitignore` is true
	if (inGitignore && filenamesToCheck.includes(filename)) {
		return true;
	} else if (!inGitignore && filenamesToCheck.includes(filename)) {
		return false;
	} else {
		return true;
	}
}

// Function to check if any pattern exists in the active editor
async function doesPatternExistInActiveEditor() {
	const patternsToSearch = ['sk_fjsdjbgi', 'rak_sdkfdsg', 'sb_sdbdgb', 'pc_adkfbdskg'];
	const activeEditor = vscode.window.activeTextEditor;

	if (!activeEditor) {
		// No active editor found, exit gracefully
		return;
	}

	try {
		const editorContent = activeEditor.document.getText();
		// Check if any pattern exists in the editor content
		for (const pattern of patternsToSearch) {
			if (editorContent.includes(pattern)) {
				// Show a warning message
				const selection = await vscode.window.showInformationMessage(`Exposed: Pattern found in ${activeEditor.document.fileName}`, 'Resolve');

				if (selection === 'Resolve') {
					// Remove the pattern from the file content
					const updatedContent = editorContent.replace(pattern, '');
					activeEditor.edit((editBuilder) => {
						const start = new vscode.Position(0, 0);
						const end = new vscode.Position(activeEditor.document.lineCount - 1, 0);
						const range = new vscode.Range(start, end);
						editBuilder.replace(range, updatedContent);
					});
				}
			}
		}
	} catch (error) {
		console.error('Error processing active editor:', error);
	}
}




async function scanAndCheckFiles(rootPath: string) {
	const foldersToProcess: string[] = [rootPath]; // Initialize the queue with the root folder
	const gitignoreSet = new Set<string>(); // Store gitignore entries in a Set for efficient lookups

	while (foldersToProcess.length > 0) {
		const currentFolder = foldersToProcess.pop()!;
		const entries = fs.readdirSync(currentFolder);

		for (const entry of entries) {
			const entryPath = path.join(currentFolder, entry);
			const isDirectory = fs.statSync(entryPath).isDirectory();
			const filename = path.basename(entryPath);
			const inGitignore = gitignoreSet.has(filename);

			if (!fileRiskAnalyze(filename, inGitignore)) {
				const selection = await vscode.window.showInformationMessage('Exposed: ' + filename, 'Resolve');
				if (selection === 'Resolve') {
					// Add the file to gitignoreSet
					gitignoreSet.add(filename);
					fs.appendFileSync(path.join(vscode.workspace.rootPath!, '.gitignore'), `\n${filename}`);
				}
			}

			if (isDirectory) {
				foldersToProcess.push(entryPath); // Add subdirectories to the list for processing
			}
		}
	}
}

export function deactivate() { }
