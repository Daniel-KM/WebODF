"use strict";

/**
 * Rhino runs javascript on a java virtual machine. It is used to run the tests
 * in a second engine, besides node. The jar is published on maven central and
 * is cached in the directory ".tools".
 */

var fs = require("fs"),
    path = require("path"),
    https = require("https"),
    rootDir = path.resolve(__dirname, "../.."),
    toolsDir = path.join(rootDir, ".tools"),
    version = process.env.RHINO_VERSION || "1.9.1",
    jarName = "rhino-all-" + version + ".jar",
    jarPath = path.join(toolsDir, jarName),
    jarUrl = "https://repo1.maven.org/maven2/org/mozilla/rhino-all/"
        + version + "/" + jarName;

/**
 * Path of the jar, downloaded when missing. The environment variable RHINO_JAR
 * overrides it, to use a local copy or another version.
 * @return {!Promise<string>}
 */
function jar() {
    if (process.env.RHINO_JAR) {
        return Promise.resolve(process.env.RHINO_JAR);
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
                reject(new Error("Unable to download Rhino: " + response.statusCode));
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

exports.jar = jar;
exports.version = version;
