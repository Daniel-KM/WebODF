
# Two products are packed here, and neither builds any more, see
# "README-Products.md". They are kept until they are either brought up to date
# or dropped: cordova only wraps "webodf.js" in a web view, so what has to be
# written again is the packaging, not anything of WebODF.
#
# product-firefoxosviewer packs the viewer for Firefox OS, that Mozilla
# abandoned in 2016, but that lives on through its forks, B2G OS, KaiOS and
# Capyloon. It does not build any more: cordova 3.5, of 2014, is asked for
# below.
#
# The apk of android was packed here as well, and is built by
# programs/androidviewer now.

configure_file(config.xml.in config.xml)
configure_file(manifest.webapp.in manifest.webapp)

#set(CORDOVA_FILES WebODF/config.xml)

# install cordova in the top level node_modules directory
set(CORDOVA ${CMAKE_BINARY_DIR}/node_modules/cordova/bin/cordova)
add_custom_command(
    OUTPUT ${CORDOVA}
    COMMAND ${NPM} ARGS install cordova@3.5
    DEPENDS copy_node_modules
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
)
# create a project folder for WebODF cordova
add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/WebODF/hooks/README.md
    COMMAND ${CMAKE_COMMAND} ARGS -E remove_directory ${CMAKE_CURRENT_BINARY_DIR}/WebODF
    COMMAND ${CORDOVA} create WebODF org.webodf WebODF --copy-from ${CMAKE_CURRENT_SOURCE_DIR}/www
    DEPENDS ${CORDOVA}
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
)
# add the desired plugins
add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/WebODF/plugins/org.apache.cordova.file/plugin.xml
    COMMAND ${CORDOVA} plugins add org.apache.cordova.file
    COMMAND ${CORDOVA} plugins add ${CMAKE_CURRENT_SOURCE_DIR}/plugins/org.webodf.starturl
    DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/WebODF/hooks/README.md
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/WebODF
)
# add the android platforms to the WebODF cordova folder
add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/WebODF/plugins/android.json
    COMMAND ${CORDOVA} platform add android
    DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/WebODF/plugins/org.apache.cordova.file/plugin.xml
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/WebODF
)
# add the firefoxos platforms to the WebODF cordova folder
add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/WebODF/plugins/firefoxos.json
    COMMAND ${CORDOVA} platform add firefoxos
    DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/WebODF/plugins/org.apache.cordova.file/plugin.xml
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/WebODF
)
add_custom_command(
    OUTPUT WebODF/merges/config.xml
    COMMAND ${CMAKE_COMMAND} ARGS -E remove_directory ${CMAKE_CURRENT_BINARY_DIR}/WebODF/www
    COMMAND ${CMAKE_COMMAND} ARGS -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/www ${CMAKE_CURRENT_BINARY_DIR}/WebODF/www
    COMMAND ${CMAKE_COMMAND} ARGS -E remove_directory ${CMAKE_CURRENT_BINARY_DIR}/WebODF/merges
    COMMAND ${CMAKE_COMMAND} ARGS -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/merges ${CMAKE_CURRENT_BINARY_DIR}/WebODF/merges
    COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different ${CMAKE_CURRENT_BINARY_DIR}/config.xml ${CMAKE_CURRENT_BINARY_DIR}/WebODF/merges
    COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different ${CMAKE_CURRENT_BINARY_DIR}/manifest.webapp ${CMAKE_CURRENT_BINARY_DIR}/WebODF/merges/firefoxos/manifest.webapp
    COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different ${CMAKE_BINARY_DIR}/webodf/webodf.js ${CMAKE_CURRENT_BINARY_DIR}/WebODF/www/webodf.js
    DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/WebODF/hooks/README.md
            config.xml.in manifest.webapp.in
            webodf.js-target
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/WebODF
)


# build the firefoxos package
add_custom_command(
    OUTPUT WebODF/platforms/firefoxos/build/package.zip
    COMMAND ${CORDOVA} build firefoxos
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${CMAKE_CURRENT_BINARY_DIR}/WebODF/platforms/firefoxos/www/
        ${CMAKE_CURRENT_BINARY_DIR}/WebODF/platforms/firefoxos/build/package.zip
        notopdir
    DEPENDS WebODF/merges/config.xml
            ${CMAKE_CURRENT_BINARY_DIR}/WebODF/plugins/firefoxos.json
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/WebODF
)

add_custom_target(product-firefoxosviewer DEPENDS WebODF/platforms/firefoxos/build/package.zip)
