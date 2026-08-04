# The files that go into the extension, copied as they are. "webodf.js" comes
# from the build and "manifest.json" carries the version, see below.
set(FIREFOXEXTENSIONFILES
    background.js
    viewer.html
    viewer.css
    viewer.js
    skin/default/icon.png
)
configure_file(manifest.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest.json)

add_custom_command(
    OUTPUT ${FIREFOX_EXTENSION_ODFVIEWER}
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${FIREFOX_EXTENSION_ODFVIEWER_DIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${FIREFOX_EXTENSION_ODFVIEWER_DIR}/skin/default
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/manifest.json ${FIREFOX_EXTENSION_ODFVIEWER_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/webodf/webodf.js ${FIREFOX_EXTENSION_ODFVIEWER_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy
        ${CMAKE_CURRENT_SOURCE_DIR}/background.js
        ${CMAKE_CURRENT_SOURCE_DIR}/viewer.html
        ${CMAKE_CURRENT_SOURCE_DIR}/viewer.css
        ${CMAKE_CURRENT_SOURCE_DIR}/viewer.js
        ${FIREFOX_EXTENSION_ODFVIEWER_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy
        ${CMAKE_CURRENT_SOURCE_DIR}/skin/default/icon.png
        ${FIREFOX_EXTENSION_ODFVIEWER_DIR}/skin/default
    # An xpi is a zip whose manifest.json sits at its root.
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${FIREFOX_EXTENSION_ODFVIEWER_DIR}
        ${FIREFOX_EXTENSION_ODFVIEWER}
        notopdir
    DEPENDS ${NODE}
        ${TOOLS_DIR}/zipdir.js
        ${FIREFOXEXTENSIONFILES}
        webodf.js-target
        ${CMAKE_CURRENT_BINARY_DIR}/manifest.json
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)

add_custom_target(build-firefoxextension DEPENDS ${FIREFOX_EXTENSION_ODFVIEWER})

add_custom_target(test-firefoxextension DEPENDS webodf.js-tests)

add_custom_target(product-firefoxextension DEPENDS build-firefoxextension test-firefoxextension)
