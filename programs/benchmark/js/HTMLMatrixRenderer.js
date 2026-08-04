/**
 * Copyright (C) 2026 Daniel Berthereau <Daniel.git@Berthereau.net>
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
 * @source: https://webodf.org/
 * @source: https://github.com/webodf/WebODF/
 */

/*global define, document*/

define(function () {
    "use strict";

    /**
     * The four documents in one table: an action to a line, a document to a
     * column, and the time it took in the cell. A run is then read across, from
     * a page to a thousand, which is what a benchmark is for.
     * @constructor
     * @param {!HTMLTableElement} outputTable
     * @param {!HTMLElement} outputHead
     * @param {!Array.<!string>} fileUrls
     */
    function HTMLMatrixRenderer(outputTable, outputHead, fileUrls) {
        var rows = {};

        function writeHead() {
            var row = document.createElement("tr"),
                cell = document.createElement("td");
            cell.className = "action";
            cell.textContent = "Action";
            row.appendChild(cell);
            fileUrls.forEach(function (fileUrl) {
                var column = document.createElement("td");
                column.className = "elapsed";
                column.textContent = fileUrl.replace(/\.odt$/, "");
                row.appendChild(column);
            });
            outputHead.textContent = "";
            outputHead.appendChild(row);
        }

        /**
         * The line of an action is made when the first document reaches it, and
         * the ones after it fill their own cell of that same line.
         * @param {!number} index
         * @param {!string} description
         * @return {!HTMLTableRowElement}
         */
        function rowOf(index, description) {
            var row, cell, i;
            if (!rows.hasOwnProperty(index)) {
                row = document.createElement("tr");
                cell = document.createElement("td");
                // The name of the document is in the head of its column, so
                // it is taken out of the line, that holds for all of them.
                cell.textContent = (index + 1) + ". "
                    + description.replace(/\s+\S+\.odt$/, "");
                row.appendChild(cell);
                for (i = 0; i < fileUrls.length; i += 1) {
                    row.appendChild(document.createElement("td"));
                }
                outputTable.appendChild(row);
                rows[index] = row;
            }
            return rows[index];
        }

        /**
         * @param {!Benchmark} benchmark
         * @param {!number} column
         * @return {undefined}
         */
        this.follow = function (benchmark, column) {
            benchmark.actions.forEach(function (action, index) {
                var row = rowOf(index, action.state.description),
                    cell = row.cells[column + 1];
                cell.textContent = "…";
                action.subscribe("complete", function (state) {
                    cell.textContent = state.status
                        ? state.elapsedTime
                        : "failed";
                });
            });
        };

        writeHead();
    }

    return HTMLMatrixRenderer;
});
