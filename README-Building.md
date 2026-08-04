## Two ways to build

The library "webodf.js" is built in two ways.

- **With node**, described in "Building with node" below: this is the simplest
  one and the recommended one. It needs node only, and java for the optional
  check of the types.
- **With cmake**, described first, as it was done originally: it is still the
  only way to build the other products, the editors and the extensions, listed
  in "README-Products.md", and to run the tests that need a browser.

Both produce the same library, from the same sources and in the same order.


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

### Dependencies on Ubuntu

For a Ubuntu 18.04 distribution you can satisfy the build dependencies with:

```sh
apt-get install libqt5webkit5-dev default-jdk
```

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

## Building with node

The library is also built without cmake and without java, with node only. This
is the simplest way to get "webodf.js", and it does not download anything but
the packages of npm.

```sh
npm install
npm run build
```

The result is written in "dist/webodf.js". The sources are concatenated in the
order of their dependencies, taken from the file "webodf/lib/manifest.json",
then minified with terser. The output has the same size as the one of the
closure compiler used with SIMPLE_OPTIMIZATIONS, that the original build used.

Other commands:

```sh
npm run check   # check the types with the closure compiler (java is needed)
npm test        # run the tests that do not need a browser
npm run doc     # generate the documentation of the api in "dist/docs"
```

The command "npm run check" uses the closure compiler as a type checker only:
it writes no output. The jar is downloaded once from maven central into the
directory ".tools". The version is pinned in "scripts/lib/closure.js" and the
sources pass with it as with the one of 2016, that the project used before:

```sh
CLOSURE_VERSION=v20160911 npm run check   # the previous compiler
CLOSURE_JAR=/path/to/compiler.jar npm run check   # another copy
```

The groups of checks removed from the compilers newer than 2016 are dropped
automatically, so both versions run with the same set of checks.

The tests needing a browser are still run with karma, see
"webodf/tools/karma.conf.js".

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
