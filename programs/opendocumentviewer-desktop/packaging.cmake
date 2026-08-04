# Copyright (C) 2026 Daniel Berthereau <Daniel.git@Berthereau.net>
#
# @licstart
# This file is part of WebODF.
#
# WebODF is free software: you can redistribute it and/or modify it under the
# terms of the GNU Affero General Public License (GNU AGPL) as published by the
# Free Software Foundation, either version 3 of the License, or (at your
# option) any later version.
#
# WebODF is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License
# along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
# @licend
#
# @source: http://www.webodf.org/
# @source: https://github.com/webodf/WebODF/

# The ways the viewer of the desktop is handed over, from the shortest to the
# most finished:
#
# * an archive, that is unpacked by hand and reads the qt of the machine;
# * a package, "deb" or "rpm", that a system installs and keeps up to date,
#   and that names the qt it needs rather than carrying it;
# * a universal package, an AppImage or a flatpak, that carries qt itself and
#   runs on any distribution.
#
# Each one is a target of its own and each one is a product of the build, so
# "products" makes the ones the tools of this machine allow and names the
# others at the end, with the tool that is wanting. The tools are looked for
# rather than required: a machine that has none of them still builds the
# viewer.

set(VIEWER_STAGE ${CMAKE_CURRENT_BINARY_DIR}/stage)
set(VIEWER_PRODUCTS ${CMAKE_BINARY_DIR}/products)
set(VIEWER_ID org.webodf.OpenDocumentViewer)

# The version of a package is read by a machine, so it holds numbers alone:
# "0.5.10-274-gabc1234" of git becomes "0.5.10.274".
string(REGEX MATCH "^[0-9]+\\.[0-9]+\\.[0-9]+" VIEWER_VERSION ${WEBODF_VERSION})
if (NOT VIEWER_VERSION)
    set(VIEWER_VERSION "0.0.0")
endif ()
string(REGEX MATCH "-([0-9]+)-g" VIEWER_COMMITS ${WEBODF_VERSION})
if (CMAKE_MATCH_1)
    set(VIEWER_VERSION "${VIEWER_VERSION}.${CMAKE_MATCH_1}")
endif ()

if (CMAKE_SYSTEM_PROCESSOR)
    set(VIEWER_ARCH ${CMAKE_SYSTEM_PROCESSOR})
else ()
    set(VIEWER_ARCH "x86_64")
endif ()

if (WIN32)
    set(VIEWER_ARCHIVE
        ${VIEWER_PRODUCTS}/opendocumentviewer-${WEBODF_VERSION}-windows-${VIEWER_ARCH}.zip)
    set(VIEWER_ARCHIVE_FORMAT --format=zip)
elseif (APPLE)
    set(VIEWER_ARCHIVE
        ${VIEWER_PRODUCTS}/opendocumentviewer-${WEBODF_VERSION}-macos-${VIEWER_ARCH}.tar.gz)
    set(VIEWER_ARCHIVE_FORMAT "")
else ()
    set(VIEWER_ARCHIVE
        ${VIEWER_PRODUCTS}/opendocumentviewer-${WEBODF_VERSION}-linux-${VIEWER_ARCH}.tar.gz)
    set(VIEWER_ARCHIVE_FORMAT "")
endif ()

# The archive holds what "cmake --install" writes: the program, the entry of
# the menu and the icon, and beside them the libraries of qt on the systems
# whose tool gathers them.
add_custom_target(package-archive
    COMMAND ${CMAKE_COMMAND} -E rm -rf ${VIEWER_STAGE}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${VIEWER_PRODUCTS}
    COMMAND ${CMAKE_COMMAND} --install ${CMAKE_BINARY_DIR}
        --prefix ${VIEWER_STAGE}
    COMMAND ${CMAKE_COMMAND} -E chdir ${VIEWER_STAGE}
        ${CMAKE_COMMAND} -E tar czf ${VIEWER_ARCHIVE} ${VIEWER_ARCHIVE_FORMAT} .
    COMMAND ${CMAKE_COMMAND} -E echo "Wrote ${VIEWER_ARCHIVE}"
    DEPENDS opendocumentviewer-desktop
    COMMENT "The archive of the viewer of the desktop")

