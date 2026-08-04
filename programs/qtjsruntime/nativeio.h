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

#ifndef NATIVEIO_H
#define NATIVEIO_H

#include <QDir>
#include <QObject>

/**
 * The three things the page cannot do on its own, and the way it ends.
 *
 * It is given to the page over a QWebChannel, so every call answers through a
 * callback. That is enough because the runtime of the library asks for these
 * with a callback of its own: only "readFileSync" needs an answer in the call
 * itself, and reading is left to the page, that reads a file with a request on
 * it, the way the runtime of a browser does.
 *
 * Paths are taken as they are given, and a relative one is read from the
 * directory the program was started in, as node does.
 */
class NativeIO : public QObject {
    Q_OBJECT
public:
    NativeIO(QObject* parent, const QDir& cwd);

public slots:
    /**
     * Write the bytes of a file, given in base64: what travels over the
     * channel is text, and the bytes of a document are not.
     * @return the error, or an empty string
     */
    QString writeFile(const QString& path, const QString& base64);

    /**
     * @return the error, or an empty string
     */
    QString deleteFile(const QString& path);

    /**
     * @return the size of the file, or -1 when it cannot be read
     */
    qint64 getFileSize(const QString& path);

    /**
     * End the program with a code. The page is not waiting for anything, so it
     * is done as soon as the call comes back here.
     */
    void exit(int code);

private:
    QString absolute(const QString& path) const;

    const QDir cwd;
};

#endif
