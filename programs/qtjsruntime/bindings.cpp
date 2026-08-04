/**
 * Copyright (C) 2026 Daniel Berthereau <Daniel.git@Berthereau.net>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License (GNU AGPL) as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: https://webodf.org/
 * @source: https://github.com/webodf/WebODF/
 */

#include "bindings.h"

#include <QFile>

// The two scripts below run in the page, in the blink of WebEngine, so they are
// written in the javascript of today rather than in the one of the library,
// that has to run in older engines as well.

QByteArray runtimeBindings() {
    return R"JS(
(function () {
    "use strict";
    const api = window.__qtjsruntime = window.__qtjsruntime || {};

    // What travels over the channel is text, so the bytes of a file are sent
    // in base64: a string of them would be encoded as utf-8 on the way, which
    // would change every byte above 127.
    function base64(data) {
        const bytes = typeof data === "string"
            ? runtime.byteArrayFromString(data, "binary")
            : data;
        let text = "";
        // The characters are made in slices, as a call with a whole document
        // of arguments at once is refused.
        for (let i = 0; i < bytes.length; i += 8192) {
            text += String.fromCharCode.apply(null,
                bytes.subarray(i, i + 8192));
        }
        return window.btoa(text);
    }

    // Reading a file is left to the runtime of the browser, that reads it with
    // a request on it, so only what a page may not do is given here. Each of
    // these takes a callback in the runtime of the library already, which is
    // what makes the channel enough: it answers when it answers.
    api.install = function (nativeio, libraryPaths, currentDirectory) {
        runtime.libraryPaths = function () {
            return libraryPaths.slice();
        };
        runtime.currentDirectory = function () {
            return currentDirectory;
        };
        runtime.writeFile = function (path, data, callback) {
            nativeio.writeFile(path, base64(data), function (error) {
                callback(error || null);
            });
        };
        runtime.deleteFile = function (path, callback) {
            nativeio.deleteFile(path, function (error) {
                callback(error || null);
            });
        };
        runtime.getFileSize = function (path, callback) {
            nativeio.getFileSize(path, callback);
        };
        runtime.exit = function (code) {
            nativeio.exit(code || 0);
        };
    };

    // Run a script the way runtime.js runs the ones it is given on the command
    // line. It is done here rather than there, by handing the script to
    // runtime.js as an argument, so that the bindings above are surely in
    // place before the script runs: runtime.js reads the script with a request
    // and runs it in the answer, which may come before or after the script tag
    // that installs them.
    api.run = function (argv) {
        const script = argv[0];
        runtime.readFile(script, "utf8", function (err, code) {
            if (err || code === null) {
                runtime.log(String(err || `No code found for ${script}`));
                runtime.exit(1);
                return;
            }
            const end = script.lastIndexOf("/");
            runtime.setCurrentDirectory(end === -1
                ? "."
                : script.slice(0, end));
            // The script is run with the arguments bound to its "arguments",
            // as node and rhino do, and an exit code it returns is used.
            (function () {
                /*jslint evil: true*/
                const result = eval(String(code));
                /*jslint evil: false*/
                if (result) {
                    runtime.exit(result);
                }
            }).apply(null, argv);
        });
    };
}());
)JS";
}

QByteArray webChannelScript() {
    QFile file(":/qtwebchannel/qwebchannel.js");
    if (!file.open(QIODevice::ReadOnly)) {
        return QByteArray();
    }
    return file.readAll();
}

QByteArray idleWatcher() {
    return R"JS(
(function () {
    "use strict";
    const api = window.__qtjsruntime = window.__qtjsruntime || {};
    let pending = 0;
    let dirty = true;

    // WebKit told when the page had changed or asked to be painted again, and
    // its network manager knew how many requests were still open. WebEngine
    // tells neither, as both happen in the process of the page, so the page
    // counts them itself: what is left of a document that is done loading is a
    // tree that no longer changes and no request in the air.
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
        pending += 1;
        this.addEventListener("loadend", function () {
            pending -= 1;
        });
        return send.apply(this, arguments);
    };

    if (window.fetch) {
        const fetch = window.fetch;
        window.fetch = function () {
            pending += 1;
            return fetch.apply(window, arguments).finally(function () {
                pending -= 1;
            });
        };
    }

    new MutationObserver(function () {
        dirty = true;
    }).observe(document, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
    });

    // Asking resets the flag, so that the answer is "nothing changed since the
    // last time you asked" rather than "nothing ever changed".
    api.idle = function () {
        const quiet = !dirty && pending === 0
            && document.readyState === "complete";
        dirty = false;
        return quiet;
    };
}());
)JS";
}
