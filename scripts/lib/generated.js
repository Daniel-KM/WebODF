"use strict";

/**
 * Files that are generated at build time: the version of the library and its
 * css, embedded as a javascript string.
 */

var fs = require("fs"),
    path = require("path"),
    child = require("child_process"),
    rootDir = path.resolve(__dirname, "../.."),
    cssPath = path.join(rootDir, "webodf/webodf.css");

/**
 * Version of the library, from the last tag of the repository, as the build of
 * cmake did. Only the tags that name a version are taken, so a tag of work in
 * progress does not become the version. It falls back on the version of the
 * package when git is not available, for example when building from an
 * archive, or when no version is tagged yet.
 * @return {string}
 */
function version() {
    try {
        return child.execSync("git describe --tags --match \"v[0-9]*\"", {
            cwd: rootDir,
            stdio: ["ignore", "pipe", "ignore"]
        }).toString().trim();
    } catch (ignore) {
        return "v" + JSON.parse(
            fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
        ).version;
    }
}

/**
 * Declaration of the version, that runtime.js exposes as webodf.Version.
 * @return {string}
 */
function versionSource() {
    return "var /**@const{!string}*/webodf_version = \"" + version() + "\";\n";
}

/**
 * The css of the viewer as a javascript string, inserted in the page by
 * OdfCanvas. Comments, indentation and line breaks are removed to keep the
 * string small.
 * @return {string}
 */
function cssSource() {
    var css = fs.readFileSync(cssPath, "utf8")
        .replace(/\/\*([\r\n]|.)*?\*\//g, "")
        .replace(/(^\s*)|(\s*$)/gm, "")
        .replace(/\r?\n/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
    return "var webodf_css = '" + css + "';\n";
}

exports.version = version;
exports.versionSource = versionSource;
exports.cssSource = cssSource;
