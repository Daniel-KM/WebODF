## Products

The library "webodf.js" alone is built with node too, and this is the simplest
way to get it, see "README-Building.md". The products below, that bundle the
library with the editors, the extensions and their documentation, are built
with cmake only.

The WebODF repository not only contains sources for the library webodf.js, but
also a few products based on it. This is the complete list of products that can
be created ("x.y.z" is a placeholder for the actual version number):

### What each product runs on

A product runs where the engine it is drawn in has what the library asks of
it: the elements of a document are read by their namespace, the rules of the
pages are written in a sheet of the document, and the pages are laid in
columns that keep the spacings of an office apart. The floors below follow
from that, and from what each store and each system asks of a package.

| product                        | floor                              | what sets it                                                      |
|--------------------------------|------------------------------------|-------------------------------------------------------------------|
| library "webodf.js"            | Chrome 88, Firefox 78, Safari 15.4 | flex, `contain`, `insertRule` with `@namespace`, `document.fonts` |
| add-on for Firefox (mv3)       | Firefox 109                        | `strict_min_version` of the manifest                              |
| add-on for Firefox (mv2)       | Firefox 52                         | `strict_min_version` of the manifest                              |
| add-on for Chrome              | Chrome 88                          | `minimum_chrome_version` of the manifest                          |
| add-on for Thunderbird         | Thunderbird 128 (mv3), 98 (mv2)    | `strict_min_version` of the manifest                              |
| viewer of the desktop          | Qt 6.4                             | `find_package(Qt6 6.4)`, the one of Debian 12                     |
| viewer of the desktop, windows | Windows 10                         | `MinVersion` of the installer                                     |
| viewer of the desktop, macos   | macOS 12                           | `CMAKE_OSX_DEPLOYMENT_TARGET`, 12.0 by default                    |
| viewer of android              | Android 5 (API 21)                 | `minSdk` of the build, built against API 36                       |
| viewer of ios                  | iOS 15                             | `deploymentTarget` of the project                                 |

Internet Explorer draws nothing of a document, whatever its version: it has no
DOM that reads a namespace, which everything here leans on. The sources are
still written in the third edition of the language, and the compiler is told
so, but that says how the file is parsed and not what it needs to run.

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

This product bundles a [HOWTO](programs/editor/HOWTO-wodotexteditor.md),
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

#### Trying the editor

The editor reads its own files by request, so it is served rather than opened:
a page that is opened from a disk reaches none of them.

```sh
ninja -C build products
cd build/opendocumenttexteditor
python3 -m http.server 8098
```

| Page              | What it shows                                        |
|-------------------|------------------------------------------------------|
| texteditor.html   | the editor on "welcome.odt", the document it carries |
| localeditor.html  | a document of the disk, opened and written again     |
| revieweditor.html | the same, with the annotations of a review           |

What is worth looking at, in that order: the document is drawn with its styles
and its picture; the toolbar answers, bold, italic, the styles of a paragraph,
undo; a word typed in the text stays there and the cursor follows it;
"localeditor.html" opens an "*.odt" of the disk and writes it again; and the
console of the browser reports nothing.

The tests of the library cover none of that: they draw documents, they do not
write in them.


### Wodo.CollabTextEditor component

For those who want to get an OpenDocument Text editor for collaborative editing
in their HTML5 app, the component Wodo.CollabTextEditor is a good choice.

There is currently no documentation for it, besides what is in the code.
Wodo.CollabTextEditor is not a complete solution itself, but has some
abstraction layers which have to be implemented by adapters to the respective
server systems.

Nothing of it is opened as the editor of one writer is: the product carries no
page at all, only the component and what it draws with. A page of its own has
to load it, and a server of sessions has to answer it, which is what an
adapter is written for. The server the demonstrations of the time answered to
is gone, so what can be told of this component here is that it is built and
that its files are whole. See the demo file ["splitscreeneditor.js"](programs/editor/splitscreeneditor.js)
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

