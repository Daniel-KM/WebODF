# The viewer of OpenDocument for the desktop: a window of qt around the page
# that the library draws a document in, the same page as the extensions of the
# browsers and the viewer for android use.
set(CMAKE_AUTOMOC ON)

add_executable(opendocumentviewer-desktop
    main.cpp
    mainwindow.cpp
    viewerscheme.cpp
    words.h
)

# The page, its style, its script and the library are put in the program itself,
# so that it runs from a single file, wherever it is copied. The library is
# built, so it is named where it is written and aliased to its own name, as the
# page reads it beside itself.
set(WEBODF_JS ${CMAKE_BINARY_DIR}/webodf/webodf.js)
set_source_files_properties(${WEBODF_JS} PROPERTIES
    QT_RESOURCE_ALIAS webodf.js
    GENERATED TRUE)
qt_add_resources(opendocumentviewer-desktop "assets"
    PREFIX "/"
    BASE assets
    FILES
        assets/viewer.html
        assets/viewer.css
        assets/viewer.js
        assets/about.css
)

# The two pages that tell what the format is worth hold a text that is written
# once, see "INSERT_TEXT" in the CMakeLists of the root, so they are written into
# the build directory and read from there.
foreach (LANGUAGE en fr)
    INSERT_TEXT(assets/about.${LANGUAGE}.html.in
        ${CMAKE_CURRENT_BINARY_DIR}/about.${LANGUAGE}.html ${LANGUAGE})
    set_source_files_properties(${CMAKE_CURRENT_BINARY_DIR}/about.${LANGUAGE}.html
        PROPERTIES QT_RESOURCE_ALIAS about.${LANGUAGE}.html)
endforeach ()
qt_add_resources(opendocumentviewer-desktop "text"
    PREFIX "/"
    FILES
        ${CMAKE_CURRENT_BINARY_DIR}/about.en.html
        ${CMAKE_CURRENT_BINARY_DIR}/about.fr.html
)
qt_add_resources(opendocumentviewer-desktop "library"
    PREFIX "/"
    FILES ${WEBODF_JS}
)

# One icon serves every product, so it is read where it lies rather than copied
# here, and it names the window and the entry of the desktop. The one of the
# window is the small one, that the extensions carry; the icons of windows and
# of macos are made from the large one, as a dock draws it at 512.
set(ICON ${CMAKE_CURRENT_SOURCE_DIR}/../opendocumentviewer-webext/skin/default/icon.png)
set(ICON_MASTER ${CMAKE_CURRENT_SOURCE_DIR}/../opendocumentviewer-android/src/main/fastlane/metadata/android/en-US/images/icon.png)
set_source_files_properties(${ICON} PROPERTIES QT_RESOURCE_ALIAS icon.png)
qt_add_resources(opendocumentviewer-desktop "icon"
    PREFIX "/"
    FILES ${ICON}
)
add_dependencies(opendocumentviewer-desktop webodf.js-target)

target_compile_definitions(opendocumentviewer-desktop PRIVATE
    OPENDOCUMENTVIEWER_VERSION="${WEBODF_MANIFEST_VERSION}")

target_link_libraries(opendocumentviewer-desktop
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::PrintSupport
    Qt6::WebEngineCore
    Qt6::WebEngineWidgets
)

