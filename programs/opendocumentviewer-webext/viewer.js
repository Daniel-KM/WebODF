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
 * @source: https://github.com/webodf/WebODF/
 */

/*global document, window, browser, chrome, odf, URLSearchParams, URL*/

(function () {
    "use strict";

    // Firefox names the api "browser", Chrome names it "chrome". A page of an
    // add-on carries its permissions, so it downloads by itself.
    var api = (String(typeof browser) !== "undefined")
            ? browser
            : chrome,
        query = new URLSearchParams(window.location.search),
        url = query.get("file"),
        // The name of a document is carried apart, as an attachment of a
        // message is named by its part, not by an address.
        name = query.get("name"),
        message = query.get("message"),
        part = query.get("part"),
        canvas = new odf.OdfCanvas(document.getElementById("odf")),
        open = document.getElementById("open"),
        menu = document.getElementById("menu"),
        menubutton = document.getElementById("menubutton"),
        ratio = window.devicePixelRatio,
        // The languages the page of the welcome is written in, beside the
        // English one every other language falls on.
        LANGUAGES = ["en", "fr"];

    // A text is drawn over pages, as it is printed, which the library
    // does not do on its own.
    canvas.setPaginated(true);

    /**
     * @param {!boolean} open
     * @return {undefined}
     */
    function showMenu(open) {
        menu.hidden = !open;
        menubutton.setAttribute("aria-expanded", String(open));
        // The keyboard follows the menu: it opens on its first entry, and it
        // goes back to the button that opened it, rather than to the top of
        // the page.
        if (open) {
            menu.querySelector(".entry, input").focus();
        }
    }

    // A page is drawn at its own size, and is scaled down only when the window
    // is narrower than it, so that a document is read as it is written on a
    // screen that holds it: fitSmart never scales up.
    function fit() {
        canvas.fitSmart(document.documentElement.clientWidth);
    }

    // The zoom of the browser narrows the window as it is read here, in css
    // pixels, so a fit on every resize would scale the page down by as much as
    // the reader zoomed in, and the document would never grow. A zoom changes
    // the ratio of the pixels of the device, a resize does not, which is how
    // the two are told apart.
    function refit() {
        if (window.devicePixelRatio !== ratio) {
            ratio = window.devicePixelRatio;
            return;
        }
        fit();
    }

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

    // The document is saved as it came, under the name it carries, whether it
    // was read from a message, from an address or from the disk.
    document.getElementById("download").addEventListener("click", function () {
        if (url) {
            api.downloads.download({url: url, filename: document.title});
        }
    });

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

    // The words of the menu are written in the language of the reader. The
    // label of the picker holds the input of the file, so only its first node
    // of text is written over. The button of the menu carries no word, only a
    // glyph, so what it is called is read by a screen reader alone.
    (function () {
        var entries = document.querySelectorAll("[data-message]"),
            labelled = document.querySelectorAll("[data-label]"),
            i,
            entry,
            word;
        for (i = 0; i < entries.length; i += 1) {
            entry = entries[i];
            entry.firstChild.nodeValue =
                api.i18n.getMessage(entry.getAttribute("data-message"));
        }
        for (i = 0; i < labelled.length; i += 1) {
            entry = labelled[i];
            word = api.i18n.getMessage(entry.getAttribute("data-label"));
            entry.setAttribute("aria-label", word);
            entry.setAttribute("title", word);
        }
    }());

    // The entry leads to the page that tells how the viewer is used and what
    // the format is worth, in the language of the reader, rather than to the
    // site of the project: it is in the package, so it is read offline and it
    // outlives the site.
    (function () {
        var language = api.i18n.getUILanguage().split("-")[0];
        if (LANGUAGES.indexOf(language) === -1) {
            language = "en";
        }
        document.getElementById("about").href =
            api.runtime.getURL("welcome." + language + ".html");
    }());

    // How the pages are laid out, which the menu asks of the canvas: one
    // page under another as a document is scrolled, two beside one another as
    // a book is read, and the first of them alone on the right where a book
    // begins on a right page.
    (function () {
        var ways = [
            {id: "onepage", perRow: 1, alone: false},
            {id: "twopages", perRow: 2, alone: false},
            {id: "twopagesright", perRow: 2, alone: true}
        ];
        ways.forEach(function (way) {
            var entry = document.getElementById(way.id);
            if (!entry) {
                return;
            }
            entry.addEventListener("click", function () {
                canvas.setPagesPerRow(way.perRow);
                canvas.setFirstPageOnItsOwn(way.alone);
                showMenu(false);
            });
        });
    }());

    menubutton.addEventListener("click", function (event) {
        event.stopPropagation();
        showMenu(menu.hidden);
    });
    // A click anywhere else closes the menu, as a menu of a window does. The
    // entries close it themselves, since the click reaches the document.
    document.addEventListener("click", function () {
        showMenu(false);
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !menu.hidden) {
            showMenu(false);
            menubutton.focus();
        }
    });

    canvas.addListener("statereadychange", fit);
    // A row of two pages is twice as wide as one, so the document is scaled to
    // the window anew every time the pages are drawn.
    canvas.addListener("pagesdrawn", fit);
    window.addEventListener("resize", refit);

    // Thunderbird names the attachment of a message rather than an address:
    // the document is read here, in the tab, and not in the background. A url
    // of a blob belongs to the page that made it, and the background of an
    // add-on is a page that is unloaded as soon as it falls idle, taking the
    // url of the blob with it, which left the tab with nothing to read.
    if (message && part) {
        api.messages.getAttachmentFile(Number(message), part).then(
            function (file) {
                // The document is drawn and saved from the same blob, so the
                // attachment is read once and written as it came. The url of
                // the blob is made here, in the tab, and not in the background
                // of the add-on: that background is a page Thunderbird unloads
                // as soon as it falls idle, and the url would die with it.
                url = URL.createObjectURL(file);
                show(name || file.name);
                canvas.load(url);
            }
        );
        return;
    }

    if (!url) {
        show("OpenDocument Viewer");
        return;
    }
    show(name || decodeURIComponent(url.split("/").pop()));
    canvas.load(url);
}());
