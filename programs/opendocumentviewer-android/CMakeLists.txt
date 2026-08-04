# The viewer of OpenDocument for android is a web view that shows a document
# with WebODF. It replaces the one of programs/cordova, that drove cordova 3.5,
# of 2014, and built with ant, which google dropped in 2015 for gradle.
#
# It is opt-in, as it needs the sdk of android and a jdk, that the build does
# not download. The sdk is found from -DANDROID_SDK, from $ANDROID_HOME or
# $ANDROID_SDK_ROOT, or where a sdk is usually installed, see below.
option(WEBODF_ANDROID "Build the viewer of OpenDocument for android, that needs its sdk" OFF)

if (WEBODF_ANDROID)
    # The sdk is looked for here rather than left to gradle, that only says so
    # once it has resolved the plugin and started the tasks of android. It is
    # read from -DANDROID_SDK, from the environment, from a "local.properties"
    # that is already there, or from the two places a sdk is usually installed
    # in, and it is written into the cache: a build is configured once and
    # made many times, often from another shell, where the environment of the
    # first one is gone.
    if (NOT ANDROID_SDK)
        if (DEFINED ENV{ANDROID_HOME})
            set(ANDROID_SDK $ENV{ANDROID_HOME})
        elseif (DEFINED ENV{ANDROID_SDK_ROOT})
            set(ANDROID_SDK $ENV{ANDROID_SDK_ROOT})
        elseif (EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/local.properties)
            file(STRINGS ${CMAKE_CURRENT_SOURCE_DIR}/local.properties SDK_LINE
                REGEX "^sdk\\.dir=")
            string(REPLACE "sdk.dir=" "" ANDROID_SDK "${SDK_LINE}")
        else ()
            foreach (dir "$ENV{HOME}/Android/Sdk" "/usr/lib/android-sdk")
                if (IS_DIRECTORY ${dir}/platforms)
                    set(ANDROID_SDK ${dir})
                    break()
                endif()
            endforeach()
        endif()
    endif()

    if (NOT IS_DIRECTORY "${ANDROID_SDK}/platforms")
        message(FATAL_ERROR
            "The sdk of android was not found, so the viewer cannot be built."
            " Configure with -DANDROID_SDK=/path/to/sdk, or export ANDROID_HOME"
            " with the directory it is installed in, in the same command as"
            " cmake: \"ANDROID_HOME=/path/to/sdk cmake ...\", with no semicolon"
            " between the two, as a variable that is set apart is not passed on."
            " The command line tools that install the sdk are at"
            " https://developer.android.com/studio#command-tools, and the"
            " packages the build needs are \"platforms;android-36\" and"
            " \"build-tools;36.0.0\".")
    endif()

    set(ANDROID_SDK ${ANDROID_SDK} CACHE PATH "The directory the sdk of android is installed in")

    # Gradle reads the sdk from this file, that is written here rather than by
    # hand, so that "make" needs no environment of its own.
    file(WRITE ${CMAKE_CURRENT_SOURCE_DIR}/local.properties
        "# Written by cmake, see \"CMakeLists.txt\": configure with\n"
        "# -DANDROID_SDK=/path/to/sdk to change it.\n"
        "sdk.dir=${ANDROID_SDK}\n")
    message(STATUS "Android sdk found: ${ANDROID_SDK}")

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

    # The two pages that tell what the format is worth hold a text that is
    # written once, see "INSERT_TEXT" in the CMakeLists of the root. They are
    # written among the assets, as the library is: gradle reads them from there.
    foreach (LANGUAGE en fr)
        INSERT_TEXT(${CMAKE_CURRENT_SOURCE_DIR}/about.${LANGUAGE}.html.in
            ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/about.${LANGUAGE}.html
            ${LANGUAGE})
    endforeach ()

    set(OPENDOCUMENTVIEWER_ANDROID_SOURCES
        ${CMAKE_CURRENT_SOURCE_DIR}/build.gradle
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/AndroidManifest.xml
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/java/org/webodf/viewer/ViewerActivity.java
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.html
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.js
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/index.css
        ${CMAKE_CURRENT_SOURCE_DIR}/about.en.html.in
        ${CMAKE_CURRENT_SOURCE_DIR}/about.fr.html.in
        ${CMAKE_CURRENT_SOURCE_DIR}/src/main/assets/about.css)

    # Two apk are built from the same sources. The one of the release is not
    # signed, as only its author may sign it; the one of the debug is, with
    # the key gradle writes for that, so that it installs on a device or in an
    # emulator without anything else, see "README-Products.md".
    macro(BUILD_OPENDOCUMENTVIEWER_ANDROID apk task)
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
            DEPENDS webodf.js-target Gradle ${OPENDOCUMENTVIEWER_ANDROID_SOURCES}
            WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
        )
    endmacro()

    set(OPENDOCUMENTVIEWER_ANDROID_APK
        ${CMAKE_CURRENT_BINARY_DIR}/build/outputs/apk/release/opendocumentviewer-android-release-unsigned.apk)
    set(OPENDOCUMENTVIEWER_ANDROID_APK_DEBUG
        ${CMAKE_CURRENT_BINARY_DIR}/build/outputs/apk/debug/opendocumentviewer-android-debug.apk)

    BUILD_OPENDOCUMENTVIEWER_ANDROID(${OPENDOCUMENTVIEWER_ANDROID_APK} assembleRelease)
    BUILD_OPENDOCUMENTVIEWER_ANDROID(${OPENDOCUMENTVIEWER_ANDROID_APK_DEBUG} assembleDebug)

    add_custom_target(product-opendocumentviewer-android DEPENDS ${OPENDOCUMENTVIEWER_ANDROID_APK})
    add_custom_target(opendocumentviewer-android-debug DEPENDS ${OPENDOCUMENTVIEWER_ANDROID_APK_DEBUG})
endif ()