# The archive is the way the viewer of the desktop is handed over without a
# tool of a distribution: it stands among the products beside the add-ons and
# the editors, as every other way of handing it over does.
WEBODF_PRODUCT(package-archive ${VIEWER_ARCHIVE})

# A package of a system, that names the qt it needs rather than carrying it.
# CPack writes it from the same "install" rules as everything else.
set(CPACK_PACKAGE_NAME "opendocumentviewer")
set(CPACK_PACKAGE_VERSION ${VIEWER_VERSION})
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY
    "A reader of the OpenDocument format, that draws a document as it is printed")
set(CPACK_PACKAGE_VENDOR "webodf.org")
set(CPACK_PACKAGE_CONTACT "webodf@nlnet.nl")
set(CPACK_PACKAGE_HOMEPAGE_URL "https://webodf.org/")
# The name is kept apart as well: "include(CPack)" sets the variable of CPack
# back to the name of a package of the sources, so what is read after it is
# not what the package was named.
set(VIEWER_PACKAGE_NAME "opendocumentviewer-${WEBODF_VERSION}-${VIEWER_ARCH}")
set(CPACK_PACKAGE_FILE_NAME ${VIEWER_PACKAGE_NAME})
# CPack leaves a directory of its own beside what it writes, so it writes
# aside and the package alone is copied among the products.
set(VIEWER_CPACK_DIR ${CMAKE_CURRENT_BINARY_DIR}/packages)
set(CPACK_PACKAGE_DIRECTORY ${VIEWER_CPACK_DIR})
set(CPACK_RESOURCE_FILE_LICENSE ${CMAKE_SOURCE_DIR}/AGPL-3.0.txt)
set(CPACK_STRIP_FILES TRUE)
# The names of the packages of Debian and of Fedora for the same libraries.
set(CPACK_DEBIAN_PACKAGE_SECTION "text")
set(CPACK_DEBIAN_PACKAGE_DEPENDS
    "libqt6core6, libqt6gui6, libqt6widgets6, libqt6webenginewidgets6, libqt6webenginecore6")
set(CPACK_RPM_PACKAGE_LICENSE "AGPL-3.0")
set(CPACK_RPM_PACKAGE_GROUP "Applications/Publishing")
set(CPACK_RPM_PACKAGE_REQUIRES "qt6-qtbase, qt6-qtwebengine")
include(CPack)

find_program(DPKG_DEB dpkg-deb)
if (DPKG_DEB)
    add_custom_target(package-deb
        COMMAND ${CMAKE_COMMAND} -E make_directory ${VIEWER_PRODUCTS}
        COMMAND ${CMAKE_CPACK_COMMAND} -G DEB
            --config ${CMAKE_BINARY_DIR}/CPackConfig.cmake
        COMMAND ${CMAKE_COMMAND} -DDIR=${VIEWER_CPACK_DIR}
            -DDEST=${VIEWER_PRODUCTS} -DEXT=deb
            -DNAME=${VIEWER_PACKAGE_NAME}
            -P ${CMAKE_CURRENT_SOURCE_DIR}/data/copy-packages.cmake
        DEPENDS opendocumentviewer-desktop
        COMMENT "The package of debian of the viewer of the desktop")
    WEBODF_PRODUCT_MADE(package-deb
        "opendocumentviewer-${WEBODF_VERSION}-${VIEWER_ARCH}.deb")
else ()
    WEBODF_PRODUCT_MISSING("the package of debian" "dpkg-deb")
endif ()

find_program(RPMBUILD rpmbuild)
if (RPMBUILD)
    add_custom_target(package-rpm
        COMMAND ${CMAKE_COMMAND} -E make_directory ${VIEWER_PRODUCTS}
        COMMAND ${CMAKE_CPACK_COMMAND} -G RPM
            --config ${CMAKE_BINARY_DIR}/CPackConfig.cmake
        COMMAND ${CMAKE_COMMAND} -DDIR=${VIEWER_CPACK_DIR}
            -DDEST=${VIEWER_PRODUCTS} -DEXT=rpm
            -DNAME=${VIEWER_PACKAGE_NAME}
            -P ${CMAKE_CURRENT_SOURCE_DIR}/data/copy-packages.cmake
        DEPENDS opendocumentviewer-desktop
        COMMENT "The package of fedora of the viewer of the desktop")
    WEBODF_PRODUCT_MADE(package-rpm
        "opendocumentviewer-${WEBODF_VERSION}-${VIEWER_ARCH}.rpm")
