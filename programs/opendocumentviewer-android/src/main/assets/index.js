/*global document, window, odf, URLSearchParams*/

(function () {
    "use strict";

    var url = new URLSearchParams(window.location.search).get("file"),
        container = document.getElementById("odf"),
        about = document.getElementById("about"),
        translated,
        i,
        canvas;

    // A page is wider than the screen of a phone, so it is scaled down to the
    // width that is left once the padding is taken off; on a tablet, where it
    // holds, it is drawn at its own size, as fitSmart never scales up. The
    // width is read on the document, not on the container, that the page it
    // holds widens. The scale is set again when the screen is turned.
    function fit() {
        var style = window.getComputedStyle(container);
        canvas.fitSmart(document.documentElement.clientWidth
            - parseFloat(style.paddingLeft)
            - parseFloat(style.paddingRight));
    }

    // The words of the reader are written in the page, in the attribute of
    // the language: this file holds no sentence of its own.
    if (String(window.navigator.language).indexOf("fr") === 0) {
        translated = document.querySelectorAll("[data-fr]");
        for (i = 0; i < translated.length; i += 1) {
            translated[i].firstChild.nodeValue =
                translated[i].getAttribute("data-fr");
        }
        about.href = "/about.fr.html";
    }

    if (!url) {
        return;
    }
    document.getElementById("empty").style.display = "none";
    about.style.display = "none";
    canvas = new odf.OdfCanvas(container);
    canvas.addListener("statereadychange", fit);
    window.addEventListener("resize", fit);
    canvas.load(url);
}());
