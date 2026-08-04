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
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global document, window, browser, chrome, odf, URLSearchParams, URL*/

(function () {
    "use strict";

    // Firefox names the api "browser", Chrome names it "chrome". A page of an
    // add-on carries its permissions, so it downloads by itself.
    var api = (String(typeof browser) !== "undefined")
            ? browser
            : chrome,
        url = new URLSearchParams(window.location.search).get("file"),
        canvas = new odf.OdfCanvas(document.getElementById("odf")),
        open = document.getElementById("open");

    /**
     * @param {!string} name
     * @return {undefined}
     */
    function show(name) {
        document.title = name;
        document.getElementById("download").style.display = url
            ? ""
            : "none";
    }

    // A document that is read from the disk is opened here, as the requests of
    // a file:// url never reach the background script: webRequest only watches
    // http, https and the web sockets.
    open.addEventListener("change", function () {
        var file = open.files[0];
        if (file) {
            url = null;
            show(file.name);
            canvas.load(URL.createObjectURL(file));
        }
    });

    if (!url) {
        show("OpenDocument Viewer");
        return;
    }
    show(decodeURIComponent(url.split("/").pop()));
    document.getElementById("download").addEventListener("click", function () {
        api.downloads.download({url: url});
    });
    canvas.load(url);
}());