else ()
    WEBODF_PRODUCT_MISSING("the package of fedora" "rpmbuild")
endif ()

# A universal package carries qt with it and runs on any distribution, where a
# package of a system names the qt of that system. Two of them are made, as
# neither is the one everyone has: an AppImage is one file that is run as it
# is, a flatpak is installed from a repository and runs in a sandbox.
if (UNIX AND NOT APPLE)
    set(VIEWER_APPDIR ${CMAKE_CURRENT_BINARY_DIR}/AppDir)
    set(VIEWER_APPIMAGE
        ${VIEWER_PRODUCTS}/OpenDocumentViewer-${WEBODF_VERSION}-${VIEWER_ARCH}.AppImage)

    # The tool of the AppImage gathers the libraries an executable reads, and
    # the one of qt gathers what the webengine reads beside them, the
    # process of the engine among the rest.
    find_program(LINUXDEPLOY linuxdeploy)
    find_program(LINUXDEPLOY_QT linuxdeploy-plugin-qt)
    find_program(APPIMAGETOOL appimagetool)

    if (LINUXDEPLOY)
        add_custom_target(package-appimage
            COMMAND ${CMAKE_COMMAND} -E rm -rf ${VIEWER_APPDIR}
            COMMAND ${CMAKE_COMMAND} -E make_directory ${VIEWER_PRODUCTS}
            COMMAND ${CMAKE_COMMAND} --install ${CMAKE_BINARY_DIR}
                --prefix ${VIEWER_APPDIR}/usr
            COMMAND ${CMAKE_COMMAND} -E env
                OUTPUT=${VIEWER_APPIMAGE}
                QMAKE=${QT_QMAKE_EXECUTABLE}
                ${LINUXDEPLOY} --appdir ${VIEWER_APPDIR}
                    --plugin qt --output appimage
            COMMAND ${CMAKE_COMMAND} -E echo "Wrote ${VIEWER_APPIMAGE}"
            DEPENDS opendocumentviewer-desktop
            COMMENT "The AppImage of the viewer of the desktop")
        WEBODF_PRODUCT_MADE(package-appimage
            "OpenDocumentViewer-${WEBODF_VERSION}-${VIEWER_ARCH}.AppImage")
    else ()
        WEBODF_PRODUCT_MISSING("the AppImage" "linuxdeploy")
        add_custom_target(package-appimage
            COMMAND ${CMAKE_COMMAND} -E echo
                "linuxdeploy is not installed: an AppImage carries qt with it, and the tool is what gathers it, see https://github.com/linuxdeploy/linuxdeploy"
            COMMAND ${CMAKE_COMMAND} -E false
            COMMENT "The AppImage of the viewer of the desktop")
    endif ()

    # A machine where the tool cannot write the flatpak, for want of the
    # rights its build dir asks for, leaves it out rather than stopping the
    # build of everything else.
    option(WEBODF_PACKAGE_FLATPAK "Make the flatpak of the viewer" ON)
    if (WEBODF_PACKAGE_FLATPAK)
        find_program(FLATPAK_BUILDER flatpak-builder)
        find_program(FLATPAK flatpak)
        find_program(OSTREE ostree)
    else ()
        set(FLATPAK_BUILDER "")
        set(FLATPAK "")
    endif ()

    # The manifest of the flatpak names the runtime of KDE, which carries qt
    # and its webengine, so nothing of qt is built here: the tool reads it and
    # writes the package. The tool alone is not enough, as that runtime is
    # installed apart and weighs some gigabytes; and a branch of it is
    # declared end of life as soon as a newer one is out, so the newest branch
    # this machine has is taken rather than one written here, which would ask
    # for a version that is old before the next release.
    #
    # Whether one is there at all is asked now rather than in the middle of
    # the build, where the failure reads as a broken build and not as a
    # missing part of the machine.
    #
    # The branch of the runtime is the version of qt it carries, so the least
    # one that will do is the least version of qt the viewer is built with,
    # see "find_package(Qt6 ...)" in the root: a machine that kept only an
    # older branch has nothing to build against, and is told so.
    # The library the sandbox is given, written by this build: the manifest
    # names it beside the sources.
    set(WEBODF_JS_FILE ${CMAKE_BINARY_DIR}/webodf/webodf.js)
    set(VIEWER_FLATPAK_REPO ${CMAKE_CURRENT_BINARY_DIR}/flatpak-repo)
    set(VIEWER_FLATPAK_RUNTIME_LEAST "6.4")
    set(WEBODF_FLATPAK_RUNTIME "" CACHE STRING
        "The branch of org.kde.Sdk the flatpak is built against, the newest installed one by default")
    set(VIEWER_FLATPAK_RUNTIME "${WEBODF_FLATPAK_RUNTIME}")
    if (FLATPAK AND NOT VIEWER_FLATPAK_RUNTIME)
        execute_process(COMMAND ${FLATPAK} list --app=false --columns=application,branch
            OUTPUT_VARIABLE VIEWER_FLATPAK_LIST
            RESULT_VARIABLE VIEWER_FLATPAK_LISTED
            ERROR_QUIET OUTPUT_STRIP_TRAILING_WHITESPACE)
        if (VIEWER_FLATPAK_LISTED EQUAL 0)
            string(REGEX MATCHALL "org\\.kde\\.Sdk[ \t]+[0-9]+\\.[0-9]+"
                VIEWER_FLATPAK_SDKS "${VIEWER_FLATPAK_LIST}")
            set(VIEWER_FLATPAK_BRANCHES "")
            foreach (VIEWER_FLATPAK_ONE ${VIEWER_FLATPAK_SDKS})
                string(REGEX REPLACE "^org\\.kde\\.Sdk[ \t]+" ""
                    VIEWER_FLATPAK_ONE "${VIEWER_FLATPAK_ONE}")
                # A branch of qt 5, or one older than the viewer asks for,
                # carries no webengine the viewer can be built against.
                if (NOT VIEWER_FLATPAK_ONE VERSION_LESS
                        VIEWER_FLATPAK_RUNTIME_LEAST)
                    list(APPEND VIEWER_FLATPAK_BRANCHES ${VIEWER_FLATPAK_ONE})
                endif ()
            endforeach ()
            if (VIEWER_FLATPAK_BRANCHES)
                list(SORT VIEWER_FLATPAK_BRANCHES COMPARE NATURAL ORDER
                    DESCENDING)
                list(GET VIEWER_FLATPAK_BRANCHES 0 VIEWER_FLATPAK_RUNTIME)
            endif ()
        endif ()
    endif ()
    # A branch that is named by hand is taken as it is asked for, but not one
    # that carries a qt the viewer is not built with: that is a mistake of the
    # one who asked, and it is told now and not by the compiler.
    if (WEBODF_FLATPAK_RUNTIME AND WEBODF_FLATPAK_RUNTIME VERSION_LESS
            VIEWER_FLATPAK_RUNTIME_LEAST)
        message(FATAL_ERROR
            "WEBODF_FLATPAK_RUNTIME is ${WEBODF_FLATPAK_RUNTIME}, and the viewer is built with qt ${VIEWER_FLATPAK_RUNTIME_LEAST} or newer, which the runtime of KDE carries under the branch of the same number.")
    endif ()
    # What the manifest names when nothing is installed, so that it is written
    # and read even where no flatpak is built.
    if (NOT VIEWER_FLATPAK_RUNTIME)
        set(VIEWER_FLATPAK_RUNTIME "6.9")
    endif ()
    configure_file(data/org.webodf.OpenDocumentViewer.yml.in
        ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml @ONLY)

    # The runtime of KDE carries qt but not its webengine, which the viewer is
    # drawn in: that one comes from the base app of qt, built into the app, so
    # both are asked for here.
    set(VIEWER_FLATPAK_SDK "org.kde.Sdk//${VIEWER_FLATPAK_RUNTIME}")
    set(VIEWER_FLATPAK_BASE
        "io.qt.qtwebengine.BaseApp//${VIEWER_FLATPAK_RUNTIME}")
    set(VIEWER_HAS_FLATPAK_SDK FALSE)
    if (FLATPAK_BUILDER AND FLATPAK)
        execute_process(COMMAND ${FLATPAK} info ${VIEWER_FLATPAK_SDK}
            RESULT_VARIABLE VIEWER_FLATPAK_SDK_ANSWERED
            OUTPUT_QUIET ERROR_QUIET)
        execute_process(COMMAND ${FLATPAK} info ${VIEWER_FLATPAK_BASE}
            RESULT_VARIABLE VIEWER_FLATPAK_BASE_ANSWERED
            OUTPUT_QUIET ERROR_QUIET)
        if (VIEWER_FLATPAK_SDK_ANSWERED EQUAL 0
                AND VIEWER_FLATPAK_BASE_ANSWERED EQUAL 0)
            set(VIEWER_HAS_FLATPAK_SDK TRUE)
        elseif (VIEWER_FLATPAK_SDK_ANSWERED EQUAL 0)
            set(VIEWER_FLATPAK_SDK ${VIEWER_FLATPAK_BASE})
        endif ()
    endif ()

    if (FLATPAK_BUILDER AND VIEWER_HAS_FLATPAK_SDK)
        # The repository the flatpak is exported to refuses to write when
        # less than a part of the disk is free, three hundredths of it by
        # default, which is a hundred gigabytes on a disk of three terabytes:
        # a size is asked for instead, as the flatpak of this viewer weighs
        # some tens of megabytes.
        if (OSTREE)
            set(VIEWER_FLATPAK_ROOM
                COMMAND ${OSTREE} init --repo=${VIEWER_FLATPAK_REPO}
                    --mode=archive-z2
                COMMAND ${OSTREE} config --repo=${VIEWER_FLATPAK_REPO}
                    set core.min-free-space-size 500MB)
        else ()
            set(VIEWER_FLATPAK_ROOM "")
        endif ()
        add_custom_target(package-flatpak
            COMMAND ${CMAKE_COMMAND} -E make_directory ${VIEWER_PRODUCTS}
            ${VIEWER_FLATPAK_ROOM}
            COMMAND ${FLATPAK_BUILDER} --force-clean --repo=${VIEWER_FLATPAK_REPO}
                ${CMAKE_CURRENT_BINARY_DIR}/flatpak-build
                ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml
            COMMAND ${FLATPAK_BUILDER} --run
                ${CMAKE_CURRENT_BINARY_DIR}/flatpak-build
                ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml true
            COMMAND flatpak build-bundle ${VIEWER_FLATPAK_REPO}
                ${VIEWER_PRODUCTS}/${VIEWER_ID}-${WEBODF_VERSION}.flatpak ${VIEWER_ID}
            DEPENDS opendocumentviewer-desktop webodf.js-target
            COMMENT "The flatpak of the viewer of the desktop")
        WEBODF_PRODUCT_MADE(package-flatpak
            "${VIEWER_ID}-${WEBODF_VERSION}.flatpak")
    else ()
        if (FLATPAK_BUILDER)
            WEBODF_PRODUCT_MISSING("the flatpak" "${VIEWER_FLATPAK_SDK}")
            set(VIEWER_NO_FLATPAK
                "${VIEWER_FLATPAK_SDK} is not installed: the flatpak is built against the runtime of KDE, which carries qt, and against the base app of qt, which carries its webengine. Install them with: flatpak install --user flathub org.kde.Platform//${VIEWER_FLATPAK_RUNTIME} org.kde.Sdk//${VIEWER_FLATPAK_RUNTIME} ${VIEWER_FLATPAK_BASE}")
        else ()
            if (WEBODF_PACKAGE_FLATPAK)
                WEBODF_PRODUCT_MISSING("the flatpak" "flatpak-builder")
                set(VIEWER_NO_FLATPAK
                    "flatpak-builder is not installed: the manifest is written in ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml, see https://docs.flatpak.org/")
            else ()
                set(VIEWER_NO_FLATPAK
                    "The flatpak was left out by WEBODF_PACKAGE_FLATPAK=OFF: configure again with -DWEBODF_PACKAGE_FLATPAK=ON to make it.")
            endif ()
        endif ()
        add_custom_target(package-flatpak
            COMMAND ${CMAKE_COMMAND} -E echo "${VIEWER_NO_FLATPAK}"
            COMMAND ${CMAKE_COMMAND} -E false
            COMMENT "The flatpak of the viewer of the desktop")
    endif ()
endif ()
