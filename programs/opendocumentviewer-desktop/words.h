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

#ifndef WORDS_H
#define WORDS_H

#include <QLocale>
#include <QString>

/**
 * The words of the two languages the viewer is written in.
 *
 * Qt translates with tr() and a catalogue that lrelease compiles, which is a
 * tool of qt that is packaged apart and that the build does not need for
 * anything else. The viewer holds two languages, as its pages do, so the pair
 * is written where it is used and the one of the language of the system is
 * taken: nothing to compile, and nothing to keep in step in another file.
 */
namespace words {

/**
 * @param en the words in English, used for every language but French
 * @param fr the words in French
 */
inline QString of(const char* en, const char* fr) {
    return QLocale::system().language() == QLocale::French
        ? QString::fromUtf8(fr)
        : QString::fromUtf8(en);
}

} // namespace words

#endif
