/*global document, window, odf*/

(function () {
    "use strict";

    var container = document.getElementById("odf"),
        message = document.getElementById("message"),
        failure = document.getElementById("failure"),
        ways = document.getElementById("ways"),
        canvas = null,
        translated,
        i;

    // The words of the viewer are written in the page, in the attribute of the
    // language: this file holds no sentence of its own.
    if (String(window.navigator.language).indexOf("fr") === 0) {
        translated = document.querySelectorAll("[data-fr]");
        for (i = 0; i < translated.length; i += 1) {
            translated[i].firstChild.nodeValue =
                translated[i].getAttribute("data-fr");
        }
        document.getElementById("about").href = "odf:/about.fr.html";
    }

    // The width the page may take, once the space that keeps it off the edges
    // of the window is taken off.
    function available() {
        var style = window.getComputedStyle(container);
        return document.documentElement.clientWidth
            - parseFloat(style.paddingLeft)
            - parseFloat(style.paddingRight);
    }

    // What the first text of the document is drawn in, and what it is drawn on:
    // a text takes the colour of the ground when the document names none, so
    // this is what tells a white text on white paper.
    function ink() {
        var drawn = container.getElementsByTagName("*"),
            style,
            box,
            i;
        for (i = 0; i < drawn.length; i += 1) {
            // Only a text that is drawn tells anything: the metadata of a
            // document, its date and its author, are in the page as well, and
            // they are the first ones there.
            box = drawn[i].getBoundingClientRect();
            style = window.getComputedStyle(drawn[i]);
            if (drawn[i].firstChild
                    && drawn[i].firstChild.nodeType === 3
                    && drawn[i].firstChild.nodeValue.trim()
                    && box.width > 0
                    && box.height > 0
                    && style.display !== "none") {
                return "ink " + style.color + " on "
                    + window.getComputedStyle(canvas.getSizer()).backgroundColor
                    + " in " + style.fontFamily;
            }
        }
        return "no text drawn";
    }

    function zoom() {
        return canvas
            ? canvas.getZoomLevel()
            : 1;
    }

    window.viewer = {
        /**
         * Draw the document the window is serving. The canvas is made again
         * every time, as the one before holds the document it drew.
         */
        load: function () {
            if (canvas) {
                canvas.destroy(function () {
                    return;
                });
                container.innerHTML = "";
            }
            message.hidden = true;
            failure.hidden = true;
            ways.hidden = true;
            canvas = new odf.OdfCanvas(container);
            // A row of two pages is twice as wide as one, so the document is
            // scaled to the window anew every time the pages are drawn: they
            // are drawn a few at a time, and the last of them says how wide
            // the document is.
            canvas.addListener("pagesdrawn", function () {
                canvas.fitSmart(available());
            });
            // A text is drawn over pages, as it is printed, which the
            // library does not do on its own.
            canvas.setPaginated(true);
            canvas.addListener("statereadychange", function (odfcontainer) {
                if (odfcontainer.state === odf.OdfContainer.INVALID) {
                    failure.hidden = false;
                    return;
                }
                // A document is drawn at its own size, which is what it was
                // written at; it is only scaled down when it is wider than the
                // window, as fitSmart never scales up.
                canvas.fitSmart(available());
                // The window shows this when the category "webodf.viewer" is
                // turned on, which is how a build is checked without a screen,
                // and how the colours of a document that reads badly are told
                // apart from the theme of the system.
                window.console.log("drawn "
                    + canvas.getSizer().offsetWidth + "x"
                    + canvas.getSizer().offsetHeight + " at zoom "
                    + canvas.getZoomLevel() + ", " + ink()
                    + ", dark theme "
                    + window.matchMedia("(prefers-color-scheme: dark)").matches);
            });
            // The window serves the document that is open at this one address,
            // whichever file it is, see "viewerscheme.cpp".
            canvas.load("odf:/document");
        },

        /**
         * Put the document away and show what the window shows with none.
         * @return {undefined}
         */
        unload: function () {
            if (canvas) {
                canvas.destroy(function () {
                    return;
                });
                canvas = null;
                container.innerHTML = "";
            }
            failure.hidden = true;
            message.hidden = false;
            ways.hidden = false;
        },

        /**
         * @param {!number} factor
         */
        zoomBy: function (factor) {
            var wanted = zoom() * factor;
            if (canvas && wanted >= 0.1 && wanted <= 10) {
                canvas.setZoomLevel(wanted);
            }
        },

        /**
         * @param {!number} level
         */
        setZoom: function (level) {
            if (canvas) {
                canvas.setZoomLevel(level);
            }
        },

        /** Draw the page as wide as the window allows, scaling up as needed. */
        fit: function () {
            if (canvas) {
                canvas.fitToWidth(available());
            }
        },

        /**
         * How the pages are laid out: one to a row, as a document is
         * scrolled; two to a row, as a book is read; or two to a row with
         * the first on the right of its own, as the first page of a book
         * faces nothing.
         * @param {!number} perRow one or two
         * @param {!boolean} firstAlone
         * @return {undefined}
         */
        setPages: function (perRow, firstAlone) {
            if (canvas) {
                canvas.setPagesPerRow(perRow);
                canvas.setFirstPageOnItsOwn(firstAlone);
            }
        }
    };
}());
