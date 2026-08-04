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

#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QString>

class ViewerScheme;
class QTimer;
class QWebEngineView;

/**
 * The window of the viewer: a menu, a page that draws the document, and the
 * name of the document in the title.
 *
 * The document is drawn by the library, in the webengine of qt, which is the
 * same code as the one of the extensions for the browsers and of the viewer for
 * android: what is written here is the shell a document is opened, zoomed and
 * printed from.
 */
class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);

    /** Open a document, and tell whether it could be read. */
    bool open(const QString& path);

protected:
    void closeEvent(QCloseEvent* event) override;
    void dragEnterEvent(QDragEnterEvent* event) override;
    void dropEvent(QDropEvent* event) override;

protected:
    void moveEvent(QMoveEvent* event) override;
    void resizeEvent(QResizeEvent* event) override;

private slots:
    void chooseDocument();
    /** Show the page that tells what the format is worth and what this does. */
    void aboutFormat();
    void exportPdf();
    void printDocument();
    void about();

private:
    void createMenus();
    /** Keep the place and the size of the window for the next time. */
    void saveGeometry();
    /** The directory a document was last read from or written to. */
    QString lastDirectory() const;
    void setLastDirectory(const QString& directory);
    /** Call one of the functions the page of the viewer offers. */
    void ask(const QString& call);

    QWebEngineView* view;
    ViewerScheme* server;
    QTimer* keeper;
    /** The window of the page above, kept so that one is opened at a time. */
    QWidget* reading;
    QString path;
};

#endif
