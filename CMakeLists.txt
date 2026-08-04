# This makefile 'compiles' WebODF using various tools, instruments the code and
# builds and packages programs that use WebODF.

# The project needs cmake 3.10 and works with the policies of cmake 3.24. The
# most useful of them is CMP0135: the archives of the tools are downloaded
# from an url, so the timestamps of the files they hold have to be the ones of
# the extraction, otherwise a change of the url does not rebuild what depends
# on them. Older versions of cmake read the range as its first version only.
cmake_minimum_required(VERSION 3.10...3.24)
message("CMake version: ${CMAKE_VERSION}")

# WebODF is mostly a JavaScript project. CMake needs to know about the C++ parts
project(WebODF C CXX)

# Require separate build dir
if (CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
  message(FATAL_ERROR "Compiling in the source directory is not supported.")
endif (CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)

# Tools must be obtained to work with:
include (ExternalProject)

include(ProcessorCount OPTIONAL RESULT_VARIABLE ProcessorCountFound)
if (ProcessorCountFound)
  ProcessorCount(NProcessors)
else (ProcessorCountFound)
  set(NProcessors 1)
endif (ProcessorCountFound)

# At this point, the version number that is used throughout is defined
# The version number is gotten from either the git repository or the name of the
# folder. If the current folder has a name that matches "webodf-\d+.\d+.\d+"
# then that version number is used. If not, the folder should be a git folder
# and have ability to get a tag.
# The third option is to accept the version as cmake-parameter from the
# outside, which overwrites the other two alternatives.

SET(OVERRULED_WEBODF_VERSION "" CACHE STRING "WebODF Version to overrule what WebODF would calclulate")
if (OVERRULED_WEBODF_VERSION)
  set(WEBODF_VERSION ${OVERRULED_WEBODF_VERSION})
else (OVERRULED_WEBODF_VERSION)
  string(REGEX MATCH "^.*/[Ww]eb[Oo][Dd][Ff]-([0-9]+.[0-9]+.[0-9]+)$" WEBODF_VERSION "${CMAKE_CURRENT_SOURCE_DIR}")
  if (CMAKE_MATCH_1)
    set(WEBODF_VERSION ${CMAKE_MATCH_1})
  else (CMAKE_MATCH_1)
    # get version number from git
    execute_process(COMMAND git describe --tags --dirty --match "v[0-9]*"
      WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
      OUTPUT_VARIABLE GIT_WEBODF_VERSION
      OUTPUT_STRIP_TRAILING_WHITESPACE)
    # check version number from git
    string(REGEX MATCH "^v([0-9]+.[0-9]+.[0-9]+((-[0-9]+-[0-9a-z]+)?(-dirty)?)?)$" CHECKED_WEBODF_VERSION "${GIT_WEBODF_VERSION}")
    if (CMAKE_MATCH_1)
      set(WEBODF_VERSION ${CMAKE_MATCH_1})
    else (CMAKE_MATCH_1)
      message(FATAL_ERROR "No valid version number found via git: ${GIT_WEBODF_VERSION}")
    endif (CMAKE_MATCH_1)
  endif (CMAKE_MATCH_1)
endif (OVERRULED_WEBODF_VERSION)
message(STATUS "WebODF version " ${WEBODF_VERSION})


#########################################################
## Find installed dependencies
#########################################################

# qtjsruntime runs the tests in the webkit of qt, see "webodf/tests". It is
# opt-in: Qt WebKit was dropped from Qt in 5.6 and is not packaged any more by
# Debian since 13, and "npm run test:browser" runs the same tests in a browser
# that is still maintained. Without the option, the modules are not looked for
# at all, so no warning is reported for something that is not asked for.
option(WEBODF_QTJSRUNTIME "Build qtjsruntime, that runs the tests in the webkit of qt" OFF)

set(BUILD_QTJSRUNTIME FALSE)
if (WEBODF_QTJSRUNTIME)
  set(QT_MIN_VERSION "5.1.1")
  find_package(Qt5Network)
  find_package(Qt5Xml)
  find_package(Qt5PrintSupport)
  find_package(Qt5WebKitWidgets)

  if (Qt5Network_FOUND AND Qt5Xml_FOUND AND Qt5PrintSupport_FOUND AND Qt5WebKitWidgets_FOUND)
    set(BUILD_QTJSRUNTIME TRUE)
  else ()
    message(FATAL_ERROR "Qt5 with modules Qt5Network Qt5Xml Qt5PrintSupport Qt5WebKitWidgets was not found, so qtjsruntime cannot be built. On Debian 12 and older: apt-get install qtbase5-dev libqt5webkit5-dev")
  endif ()
endif ()

# java runtime is needed for Closure Compiler
find_package(Java COMPONENTS Runtime REQUIRED)

# Node.js will be downloaded on Windows systems, so check for installed version is below
# 22.22.2 is the oldest release of node jsdom runs on, that the tests need.
# The tools of the build are tested with 24, the release under long term
# support. The exact range is in the field "engines" of "package.json", that
# cmake cannot express.
SET(REQUIRED_NODEJS_VERSION 22.22.2)


#########################################################
## Download stuff that is not commonly installed/packaged
#########################################################

# allow specification of a directory with pre-downloaded
# requirements by evaluating environment variable
# $WEBODF_DOWNLOAD_DIR
# defaults to "./downloads" in the build directory.
if ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
    SET ( EXTERNALS_DOWNLOAD_DIR $ENV{WEBODF_DOWNLOAD_DIR} )
else ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
    SET ( EXTERNALS_DOWNLOAD_DIR ${CMAKE_BINARY_DIR}/downloads )
endif ( IS_DIRECTORY $ENV{WEBODF_DOWNLOAD_DIR} )
MESSAGE ( STATUS "external downloads will be stored/expected in: ${EXTERNALS_DOWNLOAD_DIR}" )

# Closure Compiler
ExternalProject_Add(
    ClosureCompiler
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://repo1.maven.org/maven2/com/google/javascript/closure-compiler/v20260804/closure-compiler-v20260804.jar"
    DOWNLOAD_NO_EXTRACT TRUE
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
# Same version as the build with node, see scripts/lib/closure.js.
set(CLOSURE_JAR ${EXTERNALS_DOWNLOAD_DIR}/closure-compiler-v20260804.jar)

# Rhino
ExternalProject_Add(
    Rhino
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://repo1.maven.org/maven2/org/mozilla/rhino-all/1.9.1/rhino-all-1.9.1.jar"
    DOWNLOAD_NO_EXTRACT TRUE
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
# Same version as the build with node, see scripts/lib/rhino.js.
set(RHINO ${EXTERNALS_DOWNLOAD_DIR}/rhino-all-1.9.1.jar)

# JSDoc
ExternalProject_Add(
    JsDoc
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://storage.googleapis.com/google-code-archive-downloads/v2/code.google.com/jsdoc-toolkit/jsdoc_toolkit-2.4.0.zip"
    URL_MD5 a8f78f5ecd24b54501147b2af341a231
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
set(JSDOCDIR ${CMAKE_BINARY_DIR}/JsDoc-prefix/src/JsDoc/jsdoc-toolkit)

# Node.js is expected to be installed, on every platform. Windows used to
# download a single node.exe, but the build needs npm as well, that comes with
# the installer only, and the url that binary was at holds the releases of
# 2013 alone.
SET(NODEJS_VERSION 0.0.0)
# Debian uses nodejs as binary name, due to conflict with node package (Amateur Packet Radio Node Program)
# https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
FIND_PROGRAM(NODEJS_EXECUTABLE
    NAMES nodejs node
    PATHS ""
    DOC "Path to Node.js executable"
)
IF(NODEJS_EXECUTABLE)
    execute_process(COMMAND ${NODEJS_EXECUTABLE} --version
        OUTPUT_VARIABLE NODEJS_VERSION
        OUTPUT_STRIP_TRAILING_WHITESPACE)
    string(SUBSTRING ${NODEJS_VERSION} 1 -1 NODEJS_VERSION)
    MESSAGE (STATUS "Installed Node.js found: ${NODEJS_EXECUTABLE} - ${NODEJS_VERSION}")
ELSE(NODEJS_EXECUTABLE)
    MESSAGE (STATUS "No installed Node.js found. Node.js is not downloaded, but expected to be installed.")
ENDIF(NODEJS_EXECUTABLE)

# fail if NodeJS version requirement is not satisfied. find_program() caches
# what it finds, so a node that was installed later, by nvm for instance, is
# only seen once the entry is dropped: the path is named here, as it is often
# an older one that is still in the cache.
if (${NODEJS_VERSION} VERSION_LESS ${REQUIRED_NODEJS_VERSION})
    message(FATAL_ERROR "Node.js is required in version "
        ${REQUIRED_NODEJS_VERSION} " or later, but "
        ${NODEJS_EXECUTABLE} " is " ${NODEJS_VERSION}
        ".\nIf a newer node is installed, cmake kept the path it found before:"
        " run it again with -U NODEJS_EXECUTABLE -U NPM.")
else()
    message(STATUS "good Node.js found: " ${NODEJS_VERSION} " (" ${REQUIRED_NODEJS_VERSION} " required.)")
endif()
set(NODE ${NODEJS_EXECUTABLE})
FIND_PROGRAM(NPM
    NAMES npm
    PATHS ""
    DOC "Path to NPM executable"
)
MESSAGE (STATUS "npm found: " ${NPM})
add_custom_target(NodeJS DEPENDS "${NODEJS_EXECUTABLE}")

# copy node_modules directory from source to build
# (this is needed if a module is required in there)

# Node's search path for node_modules starts from the main package and works up towards the root.
# In order to see these node modules, they need to be somewhere in this path
# See http://nodejs.org/api/modules.html#modules_loading_from_node_modules_folders for more detail
add_custom_target(copy_node_modules ALL
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/node_modules ${CMAKE_BINARY_DIR}/node_modules
    COMMENT copying node_modules from source to build
)

# Android
# If android sdk is properly installed, cmake only needs to know where to find
# the executable 'android'.
# The variable ANDROID_SDK_DIR can be provided if a specific android sdk version
# is desired or if the android executable is not in the path.
if (ANDROID_SDK_DIR)
  set(ANDROID ${ANDROID_SDK_DIR}/tools/android)
else (ANDROID_SDK_DIR)
  find_program(ANDROID NAMES android DOC "Path to the Android executable.")
endif(ANDROID_SDK_DIR)
FIND_PROGRAM(ANT NAMES ant DOC "Path to the Ant executable.")
if(ANDROID AND ANT)
  set(BUILD_APK TRUE)
  message(STATUS "Found Android and Ant: building an APK for Android.")
  message(STATUS "android: ${ANDROID}")
  message(STATUS "ant: ${ANT}")
else()
  message(STATUS "Android was not found: APK will not be built.")
endif()

# The coverage is measured by c8, that reads the one V8 records while it runs
# the tests: it neither parses nor rewrites the sources, so it does not
# constrain the version of ECMAScript the library is written in. It replaces
# JSCoverage, whose last release, 0.5.1 of 2010, bundles SpiderMonkey 1.7 and
# does not build any more with gcc 14 or clang 16.
#
# It is a target of its own, never built by "all", as it is only useful to
# measure the coverage and it runs the whole suite of the tests again.
add_custom_target(coverage
    COMMAND ${NPM} run coverage
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Measuring the coverage of the tests with c8"
    USES_TERMINAL
)

# The programs, the editors and the extensions, need Dojo 1.8.1, that is not
# published any more: neither dojotoolkit.org nor npm has it. They are built
# only when they are asked for, so that the library builds without them.
option(WEBODF_PROGRAMS "Build the editors and the extensions of programs/" OFF)

# Dojo
# The source release of dojotoolkit.org is not published any more, so the four
# packages are taken from the registry of npm, where they are still released.
set(DOJO_VERSION 1.17.3)
if (WEBODF_PROGRAMS)
ExternalProject_Add(
    DojoCore
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://registry.npmjs.org/dojo/-/dojo-${DOJO_VERSION}.tgz"
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
ExternalProject_Add(
    DojoDijit
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://registry.npmjs.org/dijit/-/dijit-${DOJO_VERSION}.tgz"
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
ExternalProject_Add(
    DojoDojox
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://registry.npmjs.org/dojox/-/dojox-${DOJO_VERSION}.tgz"
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
ExternalProject_Add(
    DojoUtil
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://registry.npmjs.org/dojo-util/-/dojo-util-${DOJO_VERSION}.tgz"
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
add_custom_target(Dojo DEPENDS DojoCore DojoDijit DojoDojox DojoUtil)
set(DOJO_CORE ${CMAKE_BINARY_DIR}/DojoCore-prefix/src/DojoCore)
set(DOJO_DIJIT ${CMAKE_BINARY_DIR}/DojoDijit-prefix/src/DojoDijit)
set(DOJO_DOJOX ${CMAKE_BINARY_DIR}/DojoDojox-prefix/src/DojoDojox)
set(DOJO_UTIL ${CMAKE_BINARY_DIR}/DojoUtil-prefix/src/DojoUtil)
endif (WEBODF_PROGRAMS)

# Dojo requires a patch on windows
if(WIN32 AND WEBODF_PROGRAMS)
    set(DOJOPATCH_URL "http://bugs.dojotoolkit.org/raw-attachment/ticket/15413/node-win-1.8.patch")
    set(DOJOPATCH_MD5 "51eae664ddbe919c28c4e3082748cd19")
    set(DOJOPATCH ${EXTERNALS_DOWNLOAD_DIR}/dojo-node.patch)

    file(DOWNLOAD "${DOJOPATCH_URL}" "${DOJOPATCH}"
        SHOW_PROGRESS
        EXPECTED_MD5 ${DOJOPATCH_MD5}
    )


    ExternalProject_Add_Step(Dojo applyPatch
        COMMAND cat ${DOJOPATCH} | patch -p0 -d ${CMAKE_BINARY_DIR}/Dojo-prefix/src/Dojo/util/
        DEPENDEES build
    )
endif(WIN32 AND WEBODF_PROGRAMS)

##############################
## Define custom macros
##############################

# COPY_FILES (varname srcdir tgtdir files)
# Creates a target that copies the listed files from the srcdir to the tgtdir,
# preserving their relative path.
# Absolute files will be copied into the root of tgtdir without any additional subdirs
macro(COPY_FILES _varname _srcdir _tgtdir)
  foreach(_file ${ARGN})
    if (IS_ABSOLUTE ${_file})
      SET(_subdir "")
      SET(_srcfile ${_file})
      GET_FILENAME_COMPONENT(_dstfile ${_file} NAME)
    else (IS_ABSOLUTE ${_file})
      GET_FILENAME_COMPONENT(_subdir ${_file} PATH)
      SET(_srcfile ${_srcdir}/${_file})
      SET(_dstfile ${_file})
    endif (IS_ABSOLUTE ${_file})
    FILE(MAKE_DIRECTORY ${_tgtdir}/${_subdir})
    add_custom_command(
      OUTPUT ${_tgtdir}/${_dstfile}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${_srcfile}
        ${_tgtdir}/${_dstfile}
      DEPENDS
        ${_srcfile}
    )
    set(${_varname} ${${_varname}} ${_tgtdir}/${_dstfile})
  endforeach(_file)
endmacro(COPY_FILES _directory _files)

#############################
## Define some files and dirs
#############################

# HEADERCOMPILED_FILE defines the file to use as header for the compiled WebODF library file.
# Per default that is webodf/lib/HeaderCompiled.js
# For release builds it can be overwritten by passing -DHEADERCOMPILED_FILE=/path/to/file
# to cmake.
if(NOT HEADERCOMPILED_FILE)
  set(HEADERCOMPILED_FILE "${CMAKE_SOURCE_DIR}/webodf/lib/HeaderCompiled.js")
elseif(NOT IS_ABSOLUTE ${HEADERCOMPILED_FILE})
  set(HEADERCOMPILED_FILE ${CMAKE_BINARY_DIR}/${HEADERCOMPILED_FILE})
endif()

set(TOOLS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/webodf/tools)
set(RUNTIMEJS ${CMAKE_CURRENT_SOURCE_DIR}/webodf/lib/runtime.js)
set(LIBJSLICENSEFILE ${CMAKE_CURRENT_SOURCE_DIR}/AGPL-3.0.txt)

set(WEBODFJS_DIR ${CMAKE_CURRENT_BINARY_DIR}/webodf.js-${WEBODF_VERSION})
set(WEBODFJS_ZIP webodf.js-${WEBODF_VERSION}.zip)

set(WODOTEXTEDITORBUILDDIR ${CMAKE_CURRENT_BINARY_DIR}/wodotexteditor)

set(WODOCOLLABTEXTEDITORBUILDDIR ${CMAKE_BINARY_DIR}/wodocollabtexteditor)
set(WODOCOLLABTEXTEDITOR_ZIP ${CMAKE_CURRENT_BINARY_DIR}/wodocollabtexteditor-${WEBODF_VERSION}.zip)

set(FIREFOX_EXTENSION_ODFVIEWER_DIR ${CMAKE_CURRENT_BINARY_DIR}/firefox-extension-odfviewer-${WEBODF_VERSION})
set(FIREFOX_EXTENSION_ODFVIEWER ${FIREFOX_EXTENSION_ODFVIEWER_DIR}.xpi)


####################
## WORKAROUND HELPER
####################

# cmake -E touch truncates time to seconds in older versions
# see http://www.cmake.org/Bug/view.php?id=14020
if (CMAKE_VERSION VERSION_LESS 2.8.12)
  set(TOUCHFILE ${NODE} ${TOOLS_DIR}/touchfile.js)
else()
  set(TOUCHFILE ${CMAKE_COMMAND} -E touch)
endif()


#############################
## Build Library and programs
#############################

# the lib
add_subdirectory(webodf)

# the programs/components
if (WEBODF_PROGRAMS)
    add_subdirectory(programs)
endif (WEBODF_PROGRAMS)

# vim:expandtab