The page of the welcome comes in two, and each package carries the one of its
own under the same name: in a browser a link is enough to read a document, where
Thunderbird needs the menu of an attachment, and telling one the ways of the
other would be telling it wrong. They are written from
"welcome-browser.*.html.in" and "welcome-thunderbird.*.html.in", and both hold
the text of the format, see "One text for every product" below.

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

That version is read when the build is configured, not when it is made, and it
names the packages. A build made after a commit would therefore carry the
version of the commit before. Cmake watches ".git/HEAD" and ".git/index" for
that reason: a commit or a checkout writes one of them, cmake configures itself
again before make runs, and the packages are named after the sources they hold.
Nothing has to be remembered, and "cmake ." by hand is only needed when the
options change.

An xpi is a zip whose "manifest.json" sits at its root. The two hold the same
scripts, only their manifest differs: the version 3 declares the hosts apart,
in "host_permissions", and its web accessible resources as objects. Firefox
keeps reading the version 2, unlike Chrome, so the version 2 alone would reach
every Firefox in use; the version 3 is built as well because it is the one
addons.mozilla.org asks for.

The add-on was published on addons.mozilla.org, and it is not listed there any
more: the page of "webodf" answers 404 and a search of the store returns
nothing. The xpi of the build is installed by hand, see above.

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

A text is drawn over pages, which the library breaks it into: the pages of a
text are in no odt at all — the file holds a flow of paragraphs, and where a
page ends is decided by whoever draws it. Each page is a box of the size the
master page of the document gives it, and what does not fit in one is cut
there, a paragraph between two of its words and a table between two of its
rows, with the rows of its head written again. A presentation is another
matter, its slides being written apart in the file, and it is drawn one slide
at a time.

A reader asks for it, and for the way the pages are laid out, of the canvas:

```js
canvas.setPaginated(true);         // pages, one under another
canvas.setPagesPerRow(2);          // two to a row, as a book is read
canvas.setFirstPageOnItsOwn(true); // the first page on the right, as a book
canvas.setPageMode("columns");     // every page on one row, scrolled sideways
canvas.setPageMode("flow");        // one run of text, cut nowhere
```

The pages are broken a few at a time: the first of them are drawn in half a
second where a document of eight hundred pages takes minutes, and a reader
reads them while the rest is broken.

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

### OpenDocument Viewer for Thunderbird

The same viewer reads the attachments of the messages, so that a document that
arrives by mail is read in Thunderbird, without saving it and without an office
suite.

An attachment never travels over http: it is a part of the message itself,
addressed in "mailbox://" or "imap://", that webRequest never sees. The way of
the browsers does not reach it, and the add-on takes another one: it reads the
attachment as a file with "messages.getAttachmentFile" and opens it in a tab of
the viewer. That is the path the button "open a local document" already takes,
so "viewer.html" is used as it is.

The document is opened from an entry of the menu of the attachment, and from
the menu of a message that carries one, where it is shown once the attachments
have been read. There is no button of its own in the header of a message:
Thunderbird disables such a button but never hides it, and one that is grey on
nearly every message is noise.

The manager of the add-ons of Thunderbird shows two texts. The short one, that
sits under the name, is the field "description" of the manifest, and it is one
sentence. The long one, under the tab of the details, is not in the package at
all: it is the text of the listing of addons.thunderbird.net, written there at
the submission, and the manager reads it from the store. The one below is
that text.

