"use strict";

/**
 * Run the tests in a browser, the only engine providing a layout and a css
 * parser as strict as the ones the last suites need. The files of the tests are
 * served over http, since a page loaded from a file cannot read them.
 *
 * The browser is not downloaded: set WEBODF_BROWSER to the path of a chromium,
 * or install one, for example with "npx playwright install chromium".
 *
 * Usage: node scripts/test-browser.js
 */

var fs = require("fs"),
    http = require("http"),
    path = require("path"),
    bundle = require("./lib/bundle.js"),
    sources = require("./lib/sources.js"),
    browserPaths = [
        process.env.WEBODF_BROWSER,
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/opt/google/chrome/chrome"
    ],
    // A text file is served as bytes: a browser strips the byte order mark when
    // it decodes the answer as utf-8, and the tests read the raw bytes.
    types = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".xml": "application/xml",
        ".odt": "application/vnd.oasis.opendocument.text",
        ".ods": "application/vnd.oasis.opendocument.spreadsheet",
        ".odp": "application/vnd.oasis.opendocument.presentation",
        ".png": "image/png"
    },
    page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>tests</title>`
        + `</head><body><div id="console"></div>`
        + `<script src="/tests.js"></script></body></html>`;

/**
 * The first browser found among the usual paths.
 * @return {?string}
 */
function findBrowser() {
    var found = null;
    browserPaths.forEach(function (candidate) {
        if (!found && candidate && fs.existsSync(candidate)) {
            found = candidate;
        }
    });
    return found;
}

/**
 * Serve the page of the tests, their bundle and the documents they read.
 * @param {string} code  the bundle
 * @return {!http.Server}
 */
function serve(code) {
    return http.createServer(function (request, response) {
        var name = request.url.split("?")[0],
            file,
            data;
        if (name === "/") {
            response.writeHead(200, {"Content-Type": "text/html"});
            response.end(page);
            return;
        }
        if (name === "/tests.js") {
            response.writeHead(200, {"Content-Type": "application/javascript"});
            response.end(code);
            return;
        }
        file = path.join(sources.testsDir, path.normalize(name).replace(/^(\.\.[/\\])+/, ""));
        // The tests write and delete files, as they do with node, so the
        // server answers PUT and DELETE besides GET.
        if (request.method === "PUT") {
            data = [];
            request.on("data", function (chunk) {
                data.push(chunk);
            });
            request.on("end", function () {
                try {
                    fs.writeFileSync(file, Buffer.concat(data));
                    response.writeHead(200);
                } catch (ignore) {
                    response.writeHead(500);
                }
                response.end();
            });
            return;
        }
        if (request.method === "DELETE") {
            try {
                fs.unlinkSync(file);
                response.writeHead(200);
            } catch (ignore) {
                response.writeHead(404);
            }
            response.end();
            return;
        }
        try {
            data = fs.readFileSync(file);
        } catch (ignore) {
            console.error("404 " + name);
            response.writeHead(404);
            response.end();
            return;
        }
        response.writeHead(200, {
            "Content-Type": types[path.extname(file)] || "application/octet-stream",
            // The tests write a file then read it back at once.
            "Cache-Control": "no-store"
        });
        response.end(data);
    });
}

function main() {
    var browser = findBrowser(),
        server;
    if (!browser) {
        console.error("No browser found. Set WEBODF_BROWSER to the path of a"
            + " chromium, or install one with: npx playwright install chromium");
        process.exit(1);
    }
    server = serve(bundle.withTests());
    server.listen(0, "127.0.0.1", function () {
        var url = "http://127.0.0.1:" + server.address().port + "/";
        require("playwright-core").chromium.launch({
            executablePath: browser,
            args: ["--no-sandbox"]
        }).then(function (instance) {
            return instance.newPage().then(function (browserPage) {
                // The suite tells it is over by logging its number of failures.
                var done = new Promise(function (resolve) {
                    browserPage.on("console", function (message) {
                        var text = message.text();
                        console.log(text);
                        if (text.indexOf("Number of failed asserts: ") === 0) {
                            resolve(parseInt(text.substr(26), 10));
                        }
                    });
                });
                browserPage.goto(url);
                return done.then(function (failed) {
                    return instance.close().then(function () {
                        server.close();
                        process.exit(failed);
                    });
                });
            });
        }).catch(function (err) {
            console.error(String(err));
            server.close();
            process.exit(1);
        });
    });
}

main();
