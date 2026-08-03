"use strict";

/**
 * The closure compiler is used as a type checker only: the library is built by
 * scripts/build.js, without it. The jar is published on maven central and is
 * cached in the directory ".tools", so that a build does not download it again.
 */

var fs = require("fs"),
    path = require("path"),
    https = require("https"),
    rootDir = path.resolve(__dirname, "../.."),
    toolsDir = path.join(rootDir, ".tools"),
    // Version the sources are validated against.
    version = "v20160911",
    jarName = "closure-compiler-" + version + ".jar",
    jarPath = path.join(toolsDir, jarName),
    jarUrl = "https://repo1.maven.org/maven2/com/google/javascript/closure-compiler/"
        + version + "/" + jarName;

/**
 * Path of the jar, downloaded when missing. The environment variable
 * CLOSURE_JAR overrides it, to use a local copy or another version.
 * @return {!Promise<string>}
 */
function jar() {
    if (process.env.CLOSURE_JAR) {
        return Promise.resolve(process.env.CLOSURE_JAR);
    }
    if (fs.existsSync(jarPath)) {
        return Promise.resolve(jarPath);
    }
    if (!fs.existsSync(toolsDir)) {
        fs.mkdirSync(toolsDir);
    }
    console.log("Downloading " + jarUrl);
    return new Promise(function (resolve, reject) {
        var file = fs.createWriteStream(jarPath + ".part");
        https.get(jarUrl, function (response) {
            if (response.statusCode !== 200) {
                reject(new Error("Unable to download the closure compiler: "
                    + response.statusCode));
                return;
            }
            response.pipe(file);
            file.on("finish", function () {
                file.close(function () {
                    fs.renameSync(jarPath + ".part", jarPath);
                    resolve(jarPath);
                });
            });
        }).on("error", reject);
    });
}

// Checks of the original build. The groups removed in the compilers newer
// than 2016 are marked, so that the list is ready when it is updated:
// ambiguousFunctionDecl, checkEventfulObjectDisposal, es3, fileoverviewTags,
// internetExplorerChecks, missingGetCssName, newCheckTypes, undefinedNames,
// unusedPrivateMembers and useOfGoogBase.
var errorGroups = [
    "accessControls", "ambiguousFunctionDecl", "checkEventfulObjectDisposal",
    "checkRegExp", "checkTypes", "checkVars",
    "conformanceViolations", "const", "constantProperty", "deprecated",
    "deprecatedAnnotations", "duplicateMessage", "es3", "es5Strict",
    "externsValidation", "fileoverviewTags", "globalThis",
    "internetExplorerChecks", "invalidCasts", "misplacedTypeAnnotation",
    "missingGetCssName", "missingProperties", "missingProvide",
    "missingReturn", "msgDescriptions", "newCheckTypes", "reportUnknownTypes",
    "strictModuleDepCheck", "suspiciousCode", "typeInvalidation",
    "undefinedNames", "undefinedVars", "underscore", "unknownDefines",
    "unusedLocalVariables", "unusedPrivateMembers", "useOfGoogBase",
    "uselessCode", "visibility"
];

var offGroups = ["missingRequire", "nonStandardJsDocs"];

exports.jar = jar;
exports.errorGroups = errorGroups;
exports.offGroups = offGroups;
