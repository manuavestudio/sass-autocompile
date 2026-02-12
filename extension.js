var vscode = require('vscode');
var fs = require('fs');
var replaceExt = require('replace-ext');
var compileSass = require('./lib/sass.node.spk.js');
var pathModule = require('path');
var lineReader = require('line-reader');

var CompileSassExtension = function() {

    // Aux function to format output date based on my preferences
    function formatDateTime() {
        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}:${seconds}`;
    }

    // Private fields ---------------------------------------------------------

    var outputChannel;

    // Constructor ------------------------------------------------------------

    outputChannel = vscode.window.createOutputChannel("sass_autocompile");

    // Private functions ------------------------------------------------------

    // Processes result of css file generation.
    function handleResult(outputPath, result) {

        if (result.status == 0) {

            try {                
                fs.writeFileSync(outputPath, result.text, { flags: "w" });
            } catch (e) {
                outputChannel.appendLine(formatDateTime() +  + ": Failed to generate CSS: " + e);
            }

            outputChannel.appendLine(formatDateTime() +  + ": Successfully generated CSS: " + outputPath);
        }
        else {

            if (result.formatted) {
                outputChannel.appendLine(result.formatted);
            } else if (result.message) {
                outputChannel.appendLine(result.message);
            } else {
                outputChannel.appendLine(formatDateTime() +  + ": Failed to generate CSS from SASS, but the error is unknown.");
            }

            vscode.window.showErrorMessage(formatDateTime() +  + ': sass_autocompile: could not generate CSS file. See Output panel for details.');
            outputChannel.show(true);
        }
    }

    // Generates target path for scss/sass file basing on its path
    // and sass_autocompile.targetDir setting. If the setting specifies
    // relative path, current workspace folder is used as root.
    function generateTargetPath(path) {

        var configuration = vscode.workspace.getConfiguration('sass_autocompile');

        var targetDir = pathModule.dirname(path);
        var filename = pathModule.basename(path);
        if (configuration.targetDir != undefined && configuration.targetDir.length > 0) {

            if (pathModule.isAbsolute(configuration.targetDir)) {
                targetDir = configuration.targetDir;
            } else {
                var folder = vscode.workspace.rootPath;
                if (folder == undefined) {
                    throw "Path specified in sass_autocompile.targetDir is relative, but there is no open folder in VS Code!";
                }

                targetDir = pathModule.join(folder, configuration.targetDir);
            }
        }

        return {
            targetDir: targetDir,
            filename: filename
        };
    }

    // Compiles single scss/sass file.
    function compileFile(path) {

        outputChannel.clear();

        var configuration = vscode.workspace.getConfiguration('sass_autocompile');

        var outputPathData = generateTargetPath(path);

        // Iterate through formats from configuration

        if (configuration.formats.length == 0) {
            throw "No formats are specified. Define sass_autocompile.formats setting (or remove to use defaults)";
        }

        for (var i = 0; i < configuration.formats.length; i++) {

            var format = configuration.formats[i];
        
            // Evaluate style for sass generator
            var style;
            switch (format.format) {
                case "nested":
                    style = compileSass.Sass.style.nested;
                    break;
                case "compact":
                    style = compileSass.Sass.style.compact;
                    break;
                case "expanded":
                    style = compileSass.Sass.style.expanded;
                    break;
                case "compressed":
                    style = compileSass.Sass.style.compressed;
                    break;
                default:
                    throw "Invalid format specified for sass_autocompile.formats[" + i + "]. Look at setting's hint for available formats.";
            }

            // Check target extension
            if (format.extension == undefined || format.extension.length == 0)
                throw "No extension specified for sass_autocompile.formats[" + i + "].";

            var targetPath = pathModule.join(outputPathData.targetDir, replaceExt(outputPathData.filename, format.extension));

            // Using closure to properly pass local variables to callback
            (function(path_, targetPath_, style_) {

                // Run the compilation process
                compileSass(path_, { style: style_ }, function(result) {
                                        
                    handleResult(targetPath_, result);
                });

            })(path, targetPath, style);
        }        
    }

    // Checks, if the file matches the exclude regular expression
    function checkExclude(filename) {
        
        var configuration = vscode.workspace.getConfiguration('sass_autocompile');
        return configuration.excludeRegex.length > 0 && new RegExp(configuration.excludeRegex).test(filename);
    }

    // Public -----------------------------------------------------------------

    return {

        OnSave: function (document) {

            try {
                var configuration = vscode.workspace.getConfiguration('sass_autocompile');
                var filename = pathModule.basename(document.fileName);

                if (document.fileName.toLowerCase().endsWith('.scss') ||
                    document.fileName.toLowerCase().endsWith('.sass')) {

                    let file = {
                        compileAfterSave: false,
                        mainFile: null
                    };

                    let next = () => {
                        if (configuration.compileAfterSave || file.compileAfterSave || file.mainFile) {
                            
                            if(file.mainFile) {
                                compileFile(file.mainFile);
                            } else
                            if (!checkExclude(filename) || file.compileAfterSave) {
                                compileFile(document.fileName);
                            } else {
                                return outputChannel.appendLine(formatDateTime() +  + ": File " + document.fileName + " is excluded from building to CSS. Check sass_autocompile.excludeRegex setting.");
                            }
                        }
                    }

                    lineReader.eachLine(document.fileName, function(line) {  
                        if(line.indexOf('//') != 0) {
                            next();
                            return false;
                        }

                        if(line.indexOf('compile') > -1) {
                            file.compileAfterSave = true;
                        } else
                        if(line.indexOf('main') > -1) {
                            let data = (/\/\/\s*main\:\s*([\.\/\w]+)/g).exec(line);
                            if(data.length > 1) {
                                let filePath = pathModule.join(document.fileName.substring(0, document.fileName.lastIndexOf('\\')), data[1]);
                                if(!fs.existsSync(filePath)) {
                                    ['scss', 'sass'].forEach(ext => {
                                        let path = `${filePath}.${ext}`;
                                        if(fs.existsSync(path)) file.mainFile = path;
                                    })
                                }
                            }
                        }
                    });
                }

            }
            catch (e) {
                vscode.window.showErrorMessage('Sass Autocompile: could not generate CSS file: ' + e);
            }
        },
        CompileAll: function() {

            var configuration = vscode.workspace.getConfiguration('sass_autocompile');

            vscode.workspace.findFiles("**/*.s[ac]ss").then(function(files) {

                try {
                    for (var i = 0; i < files.length; i++) {
                        
                        var filename = pathModule.basename(files[i].fsPath);
                        if (checkExclude(filename)) {

                            outputChannel.appendLine(formatDateTime() +  + ": File " + filename + " is excluded from building to CSS. Check sass_autocompile.excludeRegex setting.");
                            continue;
                        }
                        
                        compileFile(files[i].fsPath);
                    }
                }
                catch (e) {
                    vscode.window.showErrorMessage('Sass Autocompile: could not generate CSS file: ' + e);
                }                
            });            
        }
    };
};

function activate(context) {

    var extension = CompileSassExtension();

    vscode.workspace.onDidSaveTextDocument(function(document) { extension.OnSave(document) });

    var disposable = vscode.commands.registerCommand('sass_autocompile.compileAll', function() {
        extension.CompileAll();
    });

    context.subscriptions.push(disposable);
}

function deactivate() {
}

exports.activate = activate;
exports.deactivate = deactivate;
