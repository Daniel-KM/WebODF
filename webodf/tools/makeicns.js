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
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

// Writes the icon of macos, "*.icns", from the png of the project: the dock,
// the finder and the window of the information each draw the size they ask for,
// so the sizes are made here, as they are for windows, see "makeico.js", whose
// reading of a png this uses.
//
// An icns is a header and a list of images, each under a name of four letters
// that says its size. The images are kept as png, which macos reads since
// 10.7, so none of the bitmaps of old is written.
//
// Usage: node makeicns.js icon.png icon.icns

"use strict";

const fs = require("fs");
const {readPng, scale, writePng} = require("./makeico.js");

/** The name of each size in an icns, from the ones macos reads as png. */
const NAMES = {
    16: "icp4",
    32: "icp5",
    64: "icp6",
    128: "ic07",
    256: "ic08",
    512: "ic09"
};

function writeIcns(images) {
    const parts = [];
    let length = 8;
    images.forEach(function (image) {
        const head = Buffer.alloc(8);
        head.write(image.name, 0, "ascii");
        head.writeUInt32BE(image.bytes.length + 8, 4);
        parts.push(head, image.bytes);
        length += image.bytes.length + 8;
    });
    const head = Buffer.alloc(8);
    head.write("icns", 0, "ascii");
    head.writeUInt32BE(length, 4);
    return Buffer.concat([head].concat(parts));
}

if (require.main === module) {
    const [source, target] = process.argv.slice(2);
    if (!source || !target) {
        process.stderr.write("Usage: node makeicns.js icon.png icon.icns\n");
        process.exit(1);
    }
    const read = readPng(fs.readFileSync(source));
    const written = Object.keys(NAMES)
        .map(Number)
        .filter((size) => size <= read.width)
        .map((size) => ({
            name: NAMES[size],
            bytes: writePng(size === read.width ? read : scale(read, size))
        }));
    if (!written.length) {
        process.stderr.write("The icon is smaller than the smallest size.\n");
        process.exit(1);
    }
    fs.writeFileSync(target, writeIcns(written));
}
