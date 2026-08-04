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
 * @source: https://github.com/webodf/WebODF/
 */

// Writes the icon of windows, "*.ico", from the png of the project: windows
// reads an icon from the resources of an executable, and it wants that format.
// An ico holds several sizes, and the one it draws is the one whose size is
// asked for, so the small sizes are made here rather than left to windows, that
// only scales the one it finds.
//
// The images are kept as png inside the ico, which windows reads since Vista,
// so nothing of the bitmap of old is written.
//
// Usage: node makeico.js icon.png icon.ico

"use strict";

const fs = require("fs");
const zlib = require("zlib");

/** The sizes windows asks for, from the list of the files to the desktop. */
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * Read a png of 8 bits by colour, with or without alpha, and return its pixels
 * as four bytes each.
 */
function readPng(bytes) {
    let width = 0;
    let height = 0;
    let colour = 6;
    const parts = [];
    let at = 8;
    while (at < bytes.length) {
        const length = bytes.readUInt32BE(at);
        const name = bytes.toString("ascii", at + 4, at + 8);
        if (name === "IHDR") {
            width = bytes.readUInt32BE(at + 8);
            height = bytes.readUInt32BE(at + 12);
            colour = bytes[at + 17];
            if (bytes[at + 16] !== 8 || (colour !== 6 && colour !== 2)) {
                throw new Error("Only a png of 8 bits, with or without alpha,"
                    + " is read here.");
            }
        } else if (name === "IDAT") {
            parts.push(bytes.subarray(at + 8, at + 8 + length));
        }
        at += length + 12;
    }
    const channels = colour === 6 ? 4 : 3;
    const raw = zlib.inflateSync(Buffer.concat(parts));
    const stride = width * channels;
    const pixels = Buffer.alloc(width * height * 4);
    const line = Buffer.alloc(stride);
    const before = Buffer.alloc(stride);
    let source = 0;
    for (let y = 0; y < height; y += 1) {
        const filter = raw[source];
        source += 1;
        raw.copy(line, 0, source, source + stride);
        source += stride;
        // The five filters of the png, that each line is written with.
        for (let i = 0; i < stride; i += 1) {
            const left = i >= channels ? line[i - channels] : 0;
            const up = before[i];
            const corner = i >= channels ? before[i - channels] : 0;
            let add = 0;
            if (filter === 1) {
                add = left;
            } else if (filter === 2) {
                add = up;
            } else if (filter === 3) {
                add = (left + up) >> 1;
            } else if (filter === 4) {
                const p = left + up - corner;
                const dl = Math.abs(p - left);
                const du = Math.abs(p - up);
                const dc = Math.abs(p - corner);
                add = (dl <= du && dl <= dc) ? left : (du <= dc ? up : corner);
            }
            line[i] = (line[i] + add) & 0xff;
        }
        line.copy(before);
        for (let x = 0; x < width; x += 1) {
            const from = x * channels;
            const to = (y * width + x) * 4;
            pixels[to] = line[from];
            pixels[to + 1] = line[from + 1];
            pixels[to + 2] = line[from + 2];
            pixels[to + 3] = channels === 4 ? line[from + 3] : 255;
        }
    }
    return {width, height, pixels};
}

/**
 * Scale an image down by averaging the pixels that fall in each new one, which
 * is what keeps a line of a drawing readable at sixteen pixels. The alpha is
 * weighed in, so that what is transparent does not darken what is not.
 */
function scale(image, size) {
    const pixels = Buffer.alloc(size * size * 4);
    const ratio = image.width / size;
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            let count = 0;
            const y0 = Math.floor(y * ratio);
            const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ratio));
            const x0 = Math.floor(x * ratio);
            const x1 = Math.max(x0 + 1, Math.floor((x + 1) * ratio));
            for (let sy = y0; sy < y1; sy += 1) {
                for (let sx = x0; sx < x1; sx += 1) {
                    const at = (sy * image.width + sx) * 4;
                    const alpha = image.pixels[at + 3];
                    r += image.pixels[at] * alpha;
                    g += image.pixels[at + 1] * alpha;
                    b += image.pixels[at + 2] * alpha;
                    a += alpha;
                    count += 1;
                }
            }
            const to = (y * size + x) * 4;
            pixels[to] = a ? Math.round(r / a) : 0;
            pixels[to + 1] = a ? Math.round(g / a) : 0;
            pixels[to + 2] = a ? Math.round(b / a) : 0;
            pixels[to + 3] = Math.round(a / count);
        }
    }
    return {width: size, height: size, pixels};
}

/** Write a chunk of a png, with the length and the checksum it carries. */
function chunk(name, data) {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(name, 4, "ascii");
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, sum]);
}

function writePng(image) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(image.width, 0);
    header.writeUInt32BE(image.height, 4);
    header[8] = 8;
    header[9] = 6;
    const stride = image.width * 4;
    const raw = Buffer.alloc((stride + 1) * image.height);
    for (let y = 0; y < image.height; y += 1) {
        image.pixels.copy(raw, y * (stride + 1) + 1, y * stride,
            (y + 1) * stride);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", zlib.deflateSync(raw, {level: 9})),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

function writeIco(images) {
    const head = Buffer.alloc(6 + images.length * 16);
    head.writeUInt16LE(0, 0);
    head.writeUInt16LE(1, 2);
    head.writeUInt16LE(images.length, 4);
    let at = head.length;
    images.forEach(function (image, index) {
        const entry = 6 + index * 16;
        // A size of 256 is written as a zero, which is why the format stops
        // there.
        head[entry] = image.size === 256 ? 0 : image.size;
        head[entry + 1] = image.size === 256 ? 0 : image.size;
        head.writeUInt16LE(1, entry + 4);
        head.writeUInt16LE(32, entry + 6);
        head.writeUInt32BE(0, entry + 8);
        head.writeUInt32LE(image.bytes.length, entry + 8);
        head.writeUInt32LE(at, entry + 12);
        at += image.bytes.length;
    });
    return Buffer.concat([head].concat(images.map((image) => image.bytes)));
}

// The reading of a png and its scaling serve the icon of macos as well, see
// "makeicns.js", so they are given away here rather than written twice.
module.exports = {readPng, scale, writePng};

if (require.main === module) {
    const [source, target] = process.argv.slice(2);
    if (!source || !target) {
        process.stderr.write("Usage: node makeico.js icon.png icon.ico\n");
        process.exit(1);
    }
    const read = readPng(fs.readFileSync(source));
    const written = SIZES
        .filter((size) => size <= read.width)
        .map((size) => ({
            size,
            bytes: writePng(size === read.width ? read : scale(read, size))
        }));
    fs.writeFileSync(target, writeIco(written));
}
