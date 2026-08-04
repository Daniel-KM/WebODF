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

/*global window, browser, chrome*/

// The manager of the add-ons opens one address, and the page of the welcome is
// written once for each language, so this one leads to the right one. The
// address is replaced rather than followed, so that the page of a language is
// the one the reader steps back from.
(function () {
    "use strict";

    var api = (String(typeof browser) !== "undefined")
            ? browser
            : chrome,
        // The languages the page is written in, English being the one every
        // other language falls on.
        languages = ["en", "fr"],
        language = api.i18n.getUILanguage().split("-")[0];

    if (languages.indexOf(language) === -1) {
        language = "en";
    }
    // The reason names the opening of the page: read from the manager of the
    // add-ons, it greets no one and tells what the add-on is.
    window.location.replace(
        api.runtime.getURL("welcome." + language + ".html") + "?reason=about"
    );
}());
