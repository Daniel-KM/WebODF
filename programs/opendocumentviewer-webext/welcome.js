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

/*global document, window, browser, chrome, URLSearchParams, Image*/

(function () {
    "use strict";

    var api = (String(typeof browser) !== "undefined")
            ? browser
            : chrome,
        query = new URLSearchParams(window.location.search),
        images = document.querySelectorAll("figure > img"),
        i;

    // The page is opened when the add-on is installed, and again when it is
    // updated from a version that never showed it: the same page then reads as
    // a reminder rather than as a greeting.
    // The page is opened when the add-on is installed, when it is updated,
    // and from the manager of the add-ons, which is neither. Each of those
    // has its own opening, written in the page, in the attribute the reason
    // names: this file holds no sentence of its own.
    function opening(reason, id) {
        var element = document.getElementById(id),
            words = element.getAttribute("data-" + reason);
        if (words) {
            element.textContent = words;
        }
    }

    if (query.get("reason")) {
        opening(query.get("reason"), "heading");
        opening(query.get("reason"), "lead");
    }

    // The pictures of the menus carry the words of Thunderbird, so one is kept
    // for each language they are taken in: "menu-message.fr.png" beside
    // "menu-message.png". The one of the language of the reader is tried
    // first, then the one of its language alone, "pt" for "pt-BR", then the
    // English one. A picture that is in the package under none of those names
    // leaves its figure out, so that the page holds together with the
    // pictures that are there, whichever they are.
    function show(image, names) {
        var probe;
        if (!names.length) {
            return;
        }
        probe = new Image();
        probe.onload = function () {
            image.src = names[0];
            image.hidden = false;
        };
        probe.onerror = function () {
            show(image, names.slice(1));
        };
        probe.src = names[0];
    }

    /**
     * @param {!string} src
     * @return {!Array.<!string>}
     */
    function names(src) {
        var base = src.replace(/\.png$/, ""),
            language = api.i18n.getUILanguage(),
            list = [base + "." + language + ".png"];
        if (language.indexOf("-") !== -1) {
            list.push(base + "." + language.split("-")[0] + ".png");
        }
        // A picture in English says more than no picture at all: the menus it
        // shows are at the same place whatever the words in them are.
        list.push(base + ".en.png");
        list.push(src);
        return list;
    }

    for (i = 0; i < images.length; i += 1) {
        show(images[i], names(images[i].getAttribute("src")));
    }

    // Thunderbird opens no web page in a tab of its own, so every link that
    // leaves the add-on is handed to the browser of the system. Firefox and
    // Chrome follow them as they follow any other.
    document.addEventListener("click", function (event) {
        var link = event.target.closest("a[href^=\"http\"]");
        if (link && api.windows && api.windows.openDefaultBrowser) {
            event.preventDefault();
            api.windows.openDefaultBrowser(link.href);
        }
    });
}());