# Windows draws a program with the icon of its resources, in the format of its
# own, and shows what the version tells in the properties of the file. The icon
# is made from the one of the project, at the sizes windows asks for, rather
# than kept as a second file to hold in step, see "webodf/tools/makeico.js".
if (WIN32)
    set(OPENDOCUMENTVIEWER_ICO ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer.ico)
    add_custom_command(
        OUTPUT ${OPENDOCUMENTVIEWER_ICO}
        COMMAND ${NODE} ARGS ${TOOLS_DIR}/makeico.js ${ICON_MASTER}
            ${OPENDOCUMENTVIEWER_ICO}
        DEPENDS ${ICON_MASTER} ${TOOLS_DIR}/makeico.js
    )

    # The version of a resource is four numbers separated by commas, where the
    # one of the build may hold fewer, "0.5.10" on a tag. The numbers are
    # counted rather than matched: the regular expressions of cmake know no
    # repetition, "{3}".
    string(REPLACE "." ";" OPENDOCUMENTVIEWER_VERSION_PARTS
        ${WEBODF_MANIFEST_VERSION})
    list(LENGTH OPENDOCUMENTVIEWER_VERSION_PARTS OPENDOCUMENTVIEWER_VERSION_HELD)
    while (OPENDOCUMENTVIEWER_VERSION_HELD LESS 4)
        list(APPEND OPENDOCUMENTVIEWER_VERSION_PARTS 0)
        math(EXPR OPENDOCUMENTVIEWER_VERSION_HELD
            "${OPENDOCUMENTVIEWER_VERSION_HELD} + 1")
    endwhile ()
    string(REPLACE ";" "," OPENDOCUMENTVIEWER_VERSION_NUMBERS
        "${OPENDOCUMENTVIEWER_VERSION_PARTS}")
    configure_file(data/opendocumentviewer.rc.in
        ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer.rc @ONLY)
    set_source_files_properties(${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer.rc
        PROPERTIES OBJECT_DEPENDS ${OPENDOCUMENTVIEWER_ICO})
    target_sources(opendocumentviewer-desktop PRIVATE
        ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer.rc)

    # A viewer opens no terminal behind its window.
    set_target_properties(opendocumentviewer-desktop PROPERTIES
        WIN32_EXECUTABLE TRUE)

    # The script of the installer, that gathers what was deployed, see
    # "README-Products.md".
    # Inno Setup reads the paths of windows, with backslashes.
    file(TO_NATIVE_PATH "${CMAKE_INSTALL_PREFIX}" OPENDOCUMENTVIEWER_DEPLOYED)
    configure_file(data/opendocumentviewer.iss.in
        ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer.iss @ONLY)
endif ()

# Macos draws a program with the icon of its bundle, in the format of its own,
# and reads what the bundle tells about it, the types of documents it opens
# among them.
if (APPLE)
    set(OPENDOCUMENTVIEWER_ICNS
        ${CMAKE_CURRENT_BINARY_DIR}/opendocumentviewer.icns)
    add_custom_command(
        OUTPUT ${OPENDOCUMENTVIEWER_ICNS}
        COMMAND ${NODE} ARGS ${TOOLS_DIR}/makeicns.js ${ICON_MASTER}
            ${OPENDOCUMENTVIEWER_ICNS}
        DEPENDS ${ICON_MASTER} ${TOOLS_DIR}/makeicns.js
            ${TOOLS_DIR}/makeico.js
    )
    # The icon goes into the resources of the bundle, where the plist names it.
    set_source_files_properties(${OPENDOCUMENTVIEWER_ICNS} PROPERTIES
        MACOSX_PACKAGE_LOCATION Resources)
    target_sources(opendocumentviewer-desktop PRIVATE
        ${OPENDOCUMENTVIEWER_ICNS})

    # The oldest macos the program runs on is the one qt was built for, that
    # cmake holds when it is told, and the one of Qt 6.8 otherwise: a bundle
    # that claimed less would be offered to a machine that cannot run it.
    if (CMAKE_OSX_DEPLOYMENT_TARGET)
        set(OPENDOCUMENTVIEWER_MACOS ${CMAKE_OSX_DEPLOYMENT_TARGET})
    else ()
        set(OPENDOCUMENTVIEWER_MACOS 12.0)
    endif ()
    configure_file(data/Info.plist.in
        ${CMAKE_CURRENT_BINARY_DIR}/Info.plist @ONLY)
    set_target_properties(opendocumentviewer-desktop PROPERTIES
        MACOSX_BUNDLE TRUE
        MACOSX_BUNDLE_INFO_PLIST ${CMAKE_CURRENT_BINARY_DIR}/Info.plist
        OUTPUT_NAME "OpenDocument Viewer")
endif ()

add_custom_target(product-opendocumentviewer-desktop
    DEPENDS opendocumentviewer-desktop)

# What a desktop needs to offer the viewer for a document: the entry names the
# nine types of the format, so that a file manager proposes it, and the icon is
# named after the entry, as the specification of the freedesktop asks.
include(GNUInstallDirs)
install(TARGETS opendocumentviewer-desktop
    BUNDLE DESTINATION .
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
# The entry of the desktop, the metadata of the store and the icon follow the
# specifications of the freedesktop: they are of the desktops of linux and of
# the unix alike, where macos and windows have their own ways.
if (UNIX AND NOT APPLE)
    install(FILES data/org.webodf.OpenDocumentViewer.desktop
        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/applications)
    # What a store of software reads of the program, that the tools of the
    # AppImage and of the flatpak ask for. The version is the one of the
    # build, in the three numbers a release carries.
    set(OPENDOCUMENTVIEWER_METAINFO_VERSION ${WEBODF_MANIFEST_VERSION})
    string(TIMESTAMP OPENDOCUMENTVIEWER_METAINFO_DATE "%Y-%m-%d" UTC)
    configure_file(data/org.webodf.OpenDocumentViewer.metainfo.xml.in
        ${CMAKE_CURRENT_BINARY_DIR}/org.webodf.OpenDocumentViewer.metainfo.xml
        @ONLY)
    install(FILES
        ${CMAKE_CURRENT_BINARY_DIR}/org.webodf.OpenDocumentViewer.metainfo.xml
        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/metainfo)
endif ()
if (UNIX AND NOT APPLE)
    install(FILES ${ICON}
        DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/icons/hicolor/128x128/apps
        RENAME org.webodf.OpenDocumentViewer.png)
endif ()

# The libraries of qt are gathered beside the program by the tool of the
# platform, "windeployqt" on windows and "macdeployqt" on macos, so that
# "cmake --install" writes a directory that runs on a machine without qt.
#
# On linux the program is installed among the files of the system, that carry
# qt already, and a package of the system names them, see "packaging.cmake":
# the tool would only write a "qt.conf" that points the program at a prefix of
# its own, which is wrong once the program is installed in "/usr". What runs
# without the qt of the system is a universal package, that carries it.
if (WIN32 OR APPLE)
    qt_generate_deploy_app_script(
        TARGET opendocumentviewer-desktop
        OUTPUT_SCRIPT OPENDOCUMENTVIEWER_DEPLOY
        NO_UNSUPPORTED_PLATFORM_ERROR
    )
    install(SCRIPT ${OPENDOCUMENTVIEWER_DEPLOY})
endif ()

# The archives, the packages and the universal packages of the viewer.
include(${CMAKE_CURRENT_SOURCE_DIR}/packaging.cmake)

