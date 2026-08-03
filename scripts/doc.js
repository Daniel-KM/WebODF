"use strict";

/**
 * Generate the documentation of the api from the jsdoc annotations of the
 * sources, with jsdoc, that replaces the abandoned jsdoc-toolkit 2.4.0 of the
 * original build.
 *
 * Usage: node scripts/doc.js
 */

var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    child = require("child_process"),
    sources = require("./lib/sources.js"),
    rootDir = path.resolve(__dirname, ".."),
    outputDir = path.join(rootDir, "dist/docs"),
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
].concat(sources.libraryFiles()), {stdio: "inherit"});
fs.rmSync(configDir, {recursive: true, force: true});

if (result.error) {
    console.error("jsdoc is missing, run: npm install");
    process.exit(1);
}
if (result.status === 0) {
    console.log("Documentation written in " + outputDir);
}
process.exit(result.status === null ? 1 : result.status);
