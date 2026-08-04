# The viewer of android is a web view that shows a document with WebODF. It
# replaces the one of programs/cordova, that drove cordova 3.5, of 2014, and
# built with ant, which google dropped in 2015 for gradle.
#
# It is opt-in, as it needs the sdk of android and a jdk, that the build does
# not download: gradle reads the sdk from $ANDROID_HOME, the directory the sdk
# is installed in, or from "sdk.dir" of the file "local.properties".
option(WEBODF_ANDROID "Build the viewer of android, that needs its sdk" OFF)

if (WEBODF_ANDROID)
    # Gradle is downloaded, as the closure compiler and Rhino are: Debian 13
    # packages the 4.4.1 of 2017, where the plugin of android asks for a 9,
    # so the one of the distribution is never the right one. The version is
    # the oldest line the plugin accepts, 9.5, rather than the newest: the plugin
    # says which one it needs when it is applied, and refuses to run below it.
    set(GRADLE_VERSION 9.5.1)
    ExternalProject_Add(
        Gradle
        DOWNLOAD_DIR ${EXTERNALS_DOWNLOAD_DIR}
        URL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip"
        URL_HASH SHA256=bafc141b619ad6350fd975fc903156dd5c151998cc8b058e8c1044ab5f7b031f
        CONFIGURE_COMMAND ""
        BUILD_COMMAND ""
        INSTALL_COMMAND ""
    )
    set(GRADLE ${CMAKE_CURRENT_BINARY_DIR}/Gradle-prefix/src/Gradle/bin/gradle)

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
        DEPENDS webodf.js-target Gradle
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
