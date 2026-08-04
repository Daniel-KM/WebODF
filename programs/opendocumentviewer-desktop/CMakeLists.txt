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
# here, and it names the window and the entry of the desktop.
set(ICON ${CMAKE_CURRENT_SOURCE_DIR}/../opendocumentviewer-webext/skin/default/icon.png)
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
