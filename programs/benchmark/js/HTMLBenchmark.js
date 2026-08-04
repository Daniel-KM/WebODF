/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/webodf/WebODF/
 */

/*global define, document, window, webodf*/

define([
    "Benchmark",
    "HTMLResultsRenderer",
    "HTMLMatrixRenderer",
    "OpenDocument",
    "EnterEditMode",
    "MoveCursorToEndDirect",
    "InsertLetterA",
    "RemovePositions",
    "MoveCursorLeft",
    "SelectEntireDocument",
    "RemoveCurrentSelection",
    "PreloadDocument",
    "BoldCurrentSelection",
    "AlignCurrentSelectionJustified",
    "MoveCursorToEnd",
    "MoveCursorToStart",
    "SaveDocument"
], function (Benchmark, HTMLResultsRenderer, HTMLMatrixRenderer,
             OpenDocument, EnterEditMode, MoveCursorToEndDirect,InsertLetterA, RemovePositions, MoveCursorLeft,
             SelectEntireDocument, RemoveCurrentSelection, PreloadDocument, BoldCurrentSelection,
             AlignCurrentSelectionJustified, MoveCursorToEnd, MoveCursorToStart, SaveDocument) {
    "use strict";

    /**
     * Convert url query parameters into an Object
     * Source: http://stackoverflow.com/a/2880929
     * @return {!Object.<!string, !string>}
     */
    function getQueryParams() {
        /*jslint regexp: true*/
        var match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            query  = window.location.search.substring(1),
            urlParams = {};
        /*jslint regexp: false*/

        match = search.exec(query);
        while (match) {
            urlParams[decode(match[1])] = decode(match[2]);
            match = search.exec(query);
        }

        return urlParams;
    }

    /**
     * Extract supported benchmark options from the url query parameters
     * @return {!{fileUrls: !Array.<!string>, includeSlow: !boolean,
     *            colour: (string|undefined), matrix: !boolean}}
     */
    function getConfiguration() {
        var params = getQueryParams();
        return {
            /**
             * Test documents to load, one after the other, separated by
             * commas. Relative or absolute urls are supported. One document
             * is measured unless others are named, as the four of them take
             * minutes: "all.html" names them, see "README-Building.md".
             */
            fileUrls: (params.fileUrl || "100pages.odt").split(","),
            /**
             * Include the known slow actions in the benchmark. They take a
             * minute on a hundred pages and far more on a thousand, as one
             * operation is made for each paragraph of the selection, and they
             * are left out by "includeSlow=false" when the wait is too long.
             */
            includeSlow: params.includeSlow !== "false",
            /** Background colour of the benchmark results. Useful for distinguishing different benchmark versions */
            colour: params.colour,
            /**
             * One table of an action to a line and a document to a column,
             * rather than the actions of a document one under the other.
             */
            matrix: params.layout === "matrix"
        };
    }


    /**
     * @constructor
     */
    function HTMLBenchmark() {
        var loadingScreenElement = document.getElementById('loadingScreen'),
            canvasElement = document.getElementById("canvas"),
            benchmarkResultsElement = document.getElementById("benchmarkResults").getElementsByTagName("tbody")[0],
            benchmarkHeadElement = document.getElementById("benchmarkResults").getElementsByTagName("thead")[0],
            versionElement = document.getElementById("version"),
            config = getConfiguration(),
            documents = config.fileUrls.slice(),
            matrix = null,
            column = -1,
            self = this;

        versionElement.textContent = webodf.Version;
        loadingScreenElement.style.display = "none";

        /**
         * A line that says which document the rows under it belong to.
         * @param {!string} fileUrl
         * @return {undefined}
         */
        function writeHeading(fileUrl) {
            var row = document.createElement("tr"),
                cell = document.createElement("th");
            cell.colSpan = 5;
            cell.textContent = fileUrl;
            cell.style.textAlign = "left";
            cell.style.paddingTop = "1em";
            row.appendChild(cell);
            benchmarkResultsElement.appendChild(row);
        }

        /**
         * @param {!string} fileUrl
         * @param {!function():undefined} callback
         * @return {undefined}
         */
        function runOne(fileUrl, callback) {
            var benchmark = new Benchmark(canvasElement),
                renderer;

            if (config.matrix) {
                column += 1;
            } else {
                renderer = new HTMLResultsRenderer(benchmark, benchmarkResultsElement);
                renderer.setBackgroundColour(config.colour);
                writeHeading(fileUrl);
            }

            benchmark.actions.push(new PreloadDocument(fileUrl));
            benchmark.actions.push(new OpenDocument(fileUrl));
            benchmark.actions.push(new EnterEditMode());
            benchmark.actions.push(new MoveCursorToEnd());
            benchmark.actions.push(new MoveCursorToStart());
            benchmark.actions.push(new InsertLetterA(100));
            benchmark.actions.push(new RemovePositions(100, true));
            benchmark.actions.push(new MoveCursorToEndDirect());
            benchmark.actions.push(new InsertLetterA(1));
            benchmark.actions.push(new InsertLetterA(100));
            benchmark.actions.push(new RemovePositions(1, true));
            benchmark.actions.push(new MoveCursorLeft(1));
            benchmark.actions.push(new MoveCursorLeft(100));
            benchmark.actions.push(new RemovePositions(1, false));
            benchmark.actions.push(new RemovePositions(100, true));
            benchmark.actions.push(new SelectEntireDocument());
            benchmark.actions.push(new BoldCurrentSelection());
            benchmark.actions.push(new AlignCurrentSelectionJustified());
            benchmark.actions.push(new SaveDocument());
            if (config.includeSlow) {
                benchmark.actions.push(new RemoveCurrentSelection());
            }

            if (config.matrix) {
                matrix.follow(benchmark, column);
            }
            benchmark.subscribe("complete", callback);
            benchmark.start();
        }

        // The documents are measured one after the other, in one table: a run
        // is read as a whole, and two runs are compared line by line.
        function runNext() {
            var fileUrl = documents.shift();
            if (fileUrl) {
                runOne(fileUrl, runNext);
            }
        }

        if (config.matrix) {
            matrix = new HTMLMatrixRenderer(benchmarkResultsElement,
                benchmarkHeadElement, config.fileUrls);
        }

        self.start = runNext;
    }

    return HTMLBenchmark;
});
