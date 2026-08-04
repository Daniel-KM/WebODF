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

#include "mainwindow.h"

#include "viewerscheme.h"
#include "words.h"

#include <QApplication>
#include <QCloseEvent>
#include <QDesktopServices>
#include <QDir>
#include <QDragEnterEvent>
#include <QDropEvent>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QGuiApplication>
#include <QLoggingCategory>
#include <QMenuBar>
#include <QMessageBox>
#include <QMimeData>
#include <QPrintDialog>
#include <QPrinter>
#include <QScreen>
#include <QSettings>
#include <QStandardPaths>
#include <QStatusBar>
#include <QTimer>
#include <QWebEngineProfile>
#include <QWebEngineSettings>
#include <QActionGroup>
#include <QWebEngineView>

#include <functional>

Q_LOGGING_CATEGORY(viewerLog, "webodf.viewer")

namespace {

/** The name every document of the format is read under. */
const char* documentFilter =
    "*.odt *.ott *.ods *.ots *.odp *.otp *.odg *.otg *.odf *.fodt *.fods"
    " *.fodp *.fodg";

/**
 * A page that writes what the document says on the terminal. A document that
 * cannot be drawn says so in the page as well, so this is for the one who
 * builds the viewer, not for the one who reads a document with it: it is quiet
 * unless the category "webodf.viewer" is turned on.
 */
class ViewerPage : public QWebEnginePage {
public:
    ViewerPage(QObject* parent, const std::function<void()>& onAbout)
        : QWebEnginePage(parent),
          about(onAbout) {
    }

protected:
    /**
     * The page holds one link, the one of the page of the format: it is opened
     * in a window of its own rather than in place of the document.
     */
    bool acceptNavigationRequest(const QUrl& url, NavigationType /*type*/,
            bool /*isMainFrame*/) override {
        if (url.path().startsWith("/about")) {
            about();
            return false;
        }
        return true;
    }

    void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level,
            const QString& message, int lineNumber,
            const QString& sourceID) override {
        if (level == ErrorMessageLevel) {
            qCWarning(viewerLog) << sourceID << lineNumber << message;
        } else {
            qCDebug(viewerLog) << sourceID << lineNumber << message;
        }
    }

private:
    const std::function<void()> about;
};

/**
 * A page of prose, whose links leave for the browser of the system: the viewer
 * shows documents, and it is no browser.
 */
class ReadingPage : public QWebEnginePage {
public:
    explicit ReadingPage(QObject* parent)
        : QWebEnginePage(parent) {
    }

protected:
    bool acceptNavigationRequest(const QUrl& url, NavigationType type,
            bool /*isMainFrame*/) override {
        if (type == NavigationTypeLinkClicked && url.scheme() != "odf") {
            QDesktopServices::openUrl(url);
            return false;
        }
        return true;
    }
};

/**
 * Tell whether a file is a document of the format, by its first bytes.
 *
 * A document of OpenDocument is a zip whose first entry is its type, stored
 * uncompressed, so the name of the format is read in the head of the file; a
 * document may also be written as one xml file, ".fodt" and its kin. The check
 * is made here rather than left to the library, that draws what it is given and
 * waits for a document that never comes when it is not one, see "refreshOdf" in
 * "OdfCanvas.js".
 */
bool isDocument(const QString& path) {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        return false;
    }
    const QByteArray head = file.read(128);
    return (head.startsWith("PK")
            && head.contains("application/vnd.oasis.opendocument"))
        || head.startsWith("<?xml");
}

