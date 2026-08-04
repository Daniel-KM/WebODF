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

/*global document, window, browser, odf, URLSearchParams*/

(function () {
    "use strict";

    var url = new URLSearchParams(window.location.search).get("file");

    if (!url) {
        return;
    }
    document.title = decodeURIComponent(url.split("/").pop());
    // The download goes through the background script, as the viewer holds no
    // permission of its own.
    document.getElementById("download").addEventListener("click", function () {
        browser.runtime.sendMessage({action: "download", url: url});
    });
    new odf.OdfCanvas(document.getElementById("odf")).load(url);
}());
