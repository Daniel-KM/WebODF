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

# The version is read once, when the build is configured, and it names the
# packages, so a build made after a commit would keep the version of the one
# before. Reading these two files here ties the configuration to them: cmake
# runs itself again, before make, as soon as a commit or a checkout writes
# them, and the version follows the sources without anything to remember.
foreach (GIT_FILE .git/HEAD .git/index)
    if (EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/${GIT_FILE})
        configure_file(${CMAKE_CURRENT_SOURCE_DIR}/${GIT_FILE}
            ${CMAKE_CURRENT_BINARY_DIR}/git-watch/${GIT_FILE} COPYONLY)
    endif()
endforeach()

# The manifest of an add-on only takes up to four numbers separated by dots,
# where git describe adds the number of commits and the hash of the last one:
# "0.5.10-161-gc2572a4a" is written "0.5.10.161", so that the builds between
# two tags still follow each other. A tagged build is left as it is.
string(REGEX REPLACE "^([0-9]+(\\.[0-9]+)*)-([0-9]+)-g[0-9a-f]+.*$" "\\1.\\3"
    WEBODF_MANIFEST_VERSION "${WEBODF_VERSION}")
string(REGEX REPLACE "-dirty$" "" WEBODF_MANIFEST_VERSION "${WEBODF_MANIFEST_VERSION}")


#########################################################
## Find installed dependencies
#########################################################

# qtjsruntime runs the tests in the webengine of qt, see "webodf/tests". It is
# opt-in, as it needs the modules of qt, that weigh more than the rest of the
# build together, while "npm run test:browser" runs the same tests in a browser
# that is installed anyway. Without the option, the modules are not looked for
# at all, so no warning is reported for something that is not asked for.
#
# It ran in Qt WebKit until 2026, that Qt dropped in 5.6, in 2016, and that
# Debian stopped packaging in 13: the program was rewritten for webengine, that
# is the blink of chromium, see "programs/qtjsruntime".
option(WEBODF_QTJSRUNTIME "Build qtjsruntime, that runs the tests in the webengine of qt" OFF)

# The viewer of OpenDocument for the desktop is a window of qt around the page
# the library draws in, see "programs/opendocumentviewer-desktop". It is opt-in
# for the same reason, and it is built by the option alone, without
# WEBODF_PROGRAMS, as it needs neither Dojo nor the editors.
option(WEBODF_DESKTOP "Build the viewer of OpenDocument for the desktop, in qt" OFF)

# 6.4 is the oldest version the two programs are written for, the one of Debian
# 12. Everything they use was already in the first release of Qt 6: a channel to
# the page, a collection of scripts on the profile, a handler of a url scheme,
# and printing to a pdf.
set(BUILD_QTJSRUNTIME FALSE)
set(BUILD_DESKTOP FALSE)
if (WEBODF_QTJSRUNTIME OR WEBODF_DESKTOP)
  find_package(Qt6 6.4 COMPONENTS Core Gui Widgets PrintSupport WebChannel WebEngineCore WebEngineWidgets)

  if (Qt6_FOUND)
    set(BUILD_QTJSRUNTIME ${WEBODF_QTJSRUNTIME})
    set(BUILD_DESKTOP ${WEBODF_DESKTOP})
  else ()
    message(FATAL_ERROR "Qt6 with the modules Core Gui Widgets PrintSupport WebChannel WebEngineCore WebEngineWidgets was not found, so neither qtjsruntime nor the viewer for the desktop can be built. On Debian 12 and later: apt-get install qt6-base-dev qt6-base-dev-tools qt6-webchannel-dev qt6-webengine-dev qt6-webengine-dev-tools")
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
    # Without the hash, cmake has no way to tell whether the file it already has
    # is the right one, so it downloads it again at every build, see the target
    # Gradle below.
    URL_HASH SHA256=0cb86a4b96769c679b4fc2d2dc0e5acd0abd0dff932945b90fbe327247466a29
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
    URL_HASH SHA256=1cc2b468a51857747dcb29ae533e352a2abc04e81c5aa61e397dc774dd395329
    DOWNLOAD_NO_EXTRACT TRUE
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
# Same version as the build with node, see scripts/lib/rhino.js.
set(RHINO ${EXTERNALS_DOWNLOAD_DIR}/rhino-all-1.9.1.jar)


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