> Reads the OpenDocument attachments of a message inside Thunderbird, without
> saving them and without an office suite.
>
> How it is used:
> - right-click an attachment and choose "Open in OpenDocument Viewer";
> - or right-click the message that carries it, which offers the same entry,
>   and a submenu when it carries several documents;
> - the document opens in a tab, at the size of the page, and nothing is
>   written to the disk.
>
> It reads the text (.odt, .ott, .fodt), the spreadsheets (.ods, .ots, .fods)
> and the presentations (.odp, .otp, .fodp) that LibreOffice and every other
> office suite write.
>
> Why this format rather than the other one: OpenDocument is the first format
> of office documents approved as an international standard, ISO/IEC 26300, in
> 2006, and the only one that works as one. It is written in the open by OASIS,
> it belongs to no company, and several programs of several makers write and
> read all of it. OOXML was approved in 2008 with a transitional form, meant
> for the older documents and to be dropped from the standard, and that form is
> still what the office suites write today, Microsoft 365 among them, on the
> desktop as on the web.
>
> It holds no permission on the network, reads no message but the one that is
> shown, and is free software, under the AGPL 3.

Neither text takes a link, so the way to the page that tells the whole of it is
the button of the options, the wrench of that same page, which "options_ui"
points at "welcome.html": a page that holds nothing but the choice of the
language, since the manager opens a single address and knows none.

The page of the welcome is written once for each language it is translated in,
"welcome.fr.html" beside "welcome.en.html", and the one of the language of
Thunderbird is opened, English being the one the others fall on. Its opening
is written three times, in the attributes of the title and of the first
sentence: the add-on greets a reader when it is installed, says it is up to
date when it is updated, and tells what it is when it is read from the
manager. A page of
prose is read and corrected far more easily as a page than as a file of
sentences apart, which is why the messages of i18n are not used for it.

A page of welcome is opened when the add-on is installed, and once more when
it is updated from a version that never showed it, a flag of the storage
telling one from the other. It says where the entries of the menu are, how the
settings are changed so that a double click opens the document in Thunderbird,
and what the format is worth against the other one. The pictures of the menus
are read from "skin/default/menu-attachment.png" and
"skin/default/menu-message.png". They carry the words of Thunderbird, so one
is kept for each language they are taken in, named after it:
"menu-message.fr.png" beside "menu-message.png". The page tries the language
of the reader, then that language alone, "pt" for "pt-BR", then the English
one. Each figure that finds no picture at all leaves the page rather than
showing a hole, so the page holds with none of them, with one, or with the
whole set.

A double click on an attachment is not answered for: Thunderbird carries no api
for that, and what it runs is the program the settings of the system name,
LibreOffice for a document of this format. Neither does an add-on write those
settings: no api reads or writes the handlers of the types, and only an
experiment, that runs privileged code and breaks at every release, reaches
them. An add-on adds a way of opening an attachment, it does not take the one
of the system over.

The entry is shown on the documents alone. An attachment is one when its type
is one of the nine of the format, or, for the servers that send everything as
an octet stream, when its name ends in one of the nine extensions.

The add-on asks for "menus", to add the entry, for "messagesRead", to read the
attachment of the message that is shown, and for "downloads", as the viewer
saves the document it draws. It reads no other message, and no network.

```sh
make -C build product-opendocumentviewer-thunderbird
```

