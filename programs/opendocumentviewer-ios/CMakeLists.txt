# The viewer of OpenDocument for iOS is a web view of the system, WKWebView,
# around the same page and the same library as the viewer for android: Apple
# allows no other engine on iOS, so a viewer there is the shell of one, and the
# shell alone is written in Swift, see "Sources".
#
# Cmake gathers what the application carries, in "Resources", and the
# application itself is built by Xcode, on a mac, see "README-Products.md":
# nothing else builds an application of iOS.
option(WEBODF_IOS "Gather what the viewer of OpenDocument for iOS carries" OFF)

if (WEBODF_IOS)
    set(IOS_RESOURCES ${CMAKE_CURRENT_SOURCE_DIR}/Resources)
    set(ANDROID_ASSETS
        ${CMAKE_CURRENT_SOURCE_DIR}/../opendocumentviewer-android/src/main/assets)

    # The page of the viewer is the one of android, word for word: the two read
    # a document the same way, and a page that differed would be a second one to
    # keep in step.
    COPY_FILES(OPENDOCUMENTVIEWER_IOS_FILES ${ANDROID_ASSETS} ${IOS_RESOURCES}
        index.html index.css index.js about.css)
    COPY_FILES(OPENDOCUMENTVIEWER_IOS_FILES ${CMAKE_BINARY_DIR}/webodf
        ${IOS_RESOURCES} webodf.js)

    # The pages that tell what the format is worth hold a text that is written
    # once, see "INSERT_TEXT" in the CMakeLists of the root.
    foreach (LANGUAGE en fr)
        INSERT_TEXT(
            ${CMAKE_CURRENT_SOURCE_DIR}/../opendocumentviewer-android/about.${LANGUAGE}.html.in
            ${IOS_RESOURCES}/about.${LANGUAGE}.html ${LANGUAGE})
    endforeach ()

    add_custom_target(product-opendocumentviewer-ios
        DEPENDS webodf.js-target ${OPENDOCUMENTVIEWER_IOS_FILES})
endif ()