# The programs, the editors and the extensions, need Dojo, that is downloaded
# from the registry of npm, see below. They are built only when they are asked
# for, so that the library builds without them.
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
    # Without the hash, cmake downloads the archive again at every build, as it
    # cannot tell whether the one it holds is the right one.
    URL_HASH SHA256=84d7e0e59a024885631276f2ae44064b778fbb83d12ecfa0d3fc93f44c9d38b1
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
ExternalProject_Add(
    DojoDijit
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://registry.npmjs.org/dijit/-/dijit-${DOJO_VERSION}.tgz"
    URL_HASH SHA256=d1e0e41d21ebfd0214ec4c1956816d04efcdf68a84c4aa85600a7c34846b5a26
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
ExternalProject_Add(
    DojoDojox
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://registry.npmjs.org/dojox/-/dojox-${DOJO_VERSION}.tgz"
    URL_HASH SHA256=ba6fa9e334a9519247afc7cf52a72f57458078d8e4ef1074ee4ca4e826b7203e
    CONFIGURE_COMMAND ""
    BUILD_COMMAND ""
    INSTALL_COMMAND ""
)
ExternalProject_Add(
    DojoUtil
    DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
    URL "https://registry.npmjs.org/dojo-util/-/dojo-util-${DOJO_VERSION}.tgz"
    URL_HASH SHA256=1811801438bd81f306834b2c864d6345d649797a32088b3333a7f6732a97e484
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

# The pages of the products tell what the OpenDocument format is worth, and they
# tell it in the same words: the text is written once, in "programs/text", and
# inserted where a page names it, "@FORMAT_TEXT@". A page is a template,
# "*.html.in", and the page itself is written into the build directory.
#
# The text is read here, and it is named as a dependency of the configuration,
# so that cmake runs itself again when it is revised: the pages then follow
# without anything to remember.
set(TEXT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/programs/text)
foreach (LANGUAGE en fr)
  file(READ ${TEXT_DIR}/format.${LANGUAGE}.html FORMAT_TEXT_${LANGUAGE})
  # The newline an editor writes at the end of a file would become a blank line
  # in every page, so the text is taken without what closes it.
  string(REGEX REPLACE "[ \t\r\n]+$" "" FORMAT_TEXT_${LANGUAGE}
      "${FORMAT_TEXT_${LANGUAGE}}")
  set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
      ${TEXT_DIR}/format.${LANGUAGE}.html)
endforeach ()

# INSERT_TEXT (template output language)
# Writes the page of a product, with the text of the format in it.
macro(INSERT_TEXT _template _output _language)
  set(FORMAT_TEXT "${FORMAT_TEXT_${_language}}")
  configure_file(${_template} ${_output} @ONLY)
endmacro(INSERT_TEXT)

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

set(OPENDOCUMENTTEXTEDITORBUILDDIR ${CMAKE_CURRENT_BINARY_DIR}/opendocumenttexteditor)

set(OPENDOCUMENTTEXTCOLLABBUILDDIR ${CMAKE_BINARY_DIR}/opendocumenttextcollab)
set(OPENDOCUMENTTEXTCOLLAB_ZIP ${CMAKE_CURRENT_BINARY_DIR}/opendocumenttextcollab-${WEBODF_VERSION}.zip)

# The add-on is packed twice, from the same scripts: the manifest version 3
# needs Firefox 109, of 2023, and the version 2 reaches back to Firefox 48, of
# 2016. See "README-Products.md".
set(OPENDOCUMENTVIEWER_FIREFOX_DIR ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer-firefox-${WEBODF_VERSION})
set(OPENDOCUMENTVIEWER_FIREFOX ${OPENDOCUMENTVIEWER_FIREFOX_DIR}.xpi)
set(OPENDOCUMENTVIEWER_FIREFOX_MV2_DIR ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer-firefox-mv2-${WEBODF_VERSION})
set(OPENDOCUMENTVIEWER_FIREFOX_MV2 ${OPENDOCUMENTVIEWER_FIREFOX_MV2_DIR}.xpi)
# Chrome takes a zip, and a file of rules rather than a script: it dropped the
# blocking webRequest the two others redirect with.
set(OPENDOCUMENTVIEWER_CHROME_DIR ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer-chrome-${WEBODF_VERSION})
set(OPENDOCUMENTVIEWER_CHROME ${OPENDOCUMENTVIEWER_CHROME_DIR}.zip)

# Thunderbird reads the attachments of the messages, which no request carries,
# so it gets a script of its own. The version 3 needs Thunderbird 128, of 2024,
# and the version 2 reaches back to the 98, of 2022, the first that opens a
# menu on an attachment.
set(OPENDOCUMENTVIEWER_THUNDERBIRD_DIR ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer-thunderbird-${WEBODF_VERSION})
set(OPENDOCUMENTVIEWER_THUNDERBIRD ${OPENDOCUMENTVIEWER_THUNDERBIRD_DIR}.xpi)
set(OPENDOCUMENTVIEWER_THUNDERBIRD_MV2_DIR ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer-thunderbird-mv2-${WEBODF_VERSION})
set(OPENDOCUMENTVIEWER_THUNDERBIRD_MV2 ${OPENDOCUMENTVIEWER_THUNDERBIRD_MV2_DIR}.xpi)


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
## The products of the build
#############################

# A product is a file someone is given: an add-on, a zip of the library, an
# apk. Each one is written where the target that packs it stands, so the list
# is kept here: the target "products" packs them all and tells where each one
# was written, as the paths are of no help to remember. The target is named
# beside the path, so that the list follows the targets and not the files,
# whose names hold the version of the build.
set_property(GLOBAL PROPERTY WEBODF_PRODUCTS "")
set_property(GLOBAL PROPERTY WEBODF_PRODUCT_TARGETS "")
macro(WEBODF_PRODUCT target path)
    set_property(GLOBAL APPEND PROPERTY WEBODF_PRODUCTS ${path})
    set_property(GLOBAL APPEND PROPERTY WEBODF_PRODUCT_TARGETS ${target})
endmacro(WEBODF_PRODUCT)

#############################
## Build Library and programs
#############################

# the lib
add_subdirectory(webodf)

# the programs/components
if (WEBODF_PROGRAMS)
    add_subdirectory(programs)
else ()
    # Two programs are built by their own option, without the others: the tests
    # of the library are run with the first one, and the second needs neither
    # Dojo nor the editors.
    if (BUILD_QTJSRUNTIME)
        add_subdirectory(programs/qtjsruntime)
    endif ()
    if (BUILD_DESKTOP)
        add_subdirectory(programs/opendocumentviewer-desktop)
    endif ()
endif ()

# The target that runs every test of this build, beside "products" that packs
# every product: the tests of the library, in each engine the build has, and
# the ones of the programs that carry some.
add_custom_target(tests
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "Every test of this build has run.")
add_dependencies(tests webodf.js-tests)
foreach (WEBODF_TEST_TARGET
        test-opendocumenttexteditor
        test-opendocumenttextcollab
        test-opendocumentviewer-webext
        test-opendocumentviewer-thunderbird)
    if (TARGET ${WEBODF_TEST_TARGET})
        add_dependencies(tests ${WEBODF_TEST_TARGET})
    endif ()
endforeach ()

# The target that packs every product of this build and gathers them in one
# place. Each product is written where the target that packs it stands, deep
# in the tree of the build, so "make products" or "ninja products" copies them
# all into "products/" and tells what is there: no one has to remember where
# an add-on or an apk was written.
get_property(WEBODF_PRODUCT_FILES GLOBAL PROPERTY WEBODF_PRODUCTS)
get_property(WEBODF_PRODUCT_TARGET_LIST GLOBAL PROPERTY WEBODF_PRODUCT_TARGETS)
if (WEBODF_PRODUCT_FILES)
    set(WEBODF_PRODUCTS_DIR ${CMAKE_BINARY_DIR}/products)
    set(WEBODF_PRODUCT_STEPS
        COMMAND ${CMAKE_COMMAND} -E make_directory ${WEBODF_PRODUCTS_DIR})
    foreach (WEBODF_PRODUCT_FILE ${WEBODF_PRODUCT_FILES})
        list(APPEND WEBODF_PRODUCT_STEPS
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
                ${WEBODF_PRODUCT_FILE} ${WEBODF_PRODUCTS_DIR})
    endforeach ()
    list(APPEND WEBODF_PRODUCT_STEPS
        COMMAND ${CMAKE_COMMAND} -E echo ""
        COMMAND ${CMAKE_COMMAND} -E echo
            "The products of this build are in ${WEBODF_PRODUCTS_DIR}:")
    foreach (WEBODF_PRODUCT_FILE ${WEBODF_PRODUCT_FILES})
        get_filename_component(WEBODF_PRODUCT_NAME ${WEBODF_PRODUCT_FILE} NAME)
        list(APPEND WEBODF_PRODUCT_STEPS
            COMMAND ${CMAKE_COMMAND} -E echo "  ${WEBODF_PRODUCT_NAME}")
    endforeach ()
    add_custom_target(products ${WEBODF_PRODUCT_STEPS})
    add_dependencies(products ${WEBODF_PRODUCT_TARGET_LIST})
endif ()

# vim:expandtab
