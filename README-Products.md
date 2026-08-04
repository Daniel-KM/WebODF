## Products

The library "webodf.js" alone is built with node too, and this is the simplest
way to get it, see "README-Building.md". The products below, that bundle the
library with the editors, the extensions and their documentation, are built
with cmake only.

The WebODF repository not only contains sources for the library webodf.js, but
also a few products based on it. This is the complete list of products that can
be created ("x.y.z" is a placeholder for the actual version number):

None of them is built by a plain "make": they are asked for by their own
target, from the build directory, and they need the option WEBODF_PROGRAMS,
see "README-Building.md". The targets are listed by:

```sh
make -C build help
```

Each product answers to "product-", that builds it and runs the tests that go
with it, and to "build-" and "test-", that do one or the other. The commands
below are run from the build directory, or prefixed with "make -C build" from
the sources, since the makefiles are written there and not next to the sources.
Every product is written at the root of that directory, next to "webodf/".


### webodf.js library with API documentation

This product bundles the file webodf.js, the debug version webodf-debug.js and
API documentation into one zip file.

With a prepared setup for building, you execute this command:

```sh
make product-library
```

This creates a file "webodf.js-x.y.z.zip" in the same folder, which can be
copied and unzipped on a system where you want to develop using the webodf.js library.

Download the latest officially released version from the [WebODF homepage](http://webodf.org/download).


### Wodo.TextEditor component

For those who want to get an OpenDocument Text editor with just a few lines of
JavaScript in their HTML5 app, the component Wodo.TextEditor is the right choice.

This product bundles a [HOWTO](https://github.com/webodf/WebODF/blob/master/programs/editor/HOWTO-wodotexteditor.md),
example files, API documentation and a subdirectory with all files belonging to
the component in one zip file.

With a prepared setup for building, you execute this command:

```sh
make product-opendocumenttexteditor
```

It creates a file "opendocumenttexteditor-x.y.z.zip", which can be copied and
used on a system where you want to develop using the component. Unzip it there
and read the included HOWTO.md file.

See the online demo on [webodf.org/demo](http://webodf.org/demo) and download
the latest officially released version from the [WebODF homepage](http://webodf.org/download).


### Wodo.CollabTextEditor component

For those who want to get an OpenDocument Text editor for collaborative editing
in their HTML5 app, the component Wodo.CollabTextEditor is a good choice.

There is currently no documentation for it, besides what is in the code.
Wodo.CollabTextEditor is not a complete solution itself, but has some
abstraction layers which have to be implemented by adapters to the respective
server systems. See the demo file ["splitscreeneditor.js"](programs/editor/splitscreeneditor.js)
for an example application by a client-side server with an example adapter.
This product bundles a subdirectory with all files belonging to the component in
one zip file.

With a prepared setup for building, you execute this command:

```sh
make product-opendocumenttextcollab
```

It creates a file "opendocumenttextcollab-x.y.z.zip", which can be copied and
used on a system where you want to develop using the component. Unzip it there
and move the subdirectory "wodo" to your deployment.

Download the latest officially released version from the [WebODF homepage](http://webodf.org/download).


### OpenDocument Viewer, the add-ons of the browsers

This Firefox add-on enables to view files in the OpenDocument format directly in
your Firefox browser, without installing a big office suite.

With a prepared setup for building, you execute this command:

```sh
make product-opendocumentviewer-webext
```

This creates three files:

- "opendocumentviewer-firefox-x.y.z.xpi", of the manifest version 3, that
  Firefox reads from its version 109, of 2023;
- "opendocumentviewer-firefox-mv2-x.y.z.xpi", of the manifest version 2, that
  it reads from its version 52, of 2017, and still reads today;
- "opendocumentviewer-chrome-x.y.z.zip", for Chrome from its version 88, of
  2021, and the browsers built on it, Edge and Opera among them.

Chrome for Android runs no extension at all, whatever its version, so only its
desktop releases are reached. Firefox for Android runs the two xpi.

The two xpi pass "addons-linter", the tool addons.mozilla.org validates a
submission with, without an error. Two warnings are left, both on
"data_collection_permissions": it is newer than the versions of Firefox the
manifests reach back to, that ignore the keys they do not know, and it is
declared nonetheless, as a submission without it is refused.

Chrome dropped the blocking webRequest the two others redirect with, so its
package sends the documents to the viewer with a rule of
declarativeNetRequest, from a service worker. The rule is written by the
worker rather than read from a file of the package, as the url it redirects to
has to be an absolute one, and the identifier of the extension is only known
once it is installed.

The rule matches the nine extensions of the format in the url, where the
background script of Firefox also reads the content type: a document a server
sends under a generic type, or under a url without an extension, is missed. A
rule only reads the response headers from Chrome 128, and asking for that
would leave out forty of its releases.

### Running the packages without installing them

Both browsers load a package from a directory, with a profile of their own, so
that nothing has to be clicked and nothing is kept:

```sh
npx web-ext run --source-dir build/opendocumentviewer-firefox-mv2-x.y.z/
chromium --user-data-dir=$(mktemp -d) --no-first-run \
    --load-extension=build/opendocumentviewer-chrome-x.y.z/
```

web-ext writes a temporary profile, installs the add-on in it and follows the
changes of the files. Firefox refuses an unsigned xpi, but not a directory
loaded this way, which is also what "about:debugging" does by hand.

Chrome keeps the profile of --user-data-dir, hence the temporary directory,
and --load-extension only takes a directory, never a zip.

The version of an add-on only takes up to four numbers separated by dots,
where git describe adds the number of commits and a hash: the build writes
"0.5.10-161-gc2572a4a" as "0.5.10.161", so that the builds between two tags
still follow each other.

An xpi is a zip whose "manifest.json" sits at its root. The two hold the same
scripts, only their manifest differs: the version 3 declares the hosts apart,
in "host_permissions", and its web accessible resources as objects. Firefox
keeps reading the version 2, unlike Chrome, so the version 2 alone would reach
every Firefox in use; the version 3 is built as well because it is the one
addons.mozilla.org asks for.

Download and install the latest officially released version from [Mozilla's Add-on website](https://addons.mozilla.org/firefox/addon/webodf/).
The description the stores are given, that the field "description" of the
manifests holds a shortened form of, as Chrome only takes 132 characters
there:

> OpenDocument Viewer reads the documents of the OpenDocument format, the
> ones of LibreOffice, OpenOffice and Collabora: text (.odt, .fodt, .ott),
> spreadsheets (.ods, .fods, .ots) and presentations (.odp, .fodp, .otp).
>
> A document opens in the browser, at once, with no download and no office
> suite to install.
>
> The add-on is light, half a megabyte, where the readers of the format that
> are installed apart weigh a hundred times that.
>
> OpenDocument is the first format of office documents that was approved as
> an international standard, ISO/IEC 26300, in 2006, and the only one that
> works as one: it is written in the open by OASIS, it belongs to no company,
> and several programs of several makers write and read the whole of it.
>
> A document written today is still read in twenty years, by whoever, with
> whatever.

An add-on has to be signed by Mozilla to install in a release Firefox, whoever
distributes it.

The add-on replaces the bootstrapped one of 2012, that declared an XPCOM
stream converter and targeted the versions 6 to 15 of Firefox: that kind of
add-on stopped loading in Firefox 57, of 2017.

Its background script watches the responses whose content type, or whose
extension when the server sends a generic one, is one of the nine of the
OpenDocument format, and sends them to the page "viewer.html" of the add-on,
that reads the document with WebODF. "webodf.js" is a file of its own inside
the package, as the content security policy of an add-on forbids the script
that used to be written inside the page.

A document that is read from the disk is opened from the page itself, with
"open a local document": webRequest only watches http, https and the web
sockets, so a file:// url never reaches the background script, and Firefox
offers to save it or to open it with an office suite as it would without the
add-on. The stream converter that was replaced sat under all of them, so it
caught those as well; no api of a WebExtension does.

The add-on holds nothing of its own outside the browser. It asks for
"webRequest" and "webRequestBlocking" to send the responses to its page, for
the hosts to read them, and for "downloads" to save the document the page
shows, since a page of an add-on may not save a file of another origin by
itself.

Only the APIs Firefox has carried since its version 47 are used, so the
version 2 runs down to the version 52 its manifest asks for, that is the one
the key "author" needs. Chrome is out of reach for both: its manifest version
3 wants a service worker as background, that Firefox does not support, and it
dropped the blocking webRequest this add-on redirects with.

### OpenDocument Viewer for Android

This application shows a document in the OpenDocument format on Android, so
that the documents a phone receives are read without an office suite. It
registers for the nine types of the format, so the system offers it when one
is opened.

Started on its own, from the list of the applications, it shows an empty page
that asks for a document, and opens the picker of the system when it is touched:
the system reads the file and hands it over, so the viewer holds no permission
to reach the storage. It carries no bar and no button, as there would be one of
each.

It runs from Android 5.0, the release the web view began to be updated apart
from the system in, so it holds a recent engine even on an old phone.

With a prepared setup for building, from the build directory:

```sh
cmake -S ../webodf -DWEBODF_PROGRAMS=ON -DWEBODF_ANDROID=ON
make product-opendocumentviewer-android
```

It is behind the option WEBODF_ANDROID, as it needs the sdk of android and a
jdk, that the build does not download. Gradle is downloaded, as the closure
compiler and Rhino are: its version is the one the plugin of android asks for,
9 for the plugin 9, where Debian 13 packages the 4.4.1 of 2017. The sdk is read
from $ANDROID_HOME, the directory it is installed in, or from "sdk.dir" of the
file "local.properties"; cmake stops with that message when it finds neither.
The command line tools that install the sdk are at https://developer.android.com/studio#command-tools,
and the packages the build needs are:

```sh
sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"
```

The apk that is written is not signed, as only its author may sign it, so it
installs nowhere as it is. A second one is built for a test, that gradle signs
with the key it writes for that:

```sh
make opendocumentviewer-android-debug
```

It is written next to the other, in "build/programs/opendocumentviewer-android/build/
outputs/apk/debug/opendocumentviewer-android-debug.apk", and installs on a device with
"adb install", or in Waydroid, that runs Android on a Linux desktop:

```sh
waydroid session start
waydroid app install .../opendocumentviewer-android-debug.apk
```

A document is read from the shared storage of Waydroid, "~/.local/share/waydroid/data/media/0",
that Android sees as "/sdcard": copy one there and open it with a file manager,
that offers the viewer among the applications that read the format.

Waydroid needs a web view of its own, that its images hold; the viewer draws
nothing without one.

The texts of the stores are in the sources, under
"programs/opendocumentviewer-android/src/main/fastlane/metadata/android/", in
the layout fastlane defines: a directory for each locale, with "title.txt", a
"short_description.txt" of 80 characters at most, a "full_description.txt" of
4000, and a changelog for each version code. F-Droid reads them from the
repository at each build, so the description of the store is written and
reviewed with the code; Google Play does not, and its console asks for the
same texts by hand, or its publishing api does.

The icon is drawn once, in 512 pixels, and the sizes are cut from it. F-Droid
reads it in "images/icon.png" of the locale, transparent, as it draws it on
the ground of its own card. Google Play refuses a transparency and masks the
corners itself, so it is given an opaque copy, "store/icon-play.png", that is
uploaded by hand and is in no package. The launcher of android gets an
adaptive icon, "mipmap-anydpi-v26/icon.xml": a white ground and a drawing that
holds in the 72dp of the 108dp that every shape of every maker shows, with the
sizes of the five densities beside it, and a square icon with a margin for the
launchers before android 8.

The sdk is the only part of the build that is not free software, and the reason
this product is off by default. The build tools are free: Debian builds them
from the sources of AOSP and ships them in main. The platform is not free: it
comes from the servers of Google, under the Android Software Development Kit License Agreement,
that gradle asks to accept and writes in "$ANDROID_HOME/licenses/". Debian may
not redistribute it, and only packages an installer that downloads it, in
non-free. Those terms cover the sdk, not what is built with it: the apk stays
under the license of WebODF.

It is a web view that reads a page and the library from the assets of the
application, with no framework, no plugin and no dependency at all: the sources
are in "programs/opendocumentviewer-android" and hold one class. Everything is served
over "https://webodf.invalid/", from the requests the web view is intercepted
on, as a page loaded from "file://" may not read another file with XMLHttpRequest,
which is how the library reads a document. Only the four files of the viewer and
the one document are served, each compared by its name and never used to build a
path. The document the system hands over comes as a "content://" uri, that a web
view may not read, so it is copied into the cache first.

Nothing the viewer does reaches the network. The application asks for no
permission, INTERNET included, so the system refuses a connection whatever
happens. The web view answers every request itself, and answers with nothing at
all when the address is not one of its files: a document that holds an image or
a style sheet of the web tells no server that it was opened. Safe Browsing is
turned off in the manifest, as there is no address to check, which spares the
web view from asking Google for its lists, and the metrics it may report are
turned off as well.

The web view is still the one of the system, kept up to date by Google, and what
it does on its own, such as reading the configuration of its field trials,
belongs to it rather than to this application.

It replaces the product of "programs/cordova", that drove cordova 3.5, of 2014,
and built android with ant, which google dropped in 2015 for gradle, through the
executable "android", that the sdk replaced by "sdkmanager" in 2018.

### OpenDocument Viewer for the desktop

This program shows a document of the OpenDocument format on a desktop, on linux,
on windows and on macos: a window of qt around the same page the add-ons of the
browsers and the viewer for android draw a document in. There is one place where
the reading of the format lives, and one behaviour to keep in step.

It reads the text (.odt), the spreadsheets (.ods), the presentations (.odp) and
the drawings (.odg), with their templates. A document is opened from the menu,
by dropping it in the window, or by naming it on the command line, which is how
a file manager opens one. It is drawn at the size it was written at, and only
scaled down when it is wider than the window; the menu of the display zooms it,
sets it back to its own size, or fits it to the width.

A document is printed, and written as a pdf, by the printing of the engine.

The menu of the help, and the foot of the empty screen, lead to a page that
tells what the viewer does and what the format is worth, in French or in
English, after the language of the system. The part about the format is the same
text as the one the add-ons and the viewer for android show, and it is the same
file: see "One text for every product" below.

With a prepared setup for building, from the build directory:

```sh
cmake -S ../webodf -DWEBODF_DESKTOP=ON
make product-opendocumentviewer-desktop
```

It is behind the option WEBODF_DESKTOP, as it needs the modules of qt, and it
is built by that option alone: it needs neither Dojo nor the editors, so
WEBODF_PROGRAMS is not asked for. The modules are the ones qtjsruntime needs,
see "README-Building.md".

The program is one file: the page, its style, its script, the library and the
icon are all put in it, so it runs wherever it is copied. It is installed with
what a desktop needs to offer it for a document:

```sh
make install
```

It writes the program in "bin", an entry in "share/applications" that names the
nine types of the format, and the icon under the name of the entry, as the
specification of the freedesktop asks. A double click on a document then offers
the viewer among the applications that read the format.

The page and the document it shows are served by the program itself, under a
scheme of its own, "odf:", see "programs/opendocumentviewer-desktop/viewerscheme.cpp":
they are one origin that way, which is what the page needs to read the document,
and the disk is not opened to it for that, as the one document that was chosen
is served, at one address, whichever file it is.

#### The viewer on windows

Nothing in the program is of linux, and the build writes what windows asks for:
the icon in the format of its own, made from the icon of the project at the
sizes windows draws it at, the version that the properties of the file show, and
a program that opens no terminal behind its window.

Qt WebEngine does not compile with MinGW, which the documentation of Qt states,
so the compiler is the one of Microsoft. The program is of 64 bits, and only of
64 bits: Qt 6 is built for x86_64 and for arm64, and no longer for a windows of
32 bits. The property WIN32_EXECUTABLE of cmake, that the build sets, is named
after the interface of windows and not after an architecture: it says that the
program opens a window rather than a terminal. What is needed, beside the sources:

* Visual Studio Build Tools, for the compiler and the linker;
* Qt 6 with the modules of the viewer, WebEngine among them, from the installer
  of Qt;
* CMake, Ninja, node and a java runtime, as on linux.

```sh
cmake -S ..\webodf -DWEBODF_DESKTOP=ON -DWEBODF_QTJSRUNTIME=ON
cmake --build . --target test-qtjsruntime
cmake --build . --target product-opendocumentviewer-desktop
cmake --install . --prefix dist
```

The first target runs the tests of the library in the webengine of qt, the whole
suite of the browser: it is what tells that the library behaves on windows as it
does elsewhere, which nobody has known since Qt WebKit died. It costs nothing to
ask for once the modules of qt are there, see "README-Building.md".

The installation runs "windeployqt", which gathers the libraries of qt,
"QtWebEngineProcess.exe" and the resources it reads beside the program: the
directory then runs on a machine where qt is not installed. That is what the
script of the installer takes:

```sh
iscc programs\opendocumentviewer-desktop\opendocumentviewer.iss
```

It is written for [Inno Setup](https://jrsoftware.org/isinfo.php), and it
declares the nine types of the format under one identifier, in
"OpenWithProgids": the viewer is then offered beside the office suite of the
machine, in "Open with", and it never takes the place of what a double click
opens. Windows warns about a program that is not signed, so a certificate is
needed for an installer that is handed to others.

##### A machine to build on

The build needs a windows, and there is none to cross build from: the compiler
of Microsoft does not run elsewhere, and MinGW, that does, is the one WebEngine
refuses. A virtual machine answers, in VirtualBox as in QEMU. Microsoft offers
an evaluation of windows, and a machine that is already prepared for
development, at https://developer.microsoft.com/windows/downloads/. Give it 8 GB
of memory and 60 GB of disk: Qt with WebEngine and the build tools of Visual
Studio weigh some 30 GB together, and the build writes as much again.

Everything is then installed by one script, in a terminal opened as an
administrator:

```powershell
powershell -ExecutionPolicy Bypass -File programs\opendocumentviewer-desktop\data\setup-windows.ps1
```

It takes the tools from winget and Qt from its own repository, with
[aqtinstall](https://github.com/miurahr/aqtinstall), the installer of Qt asking
for an account that a script cannot answer for. Since Qt 6.8, WebEngine is an
extension rather than a module, in a repository of its own, so the script checks
that it was written and says what to do when it was not. It ends by printing the
commands above.

A machine without a graphics card, which a virtual one often is, draws the
documents all the same: chromium falls back on the processor. Should a window
stay empty, the fallback is asked for by hand:

```powershell
set QTWEBENGINE_CHROMIUM_FLAGS=--disable-gpu
```

#### The viewer on macos

The same program, and the same build: what macos asks for beyond it is a bundle
rather than a plain executable, an icon in the format of its own, made from the
same drawing as the one of windows, and a "Info.plist" that names the eleven
types the viewer reads.

```sh
cmake -S ../webodf -DWEBODF_DESKTOP=ON -DWEBODF_QTJSRUNTIME=ON \
    -DCMAKE_PREFIX_PATH=$HOME/Qt/6.8.2/macos
cmake --build . --target test-qtjsruntime
cmake --build . --target product-opendocumentviewer-desktop
cmake --install . --prefix dist
```

The installation runs "macdeployqt", which gathers the frameworks of qt,
"QtWebEngineProcess.app" and the resources it reads inside the bundle: "OpenDocument
Viewer.app" then runs on a machine where qt is not installed.

One thing of macos is in the code rather than in the build: a document opened by
a double click, or by "Open with", is not named on the command line there. The
system sends it to the application once it is running, as an event, which
"main.cpp" listens for. Without it the viewer would open its empty window and
forget what it was asked for.

The bundle is neither signed nor notarised by the build. Without that, macos
refuses to open it save through the menu of the context, and says it comes from
an unidentified developer. Both need an account of the developer program of
Apple, at a hundred dollars a year:

```sh
codesign --deep --force --options runtime --sign "Developer ID Application: ..." \
    "dist/OpenDocument Viewer.app"
xcrun notarytool submit --wait ...
xcrun stapler staple "dist/OpenDocument Viewer.app"
```

### OpenDocument Viewer for iOS

Apple allows no engine of the web but its own on iOS, so a viewer there is a
shell around WKWebView, the view of the system, which is the WebKit of Safari.
It is what Cordova did in 2012, in the project that was in "attic/programs/ios",
with the UIWebView of the time: the same architecture, without the framework
between, and with the engine of today, that compiles the javascript rather than
reading it.

The shell is written in Swift, in "Sources", and it is the one of android in the
words of another system: the page, the library, the way a document is served and
the way a link is followed are the same, see "ViewerActivity.java" beside it.
Everything is served under "odf://viewer/", by a handler of that scheme, so that
the page and the document are of one origin: it is what lets the library read a
document with a request, and no name a document holds reaches anything else. No
request of this viewer ever leaves the device.

The page it shows is the page of android, file for file: cmake copies it, with
the library and the pages about the format, into "Resources".

```sh
cmake -S ../webodf -DWEBODF_IOS=ON
make product-opendocumentviewer-ios
```

The application itself is built by Xcode, on a mac: nothing else builds one for
iOS. The project is written by [XcodeGen](https://github.com/yonaskolb/XcodeGen)
from "project.yml", a project of Xcode being a file no one writes by hand:

```sh
brew install xcodegen
cd programs/opendocumentviewer-ios
xcodegen generate
open OpenDocumentViewer.xcodeproj
```

What is needed beyond the code is not code: a mac with Xcode, an account of the
developer program of Apple, that costs a hundred dollars a year, the signature
of the application, and the review of the App Store. There is no F-Droid there,
and no way to hand an application over outside the store, save to the devices of
the developer.

### One text for every product

The pages of the products tell what the OpenDocument format is worth, and they
tell it in the same words: the text is written once, in
"programs/text/format.en.html" and "programs/text/format.fr.html", and nowhere
else.

A page that shows it is a template, "*.html.in", that names it where it goes:

```html
@FORMAT_TEXT@
```

Cmake reads the text and writes the page, see the macro INSERT_TEXT in the
CMakeLists of the root. The page of a product is written where that product
reads it, and it is not in the repository: only its template and the text are.

The text is named as a dependency of the configuration, so cmake runs itself
again as soon as it is revised, and every product follows. A revision is
therefore made in one file, and it cannot be forgotten in another.

### Products that are not built any more

One product of "programs/cordova" is still declared, and no version of its
toolchain is available: it is kept until it is either brought up to date or
dropped.

"make product-opendocumentviewer-firefoxos" packs it for Firefox OS. The system was abandoned
by Mozilla in 2016, but it lives on through its forks, B2G OS, KaiOS and
Capyloon, so the product is worth reviving rather than dropping. KaiOS in
particular runs on feature phones that no office suite serves, which is the kind
of place a viewer of the OpenDocument format is the most useful.

### docnosis, that tells whether a document keeps to the standard

A page, and nothing else: a document is dropped on it, and it says what it is
made of and whether it holds to OpenDocument. The document is read in the page
and goes nowhere — nothing is uploaded, and no server sees it, which is what
sets it apart from [the validator of the ODF Toolkit](https://odfvalidator.org/),
of [odftoolkit.org](https://odftoolkit.org/), that reads the same schemas in
java, on a server.

```sh
cmake -S ../webodf -DWEBODF_PROGRAMS=ON
make product-docnosis
```

It writes "docnosis-x.y.z.zip", that holds the page, the schemas and the sources
of the library: the validator of Relax NG is left out of "webodf.js", as no
viewer uses it, so the page reads the library from its sources. A document is
dropped on the page, or named in the address, which is how it is run without
hands:

```
index.html?file=document.odt
```

What it tells of a document:

* the type it declares, and whether the package says the same;
* the version of the standard it was written to, from 1.0 to 1.4, the schemas
  of every one of them being there, as published by OASIS;
* whether it holds to the schema of that version;
* what it holds that the standard does not define, named by the namespace it is
  written under, "loext" for LibreOffice.

That last one is the point of the whole thing. A document of LibreOffice does
not fit the schema, and it is not broken for that: the standard says that a
program writes its additions under a name of its own and that a reader that does
not know them ignores them, see the text of the format. Reporting them apart
from the errors is what keeps a validator from calling a sound document broken.
