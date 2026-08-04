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
set(CPACK_PACKAGE_FILE_NAME
    "opendocumentviewer-${WEBODF_VERSION}-${VIEWER_ARCH}")
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

    # The manifest of the flatpak names the runtime of qt, so nothing of qt is
    # built here: the tool reads it and writes the package.
    configure_file(data/org.webodf.OpenDocumentViewer.yml.in
        ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml @ONLY)
    find_program(FLATPAK_BUILDER flatpak-builder)
    if (FLATPAK_BUILDER)
        add_custom_target(package-flatpak
            COMMAND ${CMAKE_COMMAND} -E make_directory ${VIEWER_PRODUCTS}
            COMMAND ${FLATPAK_BUILDER} --force-clean --repo=${CMAKE_CURRENT_BINARY_DIR}/flatpak-repo
                ${CMAKE_CURRENT_BINARY_DIR}/flatpak-build
                ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml
            COMMAND ${FLATPAK_BUILDER} --run
                ${CMAKE_CURRENT_BINARY_DIR}/flatpak-build
                ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml true
            COMMAND flatpak build-bundle ${CMAKE_CURRENT_BINARY_DIR}/flatpak-repo
                ${VIEWER_PRODUCTS}/${VIEWER_ID}-${WEBODF_VERSION}.flatpak ${VIEWER_ID}
            DEPENDS opendocumentviewer-desktop
            COMMENT "The flatpak of the viewer of the desktop")
        WEBODF_PRODUCT_MADE(package-flatpak
            "${VIEWER_ID}-${WEBODF_VERSION}.flatpak")
    else ()
        WEBODF_PRODUCT_MISSING("the flatpak" "flatpak-builder")
        add_custom_target(package-flatpak
            COMMAND ${CMAKE_COMMAND} -E echo
                "flatpak-builder is not installed: the manifest is written in ${CMAKE_CURRENT_BINARY_DIR}/${VIEWER_ID}.yml, see https://docs.flatpak.org/"
            COMMAND ${CMAKE_COMMAND} -E false
            COMMENT "The flatpak of the viewer of the desktop")
    endif ()
endif ()
