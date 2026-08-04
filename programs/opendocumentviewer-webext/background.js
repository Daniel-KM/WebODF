/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
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

/*global browser, URL*/

/**
 * Send the documents in the OpenDocument format to the viewer of the extension,
 * instead of letting the browser download them.
 *
 * The stream converter this replaces was an XPCOM component, a kind of add-on
 * Firefox dropped in its version 57.
 */
(function () {
    "use strict";

    var /**@const@type{!Array.<!string>}*/
        mimetypes = [
            "application/vnd.oasis.opendocument.text",
            "application/vnd.oasis.opendocument.text-flat-xml",
            "application/vnd.oasis.opendocument.text-template",
            "application/vnd.oasis.opendocument.presentation",
            "application/vnd.oasis.opendocument.presentation-flat-xml",
            "application/vnd.oasis.opendocument.presentation-template",
            "application/vnd.oasis.opendocument.spreadsheet",
            "application/vnd.oasis.opendocument.spreadsheet-flat-xml",
            "application/vnd.oasis.opendocument.spreadsheet-template",
            "application/vnd.oasis.opendocument.graphics",
            "application/vnd.oasis.opendocument.graphics-flat-xml",
            "application/vnd.oasis.opendocument.graphics-template",
            "application/vnd.oasis.opendocument.formula"
        ],
        /**@const@type{!Array.<!string>}*/
        extensions = [
            ".odt", ".fodt", ".ott",
            ".odp", ".fodp", ".otp",
            ".ods", ".fods", ".ots",
            ".odg", ".fodg", ".otg",
            ".odf"
        ];

    /**
     * @param {!Array.<!{name: !string, value: !string}>} headers
     * @param {!string} name
     * @return {?string}
     */
    function header(headers, name) {
        var i, l = headers.length;
        for (i = 0; i < l; i += 1) {
            if (headers[i].name.toLowerCase() === name) {
                return headers[i].value;
            }
        }
        return null;
    }

    /**
     * A server that does not know the format sends it as a generic type, so the
     * extension of the path is read as well, as the stream converter did.
     * @param {!string} url
     * @param {!Array.<!{name: !string, value: !string}>} headers
     * @return {!boolean}
     */
    function isOpenDocument(url, headers) {
        var type = header(headers, "content-type"),
            path;
        if (type && mimetypes.indexOf(type.split(";")[0].trim()) !== -1) {
            return true;
        }
        path = new URL(url).pathname.toLowerCase();
        return extensions.some(function (extension) {
            return path.slice(-extension.length) === extension;
        });
    }

    browser.webRequest.onHeadersReceived.addListener(function (details) {
        if (details.method !== "GET" || details.statusCode !== 200
                || !isOpenDocument(details.url, details.responseHeaders)) {
            return undefined;
        }
        // The viewer reads the document itself, from the url it is given: the
        // response that is redirected here is dropped, and fetched again by the
        // viewer, out of the cache of the browser.
        return {
            redirectUrl: browser.runtime.getURL("viewer.html")
                + "?file=" + encodeURIComponent(details.url)
        };
    }, {
        urls: ["<all_urls>"],
        types: ["main_frame", "sub_frame"]
    }, ["blocking", "responseHeaders"]);
}());
