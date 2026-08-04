# The viewer of android is a web view that shows a document with WebODF. It
# replaces the one of programs/cordova, that drove cordova 3.5, of 2014, and
# built with ant, which google dropped in 2015 for gradle.
#
# It is opt-in, as it needs the sdk of android and a jdk, that the build does
# not download: gradle reads the sdk from $ANDROID_HOME, or from the file
# "local.properties" that the sdk writes.
option(WEBODF_ANDROID "Build the viewer of android, that needs its sdk" OFF)

if (WEBODF_ANDROID)
    find_program(GRADLE NAMES gradle DOC "Path to the Gradle executable.")
    if (NOT GRADLE)
        message(FATAL_ERROR "gradle was not found, so the viewer of android"
            " cannot be built. On Debian: apt-get install gradle")
    endif()

    set(ANDROIDVIEWER_APK
        ${CMAKE_CURRENT_BINARY_DIR}/build/outputs/apk/release/androidviewer-release-unsigned.apk)

    add_custom_command(
        OUTPUT ${ANDROIDVIEWER_APK}
        # The library is read from the assets, as the page is.
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_BINARY_DIR}/webodf/webodf.js
            ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/webodf.js
        COMMAND ${GRADLE} --project-dir ${CMAKE_CURRENT_SOURCE_DIR}
            --project-cache-dir ${CMAKE_CURRENT_BINARY_DIR}/.gradle
            -PwebodfVersion=${WEBODF_MANIFEST_VERSION}
            -PbuildDir=${CMAKE_CURRENT_BINARY_DIR}/build
            assembleRelease
        DEPENDS webodf.js-target
            ${CMAKE_CURRENT_SOURCE_DIR}/build.gradle
            ${CMAKE_CURRENT_SOURCE_DIR}/src/main/AndroidManifest.xml
            ${CMAKE_CURRENT_SOURCE_DIR}/src/main/java/org/webodf/viewer/ViewerActivity.java
            ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.html
            ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.js
            ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.css
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )

    add_custom_target(product-androidviewer DEPENDS ${ANDROIDVIEWER_APK})
endif ()
