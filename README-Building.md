## Two ways to build

The library "webodf.js" is built in two ways.

- **With node**, described in "Building with node" below: this is the simplest
  one and the recommended one. It needs node only, and java for the optional
  check of the types.
- **With cmake**, described first, as it was done originally: it is still the
  only way to build the other products, the editors and the extensions, listed
  in "README-Products.md". They are behind the option WEBODF_PROGRAMS, off by
  default, since they are the longest to build and need Dojo. The closure
  compiler, Rhino and Dojo are downloaded from maven central and from the
  registry of npm, at the same versions as the build with node uses.

Both produce the same file, byte for byte: the build with cmake writes the
library by running "scripts/build.js" as well. It still compiles the sources
with the closure compiler, but only to check their types, as it compiles with
SIMPLE_OPTIMIZATIONS, which neither folds the definition IS_COMPILED_CODE nor
drops what it makes unreachable: the loader of the classes and the runner of
the scripts stayed in a library that never calls them, with the eval() they
read a file with.

So "npm install" is needed for the build with cmake too, as terser minifies
the library.

Two parts of the build with cmake are opt-in, so that a plain build stays
short and needs nothing but node, java and cmake:

| Option             | What it adds                                          |
|--------------------|-------------------------------------------------------|
| WEBODF_PROGRAMS    | The editors and the extensions of "programs/"         |
| WEBODF_QTJSRUNTIME | qtjsruntime, that runs the tests in the webkit of qt  |

The apk of android is one more output of "programs/cordova", so android and
ant are only looked for along with the programs. That toolchain is out of
reach as well: it drives cordova 3.5, of 2014, that builds android with ant,
which google dropped in 2015 for gradle, through the executable "android",
that the sdk replaced by "sdkmanager" in 2018.

WEBODF_QTJSRUNTIME needs Qt5Network, Qt5Xml, Qt5PrintSupport and
Qt5WebKitWidgets, that Debian 12 and older install with:

```sh
apt-get install qtbase5-dev libqt5webkit5-dev
```

Qt WebKit was dropped from Qt in 5.6, kept alive as a separate project, and is
not packaged any more by Debian since 13, so the modules are out of reach
there. The suite it runs is the same as the one "npm run test:browser" runs,
in a browser that is still maintained, which is the reason this option is off.


## Coverage

The coverage of the tests is measured by [c8][], with node and with cmake:

```sh
npm run coverage
make coverage
```

By default it writes a table on the terminal and a report to browse in
"coverage/index.html". Another reporter is chosen by passing it through:

```sh
node scripts/coverage.js --reporter=lcov
```

c8 reads the coverage V8 records while it runs, so it neither parses nor
rewrites the sources: the version of ECMAScript the library is written in does
not matter to it. The tests run on the bundle, that is written with a source
map so that the coverage is reported on the files of "webodf/lib".

It replaces JSCoverage, that instrumented the sources for the target
"instrumented" of the original build. Its last release, 0.5.1 of 2010, bundles
SpiderMonkey 1.7, whose autoconf 2.13 probe declares "main()" without a return
type: gcc 14 and clang 16 reject it, as -Wimplicit-int is an error in C23, so
it does not build any more on a recent distribution.
[c8]: https://github.com/bcoe/c8


## Building WebODF on Linux

For creating the file "webodf.js" out of the sources CMake and Java needs to be
installed.

Another optional, but recommended requirement are the Qt5 libs, which are used
to create and run tests.

Further requirements, like the [Closure Compiler][], will be conveniently
downloaded automatically during the build, as usually the latest version will be
used, which might not yet be available as a package. So during (first) build
also a connection to the internet will be needed. Downloaded requirements will
be cached in the build directory.
[Closure Compiler]: https://developers.google.com/closure/compiler/

With the requirements installed, either download the zip file from https://github.com/kogmbh/WebODF/archive/master.zip
and unzip it:

```sh
wget https://github.com/kogmbh/WebODF/archive/master.zip
unzip master.zip
mv WebODF-master webodf
```

or get the complete repo with git:

```sh
git clone https://github.com/kogmbh/WebODF.git webodf
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

CMake keeps the paths of the programs it finds in "build/CMakeCache.txt", so a
node that is installed afterwards, with nvm for instance, is not seen: it
keeps using the one it found the first time, and reports it as too old. The
entries are dropped with:

```sh
cmake -S ../webodf -U NODEJS_EXECUTABLE -U NPM
```

### Dependencies on Debian and Ubuntu

The build needs cmake, a java runtime and node, that is installed apart, see
"Building with node" below for the version:

```sh
apt-get install cmake default-jre
```

The modules of Qt are only needed by the option WEBODF_QTJSRUNTIME, see "Two
ways to build" above.

## Building WebODF on Windows

The following steps have been tested with the Microsoft C\C++ compilers that are
installed with Visual Studio 2010. It may be possible to use MinGW but it has not been verified.

* Visual Studio 2010 (or [Visual Studio 2010 Express][] works as well)
* [Visual Studio 2010 Service Pack 1][]
* [Qt 5.2.1 x86 installer](http://download.qt-project.org/official_releases/qt/5.2/5.2.1/qt-opensource-windows-x86-msvc2010-5.2.1.exe)
  for Visual Studio 2010
* [CMake 2.8.12.2 x86](http://www.cmake.org/files/v2.8/cmake-2.8.12.2-win32-x86.exe)
* [Java Runtime 1.7](http://java.com/en/download/index.jsp) (or more recent)
* [Git for Windows][]

[Visual Studio 2010 Express]: http://www.visualstudio.com/en-us/downloads#d-2010-express
[Visual Studio 2010 Service Pack 1]: http://www.microsoft.com/en-us/download/details.aspx?id=23691
[Git for Windows]: http://msysgit.github.io/

### Visual Studio 2010

We only need the C\C++ compilers but it is easier to get this by installing
Visual Studio 2010. It can also be obtained from the Windows 7 SDK but I would
recommend the above. To avoid issues with CMake, [Visual Studio 2010 Service Pack 1][]
also needs to be downloaded and installed.

### Git for Windows

[Git][Git for Windows] itself isn't strictly necessary, but some Unix programs
like cat are used during the build. As you will generally need git to download
the source, this is easiest way to get the msys utilities.

### Setup PATH variable

Add the following directories to the PATH variable

* CMake path e.g `C:\Program Files (x86)\CMake 2.8\bin`
* QMake path e.g `C:\QtSDK\bin`
* Unix tools path e.g `C:\Program Files (x86)\Git\bin` (Git installer will add
  this automatically if you select the add Unix tools to PATH option during
  install)

### Building webodf.js
These commands should be entered from the Visual Studio 2010 command prompt so
that msbuild will be added to the PATH

```sh
git clone https://github.com/kogmbh/WebODF.git webodf
md build
cd build
cmake -G "Visual Studio 10" ..\webodf
msbuild WebODF.sln
```

## Building WebODF on OSX 10.7.5 (Lion) or OSX 10.9.5 (Mavericks)

Qt5 can be installed via homebrew, but will not be linked by default. CMake must
be instructed where to find this package by specifying the Qt5 location in
CMAKE_PATH_PREFIX environment variable:

```sh
cmake -DCMAKE_PREFIX_PATH=/usr/local/Cellar/qt5/5.4.1 ../webodf
```

If the build process returns an error `(libuv) Failed to create kqueue (24)`,
this can be resolved by increasing the limit on the number of open file
descriptors:

```sh
ulimit -n 8192
```

## Javascript dependencies

Unlike most node projects, the runtime dependency "@xmldom/xmldom" (about
400 kB) is versioned inside the directory "node_modules", and it has been so
since 2012 (commit "include node_modules directory with xmldom"), so that
WebODF can be run from a simple checkout, without npm and without network
access. The tools of the build (terser, jsdoc) are not versioned: they are
installed with "npm install" and the file ".gitignore" keeps only "@xmldom".

This dependency is used by the file "webodf/lib/runtime.js", that needs a
DOMParser when WebODF runs inside node, for example for the command line tools.
A browser uses its own native parser, so this dependency is never included in
the compiled file "webodf.js".

As a consequence, an update of a dependency must commit the versioned copy
along with the file "package.json":

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
yet, for two reasons only: its api is asynchronous, so the three calls of
Zip.js would go through the promises it ships with, and it weighs 17 kB more
once minified, since it added a layer of streams. Both versions run on the
same browsers, IE 6 included.

## Building with node

The library is also built without cmake and without java, with node only. This
is the simplest way to get "webodf.js", and it does not download anything but
the packages of npm.

Node 22.22.2 or later is needed, both here and for the build with cmake: 22 is
the oldest release that is still maintained, and jsdom, that the tests use,
runs on none of its earlier ones. The exact range is in the field "engines" of
"package.json"; the tools are tested with node 24, the release under long term
support. Node is expected to be installed, on every platform, npm along with
it: it used to be downloaded on Windows, but only the binary of node, without
the npm the build needs.

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
still generated by "webodf/tools/updateJS.js" during a build with cmake, but
the command "npm run test:browser" replaces it and needs no extra package.

### Running with Rhino

Rhino runs javascript on a java virtual machine and gives a second engine for
the tests, besides node. The jar of Rhino is downloaded from maven central into
".tools", like the one of the closure compiler, and the version is set in
"scripts/lib/rhino.js" or with the environment variable RHINO_VERSION.

The file "tests.js" selects the suites from what the runtime provides, so each
engine runs what it can:

| Engine           | Suites | What it provides                         |
|------------------|--------|------------------------------------------|
| a browser        | 35     | everything, with a layout and its css    |
| node, with jsdom | 26     | a dom with a range and a tree walker     |
| node, alone      | 3      | the package xmldom, without a range      |
| Rhino            | 3      | the dom of java, lists without an index  |

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

Both libraries hold the same code: the sources concatenated in the order of
their dependencies, with IS_COMPILED_CODE set to true so that the runtime does
not load the classes one by one. The one built with node is about eight percent
smaller, since terser compresses more than the closure compiler used with
SIMPLE_OPTIMIZATIONS.

### What the closure compiler is used for

The library is not compiled with it any more, only checked. It is worth keeping,
because the sources are annotated with types in their jsdoc and the check is
strict: every expression must have a known type. It helps to find real issues,
and nine were found when merging repositories, among them a null document, a
variable used for two different types and a type of record missing a member that
the code used.
