## Two ways to build

The library "webodf.js" is built in two ways.

- **With cmake**, described first, as it was done originally: it builds the
  library and it is the only way to build everything else, the viewers, the
  add-ons, the editors and the tools, listed in "README-Products.md". The
  products of "programs/" are behind the option WEBODF_PROGRAMS, off by
  default, since they are the longest to build and need Dojo. The closure
  compiler, Rhino and Dojo are downloaded from maven central and from the
  registry of npm, at the same versions as the build with node uses.
- **With node**, described in "Building with node" below: the shortest way to
  the library alone, and to nothing else. It needs node only, and java for the
  optional check of the types.

Both produce the same file, byte for byte: the build with cmake writes the
library by running "scripts/build.js" as well. It still compiles the sources
with the closure compiler, but only to check their types, as it compiles with
SIMPLE_OPTIMIZATIONS, which neither folds the definition IS_COMPILED_CODE nor
drops what it makes unreachable: the loader of the classes and the runner of the
scripts stayed in a library that never calls them, with the eval() they read a
file with.

So "npm install" is needed for the build with cmake too, as terser minifies the
library.

Some parts of the build with cmake are opt-in, so that a plain build stays short
and needs nothing but node and cmake:

| Option             | What it adds                                            |
|--------------------|---------------------------------------------------------|
| WEBODF_PROGRAMS    | The editors and the extensions of "programs/"           |
| WEBODF_QTJSRUNTIME | qtjsruntime, that runs the tests in the webengine of qt |
| WEBODF_DESKTOP     | The viewer of OpenDocument for the desktop, in qt       |
| WEBODF_ANDROID     | The viewer of OpenDocument for android, with its sdk    |
| WEBODF_IOS         | The viewer of OpenDocument for iOS, on macOS alone      |

Four more settings say how the build is run rather than what it holds:

| Setting                 | What it says                                                                  |
|-------------------------|-------------------------------------------------------------------------------|
| WEBODF_PACKAGE_FLATPAK  | OFF leaves the flatpak out of "products", the rest being packed still         |
| WEBODF_PREBUILT_LIBRARY | A "webodf.js" built elsewhere is taken as it stands, so node is not run       |
| WEBODF_TESTS_ON_SCREEN  | The window of qtjsruntime is shown while the tests run, hidden otherwise      |
| WEBODF_DOWNLOAD_DIR     | An environment variable: the directory the downloads are kept in              |

WEBODF_PREBUILT_LIBRARY is what a sandbox is built with, where neither node nor
the network is at hand: the flatpak of the viewer builds the C++ alone against
the library the build outside made, see "Products".

WEBODF_QTJSRUNTIME and WEBODF_DESKTOP need Qt 6.4 or later, with the modules
Core, Gui, Widgets, PrintSupport, WebChannel, WebEngineCore and
WebEngineWidgets, that Debian 12 and later install with:

```sh
apt-get install qt6-base-dev qt6-base-dev-tools qt6-webchannel-dev qt6-webengine-dev qt6-webengine-dev-tools
```

Two libraries the modules of qt look for are packaged apart, and cmake reports
them as "Could NOT find XKB" and "Could NOT find Cups" when they are absent.
Neither stops the build: xkbcommon is the keyboard of the platform, and cups is
the printing of the system, that the export to pdf does not go through, as it
is drawn by the webengine itself.

```sh
apt-get install libxkbcommon-dev libxkbcommon-x11-dev libcups2-dev
```

qtjsruntime ran in Qt WebKit until 2026, that Qt dropped in 5.6, in 2016, and
that Debian stopped packaging in Debian 13: the program was rewritten for
webengine, which is the blink of chromium. Its option stays off because the
modules of qt weigh more than the rest of the build together, and because "npm run test:browser"
runs the same suite in a browser that is installed anyway.

On a machine without a screen, a build server for instance, the platform without
one is used:

```sh
QT_QPA_PLATFORM=offscreen make -C build test-qtjsruntime
```

