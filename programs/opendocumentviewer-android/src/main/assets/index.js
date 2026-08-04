/*global document, window, odf, URLSearchParams*/

(function () {
    "use strict";

    var url = new URLSearchParams(window.location.search).get("file");

    if (!url) {
        return;
    }
    document.getElementById("empty").style.display = "none";
    new odf.OdfCanvas(document.getElementById("odf")).load(url);
}());