/** The path of the first document of a drop, if it holds one. */
QString droppedDocument(const QMimeData* data) {
    const QList<QUrl> urls = data->urls();
    for (const QUrl& url : urls) {
        if (url.isLocalFile()) {
            return url.toLocalFile();
        }
    }
    return QString();
}

} // namespace

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent),
      view(new QWebEngineView(this)),
      server(new ViewerScheme(this)),
      keeper(new QTimer(this)),
      reading(nullptr),
      closeAction(nullptr) {

    QWebEngineProfile::defaultProfile()->installUrlSchemeHandler("odf", server);

    view->setPage(new ViewerPage(view, [this] { aboutFormat(); }));
    view->settings()->setAttribute(QWebEngineSettings::PluginsEnabled, false);
    view->settings()->setAttribute(QWebEngineSettings::ErrorPageEnabled, false);
#if QT_VERSION >= QT_VERSION_CHECK(6, 7, 0)
    // A document is shown in the colours it was written in. Chromium is able to
    // turn a page it finds too bright into a dark one, by changing the colours
    // as it paints them, which no style sheet can undo and which would make a
    // document read differently from the way it prints: it is turned off here
    // whatever the theme of the system is.
    view->settings()->setAttribute(QWebEngineSettings::ForceDarkMode, false);
#endif
    // Nothing is typed in a document that is only read, and the page holds no
    // field, so the menus of the web are left out.
    view->setContextMenuPolicy(Qt::NoContextMenu);
    setCentralWidget(view);
    setAcceptDrops(true);

    createMenus();
    statusBar();

    // What a report of a document that reads badly needs, beside the line the
    // page writes when it has drawn one.
    qCDebug(viewerLog) << "qt" << qVersion() << "platform"
        << QGuiApplication::platformName();

    // The window is kept a moment after it was last moved or resized, rather
    // than when it is closed: a program that is killed, from the terminal it
    // was started in for instance, never sees its window closed, and the place
    // of the window would be lost every time.
    keeper->setSingleShot(true);
    keeper->setInterval(1000);
    connect(keeper, &QTimer::timeout, this, &MainWindow::saveGeometry);

    // A document may be given before the page is there to draw it, when the
    // viewer is started with one, so it is drawn once the page has loaded.
    connect(view, &QWebEngineView::loadFinished, this, [this](bool ok) {
        if (ok && !path.isEmpty()) {
            ask("load()");
        }
    });
    view->setUrl(QUrl(ViewerScheme::pageUrl));

    // A window that was closed opens as it was left. A first one is made large
    // enough to show a page of A4 whole, which is 794 pixels wide at the size
    // it was written at, and no larger than the screen it opens on: the size
    // the view asks for is the one of an empty page, a few pixels.
    const QSettings settings;
    if (!restoreGeometry(settings.value("geometry").toByteArray())) {
        const QRect screen = QGuiApplication::primaryScreen()->availableGeometry();
        QRect wanted(QPoint(), QSize(qMin(900, int(screen.width() * 0.8)),
                                     qMin(1150, int(screen.height() * 0.9))));
        wanted.moveCenter(screen.center());
        setGeometry(wanted);
    }
    setWindowTitle(QApplication::applicationDisplayName());
}

void MainWindow::createMenus() {
    QMenu* const file = menuBar()->addMenu(words::of("&File", "&Fichier"));
    QAction* const openAction = file->addAction(
        words::of("&Open…", "&Ouvrir…"), QKeySequence::Open,
        this, &MainWindow::chooseDocument);
    openAction->setStatusTip(words::of("Read a document of the OpenDocument"
        " format", "Lire un document au format OpenDocument"));
    closeAction = file->addAction(words::of("&Close", "&Fermer"),
        QKeySequence::Close, this, &MainWindow::closeDocument);
    closeAction->setStatusTip(words::of("Put the document away",
        "Refermer le document"));
    closeAction->setEnabled(false);
    file->addSeparator();
    file->addAction(words::of("&Print…", "Im&primer…"), QKeySequence::Print,
        this, &MainWindow::printDocument);
    file->addAction(words::of("Export as &PDF…", "Exporter en &PDF…"),
        this, &MainWindow::exportPdf);
    file->addSeparator();
    file->addAction(words::of("&Quit", "&Quitter"), QKeySequence::Quit,
        this, &QWidget::close);

    // The zoom is the one of the library, that draws the page at the size it
    // asks for: the numbers are kept in the page, see "viewer.js".
    QMenu* const display = menuBar()->addMenu(
        words::of("&Display", "&Affichage"));
    display->addAction(words::of("Zoom &in", "Zoom a&vant"),
        QKeySequence::ZoomIn, this, [this] { ask("zoomBy(1.25)"); });
    display->addAction(words::of("Zoom &out", "Zoom a&rrière"),
        QKeySequence::ZoomOut, this, [this] { ask("zoomBy(0.8)"); });
    display->addAction(words::of("&Actual size", "&Taille réelle"),
        QKeySequence(Qt::CTRL | Qt::Key_0), this, [this] { ask("setZoom(1)"); });
    display->addAction(words::of("Fit to &width", "Ajuster à la &largeur"),
        QKeySequence(Qt::CTRL | Qt::Key_9), this, [this] { ask("fit()"); });

    // How the pages are laid out: one under another as a document is
    // scrolled, or two beside one another as a book is read, where the first
    // page faces nothing of its own.
    display->addSeparator();
    QActionGroup* const rows = new QActionGroup(this);
    QAction* const onePage = display->addAction(
        words::of("&One page", "Une &page"), this,
        [this] { ask("setPages(1, false)"); });
    QAction* const twoPages = display->addAction(
        words::of("&Two pages", "&Deux pages"), this,
        [this] { ask("setPages(2, false)"); });
    QAction* const twoPagesRight = display->addAction(
        words::of("Two pages, first on the &right",
            "Deux pages, la p&remière à droite"), this,
        [this] { ask("setPages(2, true)"); });
    for (QAction* const one : {onePage, twoPages, twoPagesRight}) {
        one->setCheckable(true);
        rows->addAction(one);
    }
    onePage->setChecked(true);

    QMenu* const help = menuBar()->addMenu(words::of("&Help", "Aid&e"));
    help->addAction(words::of("About &OpenDocument and this viewer",
        "À propos d’&OpenDocument et du lecteur"),
        this, &MainWindow::aboutFormat);
    help->addAction(words::of("&About", "À &propos"), this, &MainWindow::about);
}