It runs the whole suite of the browser, 35 files of tests where the run with
node runs 3: the others need a dom, a layout and computed styles, which is what
this program is kept for.

WEBODF_DESKTOP builds the viewer for the desktop, which is a window of qt around
the page the library draws in, see "README-Products.md". It is built by that
option alone, without WEBODF_PROGRAMS, as it needs neither Dojo nor the
editors.


## The builds that answer by themselves

Two workflows of GitHub Actions are in ".github/workflows":

* "library.yml" builds the library with node and runs what that build runs: the
  types of the library and of the tests, the tests in node and the same ones in
  rhino. It is the short one, and it answers on every push.
* "desktop.yml" builds the viewer of the desktop on linux, on windows and on
  macos, and runs every suite of tests on each of them, in the webengine of qt
  among the others. What it installs is gathered as an artifact, so a viewer
  that no one here can build is downloaded and tried.

The second is what tells whether the branches "if (WIN32)" and "if (APPLE)" of
the build hold: they run nowhere else. Qt is installed by [install-qt-action](https://github.com/jurplel/install-qt-action),
that takes it from the repository of Qt with the module of WebEngine, and
windows is given the compiler of microsoft, that WebEngine needs.

The history is fetched whole, as the version of the build comes from "git describe",
and a shallow checkout gives it nothing to describe.


## Coverage

The coverage of the tests is measured by [c8][], with node and with cmake:

```sh
npm run coverage
make coverage
```

By default it writes a table on the terminal and a report to browse in "coverage/index.html".
Another reporter is chosen by passing it through:

```sh
node scripts/coverage.js --reporter=lcov
```

c8 reads the coverage V8 records while it runs, so it neither parses nor
rewrites the sources: the version of ECMAScript the library is written in does
not matter to it. The tests run on the bundle, that is written with a source map
so that the coverage is reported on the files of "webodf/lib".

It replaces JSCoverage, that instrumented the sources for the target
"instrumented" of the original build. Its last release, 0.5.1 of 2010, bundles
SpiderMonkey 1.7, whose autoconf 2.13 probe declares "main()" without a return
type: gcc 14 and clang 16 reject it, as -Wimplicit-int is an error in C23, so it
does not build any more on a recent distribution.

[c8]: https://github.com/bcoe/c8


## Building WebODF on Linux

For creating the file "webodf.js" out of the sources cmake and node need to be
installed. Java is looked for and not required: it runs the checks of the types
and the tests in rhino, and a machine without it builds everything else.

Another optional, but recommended requirement are the Qt 6 libs, which are used
to run the tests in the webengine of qt.

Further requirements, like the [Closure Compiler][], will be conveniently
downloaded automatically during the build, as usually the latest version will be
used, which might not yet be available as a package. So during (first) build
also a connection to the internet will be needed. Downloaded requirements will
be cached in the build directory.

[Closure Compiler]: https://developers.google.com/closure/compiler/

With the requirements installed, either download the zip file from https://github.com/webodf/WebODF/archive/master.zip
and unzip it:

```sh
wget https://github.com/webodf/WebODF/archive/master.zip
unzip master.zip
mv WebODF-master webodf
```

or get the complete repo with git:

```sh
git clone https://github.com/webodf/WebODF.git webodf
```

For building now in the same directory where either of above commands were done
the following commands should be entered:

```sh
mkdir build
cd build
cmake -S ../webodf
make webodf.js-target
```

A successful run will yield the file "webodf.js" in the subfolder "build/webodf/",
among other things, from where you can then copy it and use for your website.

CMake writes the files of another builder when it is asked to, and ninja builds
the same thing in less time, as it starts every step it can at once where make
walks the directories:

```sh
cmake -S ../webodf -G Ninja
ninja webodf.js-target
```

The package is "ninja-build" on Debian and Ubuntu, and the command it installs
is "ninja".

Only the wait changes: the file that comes out is the same, byte for byte. A
directory is bound to the builder it was configured with, so a build that was
made with make is configured again in a directory of its own, or with
"--fresh".

CMake keeps the paths of the programs it finds in "build/CMakeCache.txt", so a
node that is installed afterwards, with nvm for instance, is not seen: it keeps
using the one it found the first time, and reports it as too old. The entries
are dropped with:

```sh
cmake -S ../webodf -U NODEJS_EXECUTABLE -U NPM
```

### Dependencies on Debian and Ubuntu

The build needs cmake and node, that is installed apart, see "Building with
node" below for the version, and it takes a java runtime for the checks where
one is installed:

```sh
apt-get install cmake default-jre
```

The generator Ninja is another package, and it is optional: it is asked for by
"-G Ninja" and it builds in less time than make, see above.

```sh
apt-get install ninja-build
```

The modules of Qt are only needed by the option WEBODF_QTJSRUNTIME, see "Two ways to build"
above.

The ways the viewer of the desktop is handed over each ask for a tool of their
own, see "README-Products.md". None of them is needed to build the viewer: the
target "products" makes what the tools of the machine allow, and says at the
end which tool is missing for the rest.

```sh
apt-get install dpkg-dev rpm flatpak flatpak-builder libfuse2t64
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.kde.Platform//6.9 org.kde.Sdk//6.9 \
    io.qt.qtwebengine.BaseApp//6.9
```

| Target | The tool it asks for | Where it comes from |
|-------------------|---------------------------|--------------------------------|
| package-archive   | none, cmake writes it     | |
| package-deb       | dpkg-deb, dpkg-shlibdeps  | "dpkg" and "dpkg-dev" |
| package-rpm       | rpmbuild                  | "rpm" |
| package-appimage  | linuxdeploy, its plugin of qt, appimagetool | not packaged by Debian, see below |
| package-flatpak   | flatpak-builder, and the runtime of KDE | "flatpak-builder", and Flathub |

The runtime and the base app are installed for the user and not for the
system: a build dir is written by the user who builds, and taking a package
that root installed apart into it asks to change the owner of files, which the
kernel refuses ("error: fchownat: Operation not permitted"). An installation
of the user keeps the owner in the attributes of the files and changes
nothing. Each installation carries its own remotes, hence the first line.

The flatpak asks for three things and not one: the tool that builds it, the
runtime of KDE it is built against, which weighs some two gigabytes, and the
base app of qt, which carries the webengine the viewer is drawn in and that
the runtime of KDE does not carry. The two last are installed from Flathub,
the third line above. Both are looked for when cmake
is run, and what is missing is named among the products that could not be made:

```
This machine has no tool to make:
  the flatpak, for want of io.qt.qtwebengine.BaseApp//6.9
```

A branch of that runtime is declared end of life as soon as a newer one is
out, so no version is written in the manifest: the newest branch of
"org.kde.Sdk" the machine has is taken, and the manifest is written with it.
Install a newer one and run cmake again, and the flatpak follows. A build that
wants one branch and not another names it:

```sh
cmake -S . -B build -DWEBODF_FLATPAK_RUNTIME=6.9
```

A machine that will not build a flatpak at all leaves it out, and "products"
makes everything else without naming it as missing:

```sh
cmake -S . -B build -DWEBODF_PACKAGE_FLATPAK=OFF
```

The branch of the runtime is the version of qt it carries, and the viewer is
built with qt 6.4 or newer, so branches older than that are left aside: a
machine that kept only one of them is told that it has no runtime to build
against, and a branch named by hand that is older stops the configuration at
once rather than the build later.

A tool that is installed afterwards is only seen when cmake is run again, as
what was found is kept in the cache of the build, see "Building everything
again without downloading it again" below.

The tools of the AppImage are AppImages themselves, packaged by no
distribution: they are taken from the releases of their projects, made
runnable and put in the path under the names "linuxdeploy",
"linuxdeploy-plugin-qt" and "appimagetool", which are the names cmake looks
for.

```sh
mkdir -p ~/.local/bin
cd ~/.local/bin
wget -O linuxdeploy https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage
wget -O linuxdeploy-plugin-qt https://github.com/linuxdeploy/linuxdeploy-plugin-qt/releases/download/continuous/linuxdeploy-plugin-qt-x86_64.AppImage
wget -O appimagetool https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x linuxdeploy linuxdeploy-plugin-qt appimagetool
```

An AppImage is run by fuse, which "libfuse2t64" carries, or with
"--appimage-extract-and-run" where fuse is not allowed. Once they are in the
path, cmake is run again for them to be found, as it keeps what it found
before:

```sh
cmake -S . -B build -U LINUXDEPLOY -U LINUXDEPLOY_QT -U APPIMAGETOOL
ninja -C build products
```

Nothing of this builds the viewer for windows or for macos from a machine of
linux: those systems build it themselves, which is what the runner of the
build is for, see ".github/workflows/desktop.yml".


## Building WebODF on Windows

The library alone needs node and cmake, java for the checks, and nothing of the
compiler: it is javascript. The compiler is needed by the two products of qt, qtjsruntime and
the viewer of the desktop, and it has to be the one of Microsoft, as Qt
WebEngine does not compile with MinGW.

* [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/), the
  Build Tools alone are enough, with the workload "Desktop development with C++"
* [The installer of Qt 6](https://www.qt.io/download-qt-installer), version 6.8
  or later, architecture "MSVC 2022 64-bit", with the modules WebEngine and
  WebChannel, for the options WEBODF_QTJSRUNTIME and WEBODF_DESKTOP only. Since
  6.8 WebEngine is an extension, in a repository of its own
* [CMake](https://cmake.org/download/)
* [A java runtime](https://www.java.com/en/download/), 17 or later, that runs
  the closure compiler and rhino
* [Node](https://nodejs.org/), 20 or later
* [Git for Windows](https://gitforwindows.org/), which also brings the unix
  tools the build calls, "cat" among them

Everything of that list is installed at once by the script
"programs/opendocumentviewer-desktop/data/setup-windows.ps1", that a machine of
its own is set up with, see "README-Products.md". It is what the build of
windows is tested with, as no one of this project owns such a machine.

Only x86_64 and ARM64 are built: Qt 6 dropped the 32 bits.

### Building webodf.js

The commands are entered in the "x64 Native Tools Command Prompt for VS 2022",
that puts the compiler in the path:

```sh
git clone https://github.com/webodf/WebODF.git webodf
md build
cd build
cmake -G Ninja -DCMAKE_BUILD_TYPE=Release ..\webodf
cmake --build .
```

The generator "Visual Studio 17 2022" builds as well, and it is slower.


## Building WebODF on macOS

Qt 6 is installed by homebrew, "brew install qt", or by the installer of qt,
and homebrew does not link it by default. CMake is told where it is by the
variable CMAKE_PREFIX_PATH:

```sh
cmake -DCMAKE_PREFIX_PATH=$(brew --prefix qt) ../webodf
```

If the build process returns an error `(libuv) Failed to create kqueue (24)`,
this can be resolved by increasing the limit on the number of open file
descriptors:

```sh
ulimit -n 8192
```

The viewer of the desktop is packed as a bundle, signed and notarised, which is
another matter, see "README-Products.md".

## Javascript dependencies

Unlike most node projects, the runtime dependency "@xmldom/xmldom" (about 400 kB)
is versioned inside the directory "node_modules", and it has been so since 2012
(commit "include node_modules directory with xmldom"), so that WebODF can be run
from a simple checkout, without npm and without network access. The tools of the
build (terser, jsdoc) are not versioned: they are installed with "npm install"
and the file ".gitignore" keeps only "@xmldom".

This dependency is used by the file "webodf/lib/runtime.js", that needs a
DOMParser when WebODF runs inside node, for example for the command line tools.
A browser uses its own native parser, so this dependency is never included in
the compiled file "webodf.js".

As a consequence, an update of a dependency must commit the versioned copy along
with the file "package.json":

```sh
npm install
git add package.json package-lock.json node_modules
```

Without it, a fresh checkout keeps running the previous version, whatever the
file "package.json" says.

JSZip is versioned too, but differently: the file "webodf/lib/externs/JSZip.js"
holds its distribution, that is concatenated into "webodf.js", as a browser
needs it to read and write the zip an ODF document is. It is updated by hand,
from the file "dist/jszip.js" of the package, whose wrapper is replaced by the
one the previous copy carries: the class is attached to the shared object
"externs" rather than to the global scope, and the modules of its bundle are
hidden from the commonjs of node, that would otherwise capture the export. The
call to new Buffer() of its module "nodeBuffer" is patched as well, as node
deprecated it.

The version in use is JSZip 2.6.1, the last of its line. JSZip 3 is not used
yet, for two reasons only: its api is asynchronous, so the three calls of Zip.js
would go through the promises it ships with, and it weighs 17 kB more once
minified, since it added a layer of streams. Both versions run on the same
browsers, IE 6 included.

## Building with node

The library is also built without cmake and without java, with node only. It is
the shortest way to "webodf.js", and it does not download anything but the
packages of npm. It builds the library and nothing else: every other product
is built by cmake, see "README-Products.md".

Node 22.22.2 or later is needed, both here and for the build with cmake: 22 is
the oldest release that is still maintained, and jsdom, that the tests use, runs
on none of its earlier ones. The exact range is in the field "engines" of
"package.json"; the tools are tested with node 24, the release under long term
support. Node is expected to be installed, on every platform, npm along with it:
it used to be downloaded on Windows, but only the binary of node, without the
npm the build needs.

```sh
npm install
npm run build
```

The result is written in "dist/webodf.js". The sources are concatenated in the
order of their dependencies, taken from the file "webodf/lib/manifest.json",
then minified with terser. The output has the same size as the one of the
closure compiler used with SIMPLE_OPTIMIZATIONS, that the original build used.

Each command builds one output, so only what is needed is built:

```sh
npm run build       # the library, in "dist/webodf.js"
npm run doc         # the documentation of the api, in "dist/docs"
npm run check       # check the types with the closure compiler (java is needed)
npm run check:tests # check the types of the library and of the tests
npm test            # run the tests with node
npm run test:rhino  # run the tests with Rhino, on a java virtual machine
npm run test:browser  # run the tests in a browser, with all the suites
npm run test:extension # run the add-on of Chrome and check it shows a document
npm run all         # check, test, build and doc
```

The command "npm run check" uses the closure compiler as a type checker only:
it writes no output. The jar is downloaded once from maven central into the
directory ".tools" and the version is pinned in "scripts/lib/closure.js".

"npm run check:tests" checks the tests as well, as the target "compiled.js" of
the build with cmake does, so that both builds report the same errors. The
library alone is fully typed, the tests are not: they declare mocks that are
partial on purpose, so reportUnknownTypes is off for them.

It ends with a second pass over the libraries packaged with "webodf.js", JSZip
for now, that only reads their jsdoc, as the target "simplecompiled.js" of the
build with cmake does. Their types are not checked, since they are not written
for the compiler, but an annotation it cannot parse stops the build, so the
check with node has to see it too.

```sh
CLOSURE_VERSION=v20240101 npm run check           # another version
CLOSURE_JAR=/path/to/compiler.jar npm run check   # another copy
```

The groups of checks removed from the compilers newer than 2016 are dropped
automatically when an older one is used. The compiler of 2016, that the project
used until now, does not check the sources any more: they use globalThis, that
it does not know.

The configuration for karma, in "webodf/tools/karma.conf.js", is kept and is
still generated by "webodf/tools/updateJS.js" during a build with cmake, but the
command "npm run test:browser" replaces it and needs no extra package.

### Running with Rhino

Rhino runs javascript on a java virtual machine and gives a second engine for
the tests, besides node. The jar of Rhino is downloaded from maven central into
".tools", like the one of the closure compiler, and the version is set in
"scripts/lib/rhino.js" or with the environment variable RHINO_VERSION.

The file "tests.js" selects the suites from what the runtime provides, so each
engine runs what it can:

| Engine           | Suites | What it provides                        |
|------------------|--------|-----------------------------------------|
| a browser        | 35     | everything, with a layout and its css   |
| node, with jsdom | 26     | a dom with a range and a tree walker    |
| node, alone      | 3      | the package xmldom, without a range     |
| Rhino            | 3      | the dom of java, lists without an index |

The tests with node use jsdom when it is installed, which is the case after
"npm install": it is a development dependency, the library itself does not use
it. Three suites are added only in a browser: two measure where the text is
drawn, that needs a layout engine, and one compares the rules of a stylesheet
one by one, that needs a css parser rejecting the same rules.

The runtime for Rhino could not even start between 2013 and now, so its own
tests had never been run.

### Running the tests in a browser

The command "npm run test:browser" serves the tests over http, since a page
loaded from a file cannot read them, then opens them in a chromium found on the
system. The browser is not downloaded: set WEBODF_BROWSER to its path, or
install one with "npx playwright install chromium".

Two tests fail today, and they are not a defect of the browser:

- RuntimeTests.testRead reads the raw bytes of a file that starts with a byte
  order mark. The runtime asks for them with the trick of the mime type
  "charset=x-user-defined", but a recent chromium decodes the answer as utf-8
  and removes the mark first. Reading the answer as an array buffer, as it is
  done since a long time, would fix it.
- MaliciousDocumentTests.loadInjectionDocument reads a document the same way.

### Outputs

| Path                              | Built by | Content                                |
|-----------------------------------|----------|----------------------------------------|
| `dist/webodf.js`                  | node     | the library, minified                  |
| `dist/docs/`                      | node     | documentation of the api               |
| `build/webodf/webodf.js`          | cmake    | the library, minified                  |
| `build/webodf/webodf-debug.js`    | cmake    | the library, readable                  |
| `build/webodf/webodf-compiled.js` | cmake    | the library without its license header |
| `build/webodf/simplecompiled.js`  | cmake    | the library and its tests, run by node |
| `build/webodf/webodf.css.js`      | cmake    | the css of the viewer, as a string     |
| `build/webodf/webodfversion.js`   | cmake    | the version, from `git describe`       |

The build with node writes in "dist" and needs no other directory: the version
and the css are generated in memory, not in files. The build with cmake writes
in the directory given to cmake, usually "build", next to the sources, and
keeps its downloads there.

Both libraries are the same file, byte for byte: the sources concatenated in the
order of their dependencies, with IS_COMPILED_CODE set to true so that the
runtime does not load the classes one by one, minified by terser. The build
with cmake runs "scripts/build.js" as well, see "Two ways to build" above.

### Building everything again without downloading it again

The build directory holds two kinds of files: what was made here, and what was
fetched from elsewhere. Only the first has to go.

```sh
ninja -C build -t clean   # every file a rule wrote, nothing else
ninja -C build products
```

"ninja -t clean" leaves the archives of "build/downloads", some 210 MB, and it
leaves the directories the external projects were unpacked into,
"build/*-prefix". Nothing is asked of the network again.

When even the cmake cache is to go, keep the downloads elsewhere so that they
outlive the directory:

```sh
export WEBODF_DOWNLOAD_DIR=$HOME/.cache/webodf-downloads
mkdir -p "$WEBODF_DOWNLOAD_DIR"
mv build/downloads/* "$WEBODF_DOWNLOAD_DIR"/
rm -rf build
cmake -S . -B build -G Ninja
ninja -C build products
```

The variable is read at configure time and printed back: "external downloads
will be stored/expected in: ...". The external projects are unpacked again,
which costs no network, only some minutes.

A build directory cannot be shared between two machines, nor between a container
and its host. Cmake writes into its cache the path of every tool it found —
cmake itself, node, npm, java, the Android SDK — and those paths are read again
without being checked. A cache made in a container names tools the host does not
have, and the build fails with "cmake: not found", an empty version of node or
an SDK that is not there. Give each machine a build directory of its own, and
share only "$WEBODF_DOWNLOAD_DIR".

To make cmake look for the tools again without losing the rest of the cache,
unset the variables that hold them and configure again, from outside the source
directory:

```sh
cmake -S . -B build -U NODEJS_EXECUTABLE -U NPM -U DPKG_DEB -U RPMBUILD
```

### Running the add-ons without installing them

The three packages of "programs/opendocumentviewer-webext", see "README-Products.md", are
loaded from their directory, with a profile of their own, so that nothing has to
be clicked and nothing is kept:

```sh
npx web-ext run --source-dir build/opendocumentviewer-firefox-mv2-x.y.z/
chromium --user-data-dir=$(mktemp -d) --no-first-run \
    --load-extension=build/opendocumentviewer-chrome-x.y.z/
```

web-ext writes a temporary profile, installs the add-on in it and follows the
changes of the files; "--firefox" chooses the binary and "--url" opens a page at
once. Open the page after the add-on is installed, not with it:
a page that is asked for while Firefox is still starting is not redirected, and
the add-on looks broken when it is not. Firefox refuses an unsigned xpi, but not
a directory loaded this way, which is what "about:debugging" does by hand.

Chrome keeps the profile of "--user-data-dir", hence the temporary directory,
and "--load-extension" only takes a directory, never a zip.

"npm run test:extension" does all of it for Chrome: it builds the package,
serves a document under a type that says nothing, asks the browser for it and
checks that the viewer of the add-on drew it. It needs a chromium, like
"npm run test:browser", and the library of "dist".

It is worth running: a rule Chrome refuses is dropped without a word, and the
documents are downloaded as if the add-on were not installed. Neither the linter
of addons.mozilla.org nor the closure compiler sees it. Firefox is not driven,
as web-ext is not a dependency of this project.

### What the closure compiler is used for

The library is not compiled with it any more, only checked. It is worth keeping,
because the sources are annotated with types in their jsdoc and the check is
strict: every expression must have a known type. It helps to find real issues,
and nine were found when merging repositories, among them a null document, a
variable used for two different types and a type of record missing a member that
the code used.

## Measuring

The benchmark measures the library on a document of a hundred pages, and
writes the times of some twenty actions:

```sh
make -C build benchmark-html
xdg-open build/programs/benchmark/index.html
```

The whole of it is another target, that measures the four documents, of one,
ten, a hundred and a thousand pages, and writes every action of every document
in one table, of an action to a line and a document to a column, which is read
across:

```sh
make -C build benchmark-html-all
xdg-open build/programs/benchmark/all.html
```

Both are a matter of minutes: the last action, that selects the whole document
and removes it, takes half a minute on a hundred pages and far more on a
thousand, as one operation is made for each paragraph of the selection and the
document holds eleven thousand of them. It is left out by a parameter when the
wait is too long:

```
index.html?includeSlow=false
```

The two are the same page with other parameters, that are given by hand as
well:

```
index.html?fileUrl=1page.odt,10pages.odt&layout=matrix
```

and a single document, or a document of your own, by:

```
index.html?fileUrl=1000pages.odt
index.html?fileUrl=/path/to/document.odt&includeSlow=false
```

The two last columns of the table of one document, "km/h" and "pages/h", are
the distance the cursor travelled over the time it took: they are read as a
rate, and they are a joke of the authors of the benchmark rather than a
measure of the library. The table of every document holds the times alone.