It is packed twice as well: the version 3 needs Thunderbird 128, of 2024, and
the version 2 reaches back to the 98, of 2022. That floor is the one of the
menu on an attachment; every other call the add-on makes is older: the button
of the header comes from the 71, the list of the messages that are shown and
its event from the 81, and the attachments of a message from the 88.
Thunderbird carries no service worker, so both hold their background as
scripts. The add-on is published on
[addons.thunderbird.net](https://addons.thunderbird.net/), which is not AMO,
and is signed there.

The linter of Mozilla reads those packages as well, and reports two warnings
on each that belong to Firefox and not to Thunderbird: the permission
"messagesRead", that it does not know, and the key
"data_collection_permissions", that AMO asks for since Firefox 140 and that no
Thunderbird of those versions reads.

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
9 for the plugin 9, where Debian 13 packages the 4.4.1 of 2017. The sdk is read from
-DANDROID_SDK, from $ANDROID_HOME or $ANDROID_SDK_ROOT, from a
"local.properties" that is already there, or from "~/Android/Sdk" and
"/usr/lib/android-sdk". What is looked for in each of them is a "platforms"
directory: a machine may hold a "/usr/lib/android-sdk" of the tools of the
platform alone, which is not an sdk to build with, beside a whole one
elsewhere. Cmake stops with a message when it finds none, and
keeps what it found in its cache, so that the option or the variable is given
once and not at every build. It writes "local.properties" itself, which is how
gradle reads the sdk when make runs from another shell.

A variable that is exported apart, "ANDROID_HOME=/path/to/sdk; cmake ...", is
never seen by cmake: the semicolon ends the command, and the assignment stays
in the shell. It is written in the same command as cmake, with no semicolon,
or exported, or given as -DANDROID_SDK.
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

#### Trying the viewer that was built

The program that was built is run where it stands, without installing it and
without packing it:

```sh
build/programs/opendocumentviewer-desktop/opendocumentviewer-desktop
build/programs/opendocumentviewer-desktop/opendocumentviewer-desktop a-document.odt
```

Named with a document, it opens it; named with nothing, it opens the empty
screen. The library it draws with is put in it when it is linked, so a fix of
the library is seen only once the program is linked again: "make -C build
product-opendocumentviewer-desktop" answers for both.

The archive holds the same program with the entry of the menu and the icon, for
a machine where it is to be tried as it is handed over:

```sh
mkdir -p /tmp/viewer
tar xzf build/products/opendocumentviewer-x.y.z-linux-x86_64.tar.gz -C /tmp/viewer
/tmp/viewer/bin/opendocumentviewer-desktop a-document.odt
```

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
cmake --build . --config Release --target test-qtjsruntime
cmake --build . --config Release --target product-opendocumentviewer-desktop
cmake --install . --config Release --prefix dist
```

The generator of visual studio holds more than one configuration and pays no
heed to "CMAKE_BUILD_TYPE": the configuration is named at each build and at the
installation, otherwise the build writes "Debug" and the installation looks for
"Release".

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
"QtWebEngineProcess.app" and the resources it reads inside the bundle:
"OpenDocumentViewer.app" then runs on a machine where qt is not installed. The
name of the bundle holds no space, as the script that qt writes to deploy the
libraries does not quote the path it is given; the name a desktop shows is
"OpenDocument Viewer", from the plist.

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
    dist/OpenDocumentViewer.app
xcrun notarytool submit --wait ...
xcrun stapler staple dist/OpenDocumentViewer.app
```

### One place for every product

Every product is written where the target that packs it stands, deep in the
tree of the build. They are gathered in one place by:

```sh
make -C build products     # or: ninja -C build products
```

which makes each one, gathers it in "products/" of the build and names it. The
add-ons of the browsers and of Thunderbird, the two editors, the apk of android,
docnosis, the archive of the viewer of the desktop and the packages of it a
system installs are all there, each one named after the version of the sources
it was built from, so a product tells which sources it holds.

A way of handing the viewer over that the machine has no tool to write is named
at the end, with the tool that is wanting, so that a product that is missing is
not taken for one that failed:

```
The products of this build are in build/products:
  docnosis-0.5.10-314-g3b87b4ee.zip
  opendocumentviewer-firefox-0.5.10-314-g3b87b4ee.xpi
  opendocumentviewer-0.5.10-314-g3b87b4ee-linux-x86_64.tar.gz
  opendocumentviewer-0.5.10-314-g3b87b4ee-x86_64.deb
  opendocumenttexteditor-0.5.10-314-g3b87b4ee.zip

This machine has no tool to make:
  the package of fedora, for want of rpmbuild
  the AppImage, for want of linuxdeploy
  the flatpak, for want of flatpak-builder
```

The tests are run the same way, by one target:

```sh
make -C build tests
```

### The release of the products

A tag that names a version publishes the products with the release, on both
forges and apart: github builds and publishes its own, see
".github/workflows/release.yml", gitlab builds and publishes its own, see
".gitlab-ci.yml". Neither pushes a file to the other, and neither holds a
token of the other: github signs its release with the token of the run, and
gitlab with the token of the job.

The runners of gitlab are of linux, so what asks for a machine of windows or
of macos is built by github alone. What asks for a key of its own is built by
neither, as a key belongs to whoever publishes and not to a forge.

| Product                         | github | gitlab | Why                           |
|---------------------------------|--------|--------|-------------------------------|
| library, tgz                    | yes    | yes    | node alone builds it          |
| add-ons of the browsers, xpi    | yes    | yes    | node alone builds them        |
| the two editors, zip            | yes    | yes    | node alone builds them        |
| archive of the desktop, linux   | yes    | yes    | a runner of linux             |
| package of debian, deb          | yes    | yes    | dpkg-deb, of linux            |
| package of fedora, rpm          | yes    | yes    | rpmbuild, of linux            |
| AppImage                        | no     | no     | linuxdeploy, not there        |
| flatpak                         | no     | no     | flatpak-builder, not there    |
| archive of the desktop, windows | yes    | no     | a runner of windows           |
| archive of the desktop, macos   | yes    | no     | a runner of macos             |
| apk of android                  | no     | no     | it is signed by its publisher |
| bundle of macos, signed         | no     | no     | it is notarised by Apple      |
| application of ios              | no     | no     | it is signed by its publisher |

The AppImage and the flatpak would be built by adding their tools to the
runner of linux: the targets are there and skip themselves when the tool is
wanting, as they do on any machine.

### Handing the viewer of the desktop over

A program of the desktop is not a file that is downloaded and read, as an
add-on is: it is installed. Five ways are written here, from the shortest to
the most finished. Each one is a target of its own, for a build that wants one
of them alone:

```sh
make -C build package-deb
```

and "products" makes the ones the tools of the machine allow, with everything
else the build is for, see "One place for every product" above.

| Target           | What it writes                                 | What it asks of the machine                               |
|------------------|------------------------------------------------|-----------------------------------------------------------|
| package-archive  | "opendocumentviewer-x.y.z-linux-x86_64.tar.gz" | qt 6 of the system, unpacked by hand                      |
| package-deb      | "opendocumentviewer-x.y.z-x86_64.deb"          | dpkg-deb, and qt 6 named as a dependency                  |
| package-rpm      | "opendocumentviewer-x.y.z-x86_64.rpm"          | rpmbuild, and qt 6 named as a dependency                  |
| package-appimage | "OpenDocumentViewer-x.y.z-x86_64.AppImage"     | linuxdeploy and its plugin of qt, and it carries qt       |
| package-flatpak  | "org.webodf.OpenDocumentViewer-x.y.z.flatpak"  | flatpak-builder and the runtime of KDE, and it carries qt |

Every one of them is written among the products of the build.

The archive and the packages of a system name the qt of the machine rather
than carrying it, which is what a distribution asks for: a program that
carries its own qt is a program that no one updates when qt is fixed. The two
universal packages carry it, which is what someone who runs another
distribution than the one the package was made on needs.

The manifest of the flatpak names the runtime of KDE, that carries qt, and the
base app of qt, that carries its webengine, and gives the sandbox what a reader needs and no more: a window,
and the documents the reader opens. It reaches no network, as a document is
drawn on the machine and nothing of it is sent.

That runtime is installed apart from the tool, and the build asks for both when
cmake is run rather than in the middle of the build, where a runtime that is
not there reads as a broken build:

```sh
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.kde.Platform//6.9 org.kde.Sdk//6.9 \
    io.qt.qtwebengine.BaseApp//6.9
cmake -S . -B build
```

The branch is the newest one the machine has, read when cmake is run, as a
branch of the runtime is declared end of life as soon as a newer one is out;
"-DWEBODF_FLATPAK_RUNTIME=6.9" names another. Without any of them, "products"
is made without the flatpak and says so at the end, and
"make -C build package-flatpak" tells what to install.

### OpenDocument Viewer for iOS

Apple allows no engine of the web but its own on iOS, so a viewer there is a
shell around WKWebView, the view of the system, which is the WebKit of Safari.
It is what Cordova did in 2012, in the project that was in the attic,
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

Three products tell what the OpenDocument format is worth, in French and in
English: the add-ons of the browsers, in their page of the welcome, the viewer
for android and the one for the desktop, in their page about. It is one text,
written once, in "programs/text/format.en.html" and "programs/text/format.fr.html".

A page that shows it is a template, "*.html.in", that names it where it goes:

```html
@FORMAT_TEXT@
```

Cmake reads the text and writes the page, see the macro INSERT_TEXT in the
CMakeLists of the root. The page of a product is written where that product
reads it: in the build directory for the add-ons and for the viewer of the
desktop, which reads it from its resources, and among the assets for android,
where gradle reads it, as the library is copied there as well. Those pages are
not in the repository, only their templates and the text.

The text is named as a dependency of the configuration, so cmake runs itself
again as soon as it is revised, and the three products follow. A revision is
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

### The products that were

A viewer of documents has been written for whatever ran a web view, since 2012,
and the list is kept here: what a thing was, and what became of it. The code is
in the history of the repository, and it is taken out of the commit that dropped
it:

```sh
git log --diff-filter=D -- programs/touchui
git show <commit>^:programs/touchui/index.html
```

| Product                               | What it was                                                                                                                                                                                  | What became of it                                                                                                                                                                                                                                                        |
|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| nativeQtClient                        | A window of qt 4, with a tree of files, that showed a document in a QWebView. It carried "programs/touchui"                                                                                  | Dropped in 2026, commit 3b64c38a. The viewer of the desktop, in qt 6, does what it did                                                                                                                                                                                   |
| The client for iOS                    | Cordova 1.8 around a UIWebView, of 2012, that Apple stopped accepting                                                                                                                        | Dropped in 2026, commit 3b64c38a. Written again in Swift, around WKWebView                                                                                                                                                                                               |
| The client of the BlackBerry PlayBook | A widget of WebWorks, of 2012, with an extension of its own to read a file. The tablet was abandoned in 2014, BlackBerry 10 in 2022, and the servers that signed an application are gone     | Dropped in 2026, commit 3b64c38a. Nothing replaces it, as nothing runs it                                                                                                                                                                                                |
| The viewer for android of cordova     | Cordova 3.5, of 2014, built with ant, that google dropped in 2015                                                                                                                            | Replaced in 2026 by "programs/opendocumentviewer-android", that is a web view and no framework                                                                                                                                                                           |
| The viewer for Firefox OS             | Cordova as well, packed as a widget of the system                                                                                                                                            | Still declared, and still unbuildable, see above                                                                                                                                                                                                                         |
| qtjsruntime in Qt WebKit              | The tests of the library, run in the webkit of qt                                                                                                                                            | Written again in 2026 for the webengine of qt 6, WebKit having left qt in 5.6                                                                                                                                                                                            |
| "programs/touchui"                    | The touch interface of 2012, written with Sencha Touch: a browser of files and a view of a document. It was never packed on its own, the client of qt and the one of the PlayBook carried it | Dropped in 2026, commit de1bf464, with the externs of Ext JS that went with it. [Sencha Touch was merged into Ext JS](https://www.sencha.com/products/touch/), which is sold rather than free, and the viewers of today need no framework at all: a page and the library |

Two products were envisaged and never written: one for KaiOS, which the package
of Firefox OS is the beginning of, and one for macos, which is the viewer of the
desktop once it is packed as a bundle, signed and notarised.
