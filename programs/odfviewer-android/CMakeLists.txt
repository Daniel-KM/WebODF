# The viewer of OpenDocument for android is a web view that shows a document with WebODF. It
# replaces the one of programs/cordova, that drove cordova 3.5, of 2014, and
# built with ant, which google dropped in 2015 for gradle.
#
# It is opt-in, as it needs the sdk of android and a jdk, that the build does
# not download: gradle reads the sdk from $ANDROID_HOME, the directory the sdk
# is installed in, or from "sdk.dir" of the file "local.properties".
option(WEBODF_ANDROID "Build the viewer of OpenDocument for android, that needs its sdk" OFF)

if (WEBODF_ANDROID)
    # The sdk is looked for here rather than left to gradle, that only says so
    # once it has resolved the plugin and started the tasks of android.
    if (NOT DEFINED ENV{ANDROID_HOME}
            AND NOT EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/local.properties)
        message(FATAL_ERROR
            "The sdk of android was not found, so the viewer cannot be built."
            " Export ANDROID_HOME with the directory it is installed in, or write"
            " \"sdk.dir=/path/to/sdk\" in"
            " ${CMAKE_CURRENT_SOURCE_DIR}/local.properties."
            " The command line tools that install it are at"
            " https://developer.android.com/studio#command-tools, and the"
            " packages the build needs are \"platforms;android-36\" and"
            " \"build-tools;36.0.0\".")
    endif()

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

    set(ODFVIEWER_ANDROID_SOURCES
        ${CMAKE_CURRENT_SOURCE_DIR}/build.gradle
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/AndroidManifest.xml
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/java/org/webodf/viewer/ViewerActivity.java
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.html
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.js
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.css)

    # Two apk are built from the same sources. The one of the release is not
    # signed, as only its author may sign it; the one of the debug is, with
    # the key gradle writes for that, so that it installs on a device or in an
    # emulator without anything else, see "README-Products.md".
    macro(BUILD_ODFVIEWER_ANDROID apk task)
        add_custom_command(
            OUTPUT ${apk}
            # The library is read from the assets, as the page is.
            COMMAND ${CMAKE_COMMAND} -E copy
                ${CMAKE_BINARY_DIR}/webodf/webodf.js
                ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/webodf.js
            COMMAND ${GRADLE} --project-dir ${CMAKE_CURRENT_SOURCE_DIR}
                --project-cache-dir ${CMAKE_CURRENT_BINARY_DIR}/.gradle
                -PwebodfVersion=${WEBODF_MANIFEST_VERSION}
                -PbuildDir=${CMAKE_CURRENT_BINARY_DIR}/build
                ${task}
            DEPENDS webodf.js-target Gradle ${ODFVIEWER_ANDROID_SOURCES}
            WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
        )
    endmacro()

    set(ODFVIEWER_ANDROID_APK
        ${CMAKE_CURRENT_BINARY_DIR}/build/outputs/apk/release/odfviewer-android-release-unsigned.apk)
    set(ODFVIEWER_ANDROID_APK_DEBUG
        ${CMAKE_CURRENT_BINARY_DIR}/build/outputs/apk/debug/odfviewer-android-debug.apk)

    BUILD_ODFVIEWER_ANDROID(${ODFVIEWER_ANDROID_APK} assembleRelease)
    BUILD_ODFVIEWER_ANDROID(${ODFVIEWER_ANDROID_APK_DEBUG} assembleDebug)

    add_custom_target(product-odfviewer-android DEPENDS ${ODFVIEWER_ANDROID_APK})
    add_custom_target(odfviewer-android-debug DEPENDS ${ODFVIEWER_ANDROID_APK_DEBUG})
endif ()
