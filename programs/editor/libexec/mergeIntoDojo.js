/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
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

/*
 * this build tool shall merge the amd modules into
 * the "compiled dojo application" (given as first argument)
 *
 * it is intended to be used with nodejs from webodf build process
 *
 * example:
 * node mergeIntoDojo.js \
 *     dojobuild=$BUILD/programs/editor/dojo/dojo.js \
 *     foo.js bar.js > dojo-amalgamation.js
 */

/*
 * last line of built dojo.js looks like:
 * (function(){var e=this.require;e({cache:{}});!e.async&&e(["dojo"]);e.boot&&e.apply(null,e.boot)})();
 *
 * the to-be-merged module needs to be put before that line to
 * avoid on-demand loading.
 */

/*global require,process */
(function () {
    "use strict";
    var fs = require("fs"), args, dojo_build,
        log = function (x) {
            process.stderr.write(x);
            process.stderr.write("\n");
        },
        mergees = [], stat,
        tail, idx, i;

    args = process.argv;

    while (args[0]) {
        dojo_build = args.shift();
        if (dojo_build.match(/^dojobuild=/)) {
            break;
        }
    }
    if (!dojo_build.match(/^dojobuild=/)) {
        log("dojobuild= argument missing.");
        return 1;
    }
    dojo_build = dojo_build.substr(10);
    stat = null;
    try {
        stat = fs.statSync(dojo_build);
    } catch (ignore) {
    }
    if (!(stat && stat.isFile())) {
        log("dojobuild= does not point to a file.");
        return 1;
    }

    while (args[0]) {
        try {
            stat = null;
            stat = fs.statSync(args[0]);
            if (stat && stat.isFile()) {
                mergees.push(args.shift());
            } else {
                log("skipping ["+args[0]+"] as non-file.");
            }
        } catch (e2) {
            log("skipping ["+args[0]+"] as non-existent.");
        }
    }

    log("merging ["+mergees.join(",")+"] into "+dojo_build);

    dojo_build = fs.readFileSync(dojo_build);
    if (!dojo_build) {
        log("dojobuild empty?");
        return 1;
    }

    // The modules are put before the line that boots the loader, so that
    // nothing is asked for on demand once the page runs. That line was looked
    // for as the last line of the file, which held while dojo was minified
    // into one line by its own build; it is looked for by what it does
    // instead, so that a build that is not minified is read as well.
    // The modules are put before the block that boots the loader, which is
    // the block that takes what the layer holds in its cache and hands it to
    // the loader: a module written after it is a module the loader never
    // finds there, and asks a server for. The block was looked for as the
    // last line of the file, which held only while dojo minified its layer
    // into one line; it is looked for by what it does instead.
    tail = dojo_build.toString();
    idx = tail.lastIndexOf("require({cache:{}})");
    if (idx !== -1) {
        idx = tail.lastIndexOf("(function(", idx);
    }
    if (idx === -1) {
        idx = tail.lastIndexOf("\n");
    }
    if (idx === -1) {
        log("the boot of the loader was not found in the build of dojo.");
        return 1;
    }

    process.stdout.write(dojo_build.slice(0, idx));

    // merge the modules here
    for (i=0; i<mergees.length; i+=1) {
        // process.stdout.write("\n// START OF "+mergees[i]+"\n");
        process.stdout.write(fs.readFileSync(mergees[i]));
        // process.stdout.write("\n// END OF "+mergees[i]+"\n");
    }

    process.stdout.write(dojo_build.slice(idx));

}());
