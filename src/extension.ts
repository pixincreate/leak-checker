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

	if (activeEditor) {
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
	}
}

async function scanAndCheckFiles(folderPath: string) {
	// Get a list of all files and subdirectories in the current folder
	const entries = fs.readdirSync(folderPath);

	// Iterate through each entry
	for (const entry of entries) {
		const entryPath = path.join(folderPath, entry);
		// Check if the entry is a file or a directory
		const isDirectory = fs.statSync(entryPath).isDirectory();
		// Extract the filename using path.basename
		const filename = path.basename(entryPath);
		const inGitignore = existInGitIgnore(filename);

		if (!fileRiskAnalyze(filename, inGitignore)) {
			// Show a warning message
			const selection = await vscode.window.showInformationMessage('Exposed: ' + filename, 'Resolve');
			if (selection === 'Resolve') {
				// Add the file to .gitignore
				fs.appendFileSync(path.join(vscode.workspace.rootPath!, '.gitignore'), `\n${filename}`);
			}
		}

		// If it's a directory, recursively scan its contents
		if (isDirectory) {
			await scanAndCheckFiles(entryPath);
		}
	}
}

export function deactivate() { }