void MainWindow::ask(const QString& call) {
    view->page()->runJavaScript("window.viewer && window.viewer." + call);
}

bool MainWindow::open(const QString& wanted) {
    const QFileInfo info(wanted);
    if (!info.isReadable() || !info.isFile()) {
        QMessageBox::warning(this, QApplication::applicationDisplayName(),
            words::of("This document cannot be read: ",
                      "Ce document ne peut pas être lu : ")
                + info.filePath());
        return false;
    }
    if (!isDocument(info.absoluteFilePath())) {
        QMessageBox::warning(this, QApplication::applicationDisplayName(),
            words::of("This file is not a document of the OpenDocument"
                      " format: ",
                      "Ce fichier n’est pas un document au format"
                      " OpenDocument : ")
                + info.fileName());
        return false;
    }
    path = info.absoluteFilePath();
    setLastDirectory(info.absolutePath());
    server->setPath(path);
    setWindowTitle(info.fileName() + " — "
        + QApplication::applicationDisplayName());
    statusBar()->showMessage(path);
    closeAction->setEnabled(true);
    // The page reads the document at a single address, so it is told to read it
    // again rather than sent to another one.
    ask("load()");
    return true;
}

void MainWindow::closeDocument() {
    if (path.isEmpty()) {
        return;
    }
    path.clear();
    server->setPath(QString());
    closeAction->setEnabled(false);
    setWindowTitle(QApplication::applicationDisplayName());
    statusBar()->clearMessage();
    ask("unload()");
}

QString MainWindow::lastDirectory() const {
    // The directory of the last document, so that the next one is looked for
    // where the last one was found rather than where the program was started
    // from, which is a directory of the build or of the system.
    const QSettings settings;
    const QString kept = settings.value("directory").toString();
    if (!kept.isEmpty() && QFileInfo(kept).isDir()) {
        return kept;
    }
    const QString documents = QStandardPaths::writableLocation(
        QStandardPaths::DocumentsLocation);
    return documents.isEmpty()
        ? QDir::homePath()
        : documents;
}

void MainWindow::setLastDirectory(const QString& directory) {
    QSettings settings;
    settings.setValue("directory", directory);
}

void MainWindow::chooseDocument() {
    const QString chosen = QFileDialog::getOpenFileName(this,
        words::of("Open a document", "Ouvrir un document"),
        lastDirectory(),
        words::of("Documents of the OpenDocument format (",
                  "Documents au format OpenDocument (")
            + documentFilter + ");;"
            + words::of("Every file (*)", "Tous les fichiers (*)"));
    if (!chosen.isEmpty()) {
        open(chosen);
    }
}

