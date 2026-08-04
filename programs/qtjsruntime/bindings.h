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

#ifndef BINDINGS_H
#define BINDINGS_H

#include <QByteArray>

/**
 * The script that gives the runtime of the library the things a page cannot do,
 * through the object nativeio of the channel. It defines
 * "window.__qtjsruntime.install" and "window.__qtjsruntime.run", and changes
 * nothing until one of them is called.
 */
QByteArray runtimeBindings();

/**
 * The script of QWebChannel, that qt ships as a resource of webengine.
 */
QByteArray webChannelScript();

/**
 * The script that watches whether the page is still doing something. It is put
 * in every page before anything else runs, and defines
 * "window.__qtjsruntime.idle" and "window.__qtjsruntime.size".
 */
QByteArray idleWatcher();

#endif
