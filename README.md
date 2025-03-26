# Sass Autocompile README

I created this fork of EasySass to add some features which I miss from Atom's extension, Sass Autocompile.

## Features

Automatically compiles SASS/SCSS files to .css and .min.css upon saving. You may also quickly compile all SCSS/SASS files in your project.
Compile other Sass files on save (for imports)

Demo from EasySass:
![Demo](demo.gif)

## Commands

* `Compile all SCSS/SASS files in the project` - compiles all sass and scss files in selected folder

## Extension Settings

This extension contributes the following settings:

* `sass_autocompile.compileAfterSave`: enable or disable automatic compilation after saving
* `sass_autocompile.formats`: specify extensions and formats for exported files.
* `sass_autocompile.targetDir`: define target directory for generated files.
* `sass_autocompile.excludeRegex`: exclude files from compilation with regular expression

## Release Notes

## [0.0.6]
- Forked into Sass Autocompile
- On save, another script can be forced to compile by adding a comment to the top of the file
- Compile on Save can now be configured for individual files by adding a comment to the top of the file

## [0.0.7]
- Clear output after each save

## [0.0.8]
- Added timestamps on outputs for clarity.

**Enjoy!**
