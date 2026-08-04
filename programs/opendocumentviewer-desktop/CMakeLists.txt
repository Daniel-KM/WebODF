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
# window is the small one, that the extensions carry; the icon of windows is
# made from the large one, as a bar of tasks draws it at 256.
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

add_custom_target(product-opendocumentviewer-desktop
    DEPENDS opendocumentviewer-desktop)

# What a desktop needs to offer the viewer for a document: the entry names the
# nine types of the format, so that a file manager proposes it, and the icon is
# named after the entry, as the specification of the freedesktop asks.
include(GNUInstallDirs)
install(TARGETS opendocumentviewer-desktop
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(FILES data/org.webodf.OpenDocumentViewer.desktop
    DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/applications)
install(FILES ${ICON}
    DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/icons/hicolor/128x128/apps
    RENAME org.webodf.OpenDocumentViewer.png)

# The libraries of qt are gathered beside the program by the tool of the
# platform, "windeployqt" on windows and "macdeployqt" on macos, so that
# "cmake --install" writes a directory that runs on a machine without qt. On
# linux the program is installed among the files of the system, that carry
# them, and the tool does not exist: the script is then empty.
qt_generate_deploy_app_script(
    TARGET opendocumentviewer-desktop
    OUTPUT_SCRIPT OPENDOCUMENTVIEWER_DEPLOY
    NO_UNSUPPORTED_PLATFORM_ERROR
)
install(SCRIPT ${OPENDOCUMENTVIEWER_DEPLOY})
