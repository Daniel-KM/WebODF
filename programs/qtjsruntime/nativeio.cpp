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

#include "nativeio.h"

#include <QCoreApplication>
#include <QFile>
#include <QFileInfo>

NativeIO::NativeIO(QObject* parent, const QDir& cwd_)
    : QObject(parent),
      cwd(cwd_) {
}

QString NativeIO::absolute(const QString& path) const {
    return cwd.absoluteFilePath(path);
}

QString NativeIO::writeFile(const QString& path, const QString& base64) {
    const QByteArray data = QByteArray::fromBase64(base64.toLatin1());
    QFile file(absolute(path));
    if (!file.open(QIODevice::WriteOnly)) {
        return "Could not open file for writing.";
    }
    if (file.write(data) != data.length()) {
        return "Could not write to file.";
    }
    return QString();
}

QString NativeIO::deleteFile(const QString& path) {
    QFile file(absolute(path));
    if (!file.exists()) {
        return "File does not exist.";
    }
    if (!file.remove()) {
        return "Could not delete file.";
    }
    return QString();
}

qint64 NativeIO::getFileSize(const QString& path) {
    const QFileInfo info(absolute(path));
    return info.exists()
        ? info.size()
        : -1;
}

void NativeIO::exit(int code) {
    qApp->exit(code);
}
