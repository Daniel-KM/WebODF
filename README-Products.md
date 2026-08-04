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
see "README-Building.md". The commands below are run from that directory, or
with "make -C build" from the sources. Every product is written at its root,
next to "webodf/".


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

This product bundles a [HOWTO](https://github.com/kogmbh/WebODF/blob/master/programs/editor/HOWTO-wodotexteditor.md),
example files, API documentation and a subdirectory with all files belonging to
the component in one zip file.

With a prepared setup for building, you execute this command:

```sh
make product-wodotexteditor
```

It creates a file "wodotexteditor-x.y.z.zip", which can be copied and used on a
system where you want to develop using the component. Unzip it there and read
the included HOWTO.md file.

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
make product-wodocollabtexteditor
```

It creates a file "wodocollabtexteditor-x.y.z.zip", which can be copied and used
on a system where you want to develop using the component. Unzip it there and
move the subdirectory "wodo" to your deployment.

Download the latest officially released version from the [WebODF homepage](http://webodf.org/download).


### Firefox Add-on ODF Viewer

This Firefox add-on enables to view files in the OpenDocument format directly in
your Firefox browser, without installing a big office suite.

With a prepared setup for building, you execute this command:

```sh
make product-odfviewer-webext
```

This creates three files:

- "firefox-extension-odfviewer-x.y.z.xpi", of the manifest version 3, that
  Firefox reads from its version 109, of 2023;
- "firefox-extension-odfviewer-mv2-x.y.z.xpi", of the manifest version 2, that
  it reads from its version 52, of 2017, and still reads today;
- "chrome-extension-odfviewer-x.y.z.zip", for Chrome from its version 88, of
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
npx web-ext run --source-dir build/firefox-extension-odfviewer-mv2-x.y.z/
chromium --user-data-dir=$(mktemp -d) --no-first-run \
    --load-extension=build/chrome-extension-odfviewer-x.y.z/
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

Download and install the latest officially released version from [Mozilla's Add-on website](https://addons.mozilla.org/firefox/addon/webodf/). An add-on has to
be signed by Mozilla to install in a release Firefox, whoever distributes it.

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

### Products that are not built any more

Two products of "programs/cordova" are still declared, but no version of their
toolchain is available: they are kept until they are either brought up to date
or dropped.

"make product-androidviewer" packs the viewer as an apk. It drives cordova
3.5, of 2014, that builds android with ant, which google dropped in 2015 for
gradle, through the executable "android", that the sdk replaced by
"sdkmanager" in 2018. Cordova only wraps "webodf.js" in a web view, so the
part that belongs to WebODF is untouched: what has to be written again is the
packaging, on a current cordova or on capacitor.

"make product-firefoxosviewer" packs it for Firefox OS. The system was
abandoned by Mozilla in 2016, but it lives on through its forks, B2G OS, KaiOS
and Capyloon, so the product is worth reviving rather than dropping. KaiOS in
particular runs on feature phones that no office suite serves, which is the
kind of place a viewer of the OpenDocument format is the most useful.
