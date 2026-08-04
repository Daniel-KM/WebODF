"use strict";

/**
 * Generate the documentation of the api from the jsdoc annotations of the
 * sources, with jsdoc, that replaces the abandoned jsdoc-toolkit 2.4.0 of the
 * original build.
 *
 * The build with cmake runs this script as well, on the library and on the
 * editors, so that both builds read the same tool.
 *
 * Usage: node scripts/doc.js [--output path] [--source file ...]
 */

var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    child = require("child_process"),
    sources = require("./lib/sources.js"),
    rootDir = path.resolve(__dirname, ".."),
    args = process.argv.slice(2),
    outputIndex = args.indexOf("--output"),
    outputDir = outputIndex === -1
        ? path.join(rootDir, "dist/docs")
        : path.resolve(args[outputIndex + 1]),
    sourceIndex = args.indexOf("--source"),
    // Everything after --source is a file to read, so that the editors give
    // their own where the library gives the classes of its manifest.
    sourceFiles = sourceIndex === -1
        ? null
        : args.slice(sourceIndex + 1).map(function (name) {
            return path.resolve(name);
        }),
    jsdoc = path.join(rootDir, "node_modules/.bin/jsdoc"),
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "webodf-doc-")),
    configPath = path.join(configDir, "jsdoc.json"),
    result;

// By default jsdoc skips any path with a part starting with an underscore,
// which silently drops every source when the project is checked out in such a
// directory.
fs.writeFileSync(configPath, JSON.stringify({
    source: {includePattern: ".+\\.js$", excludePattern: ""},
    opts: {template: "templates/default"}
}));

result = child.spawnSync(jsdoc, [
    "--configure", configPath,
    "--destination", outputDir
].concat(sourceFiles || sources.libraryFiles()), {stdio: "inherit"});
fs.rmSync(configDir, {recursive: true, force: true});

if (result.error) {
    console.error("jsdoc is missing, run: npm install");
    process.exit(1);
}
if (result.status === 0) {
    console.log("Documentation written in " + outputDir);
}
process.exit(result.status === null ? 1 : result.status);