void MainWindow::exportPdf() {
    if (path.isEmpty()) {
        return;
    }
    const QString chosen = QFileDialog::getSaveFileName(this,
        words::of("Export as PDF", "Exporter en PDF"),
        lastDirectory() + "/" + QFileInfo(path).completeBaseName() + ".pdf",
        "*.pdf");
    if (chosen.isEmpty()) {
        return;
    }
    setLastDirectory(QFileInfo(chosen).absolutePath());
    QMetaObject::Connection* const connection = new QMetaObject::Connection;
    *connection = connect(view->page(), &QWebEnginePage::pdfPrintingFinished,
            this, [this, connection](const QString& file, bool ok) {
        disconnect(*connection);
        delete connection;
        statusBar()->showMessage(ok
            ? words::of("Written: ", "Écrit : ") + file
            : words::of("This file cannot be written: ",
                        "Ce fichier ne peut pas être écrit : ") + file);
    });
    view->page()->printToPdf(chosen);
}

void MainWindow::printDocument() {
    if (path.isEmpty()) {
        return;
    }
    QPrinter printer(QPrinter::HighResolution);
    QPrintDialog dialog(&printer, this);
    if (dialog.exec() == QDialog::Accepted) {
        view->print(&printer);
    }
}

void MainWindow::aboutFormat() {
    // One window at a time: a second call brings the one that is open forward.
    if (!reading) {
        QWebEngineView* const page = new QWebEngineView();
        page->setPage(new ReadingPage(page));
        page->setAttribute(Qt::WA_DeleteOnClose);
        page->setWindowTitle(words::of("About OpenDocument and this viewer",
            "À propos d’OpenDocument et du lecteur"));
        page->resize(QSize(760, 900).boundedTo(
            QGuiApplication::primaryScreen()->availableSize()));
        page->setUrl(QUrl(QString("odf:/")
            + words::of("about.en.html", "about.fr.html")));
        connect(page, &QObject::destroyed, this, [this] {
            reading = nullptr;
        });
        reading = page;
    }
    reading->show();
    reading->raise();
    reading->activateWindow();
}

void MainWindow::about() {
    QMessageBox::about(this, words::of("About", "À propos"),
        "<p><b>" + QApplication::applicationDisplayName() + "</b> "
        + QApplication::applicationVersion() + "</p><p>"
        + words::of(
            "Reads the documents of the OpenDocument standard written by"
            " LibreOffice and by every other office suite: text (.odt),"
            " spreadsheets (.ods) and presentations (.odp).",
            "Lit les documents au standard OpenDocument créés par LibreOffice"
            " et toutes les suites bureautiques : textes (.odt), tableurs"
            " (.ods) et présentations (.odp).")
        + "</p><p>"
        + words::of(
            "OpenDocument is the first format of office documents approved as"
            " an international standard, ISO/IEC 26300, and the only one that"
            " is shareable, lasting and independent of any company.",
            "OpenDocument est le premier format de documents bureautiques"
            " approuvé comme norme internationale, ISO/IEC 26300, et le seul"
            " qui soit partageable, durable et indépendant d’une entreprise.")
        + "</p><p>"
        + words::of("It draws the documents with WebODF, a library that reads"
            " the format in javascript, and it is free software, under the"
            " AGPL 3 license.",
            "Il affiche les documents avec WebODF, une bibliothèque qui lit le"
            " format en javascript, et c’est un logiciel libre, sous licence"
            " AGPL 3.")
        // The certificate of the site does not cover "www", so the name is
        // written without it.
        + "</p><p><a href=\"https://webodf.org/\">webodf.org</a> · <a href=\""
        + words::of("https://en.wikipedia.org/wiki/OpenDocument",
                    "https://fr.wikipedia.org/wiki/OpenDocument")
        + "\">"
        + words::of("OpenDocument on Wikipedia", "OpenDocument sur Wikipédia")
        + "</a></p>");
}

void MainWindow::saveGeometry() {
    QSettings settings;
    settings.setValue("geometry", QMainWindow::saveGeometry());
}

void MainWindow::closeEvent(QCloseEvent* event) {
    saveGeometry();
    event->accept();
}

void MainWindow::moveEvent(QMoveEvent* event) {
    QMainWindow::moveEvent(event);
    keeper->start();
}

void MainWindow::resizeEvent(QResizeEvent* event) {
    QMainWindow::resizeEvent(event);
    keeper->start();
}

void MainWindow::dragEnterEvent(QDragEnterEvent* event) {
    if (!droppedDocument(event->mimeData()).isEmpty()) {
        event->acceptProposedAction();
    }
}

void MainWindow::dropEvent(QDropEvent* event) {
    const QString dropped = droppedDocument(event->mimeData());
    if (!dropped.isEmpty()) {
        event->acceptProposedAction();
        open(dropped);
    }
}
