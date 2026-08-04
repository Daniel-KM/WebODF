# The files that go into the extension, copied as they are. "webodf.js" comes
# from the build and the manifest carries the version, see below.
set(FIREFOXEXTENSIONFILES
    background.js
    background-chrome.js
    viewer.html
    viewer.css
    viewer.js
    skin/default/icon.png
)

configure_file(manifest-v3.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-v3.json)
configure_file(manifest-v2.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-v2.json)
configure_file(manifest-chrome.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-chrome.json)

# Pack the add-on from one of the three manifests. The viewer is the same in
# all of them: only the way the documents reach it differs, and Chrome takes
# a file of rules rather than a script, see "README-Products.md".
macro(PACK_FIREFOX_EXTENSION xpi dir manifest extra)
    add_custom_command(
        OUTPUT ${xpi}
        COMMAND ${CMAKE_COMMAND} -E remove_directory ${dir}
        COMMAND ${CMAKE_COMMAND} -E make_directory ${dir}/skin/default
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_BINARY_DIR}/${manifest} ${dir}/manifest.json
        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/webodf/webodf.js ${dir}
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_SOURCE_DIR}/viewer.html
            ${CMAKE_CURRENT_SOURCE_DIR}/viewer.css
            ${CMAKE_CURRENT_SOURCE_DIR}/viewer.js
            ${CMAKE_CURRENT_SOURCE_DIR}/${extra}
            ${dir}
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_SOURCE_DIR}/skin/default/icon.png
            ${dir}/skin/default
        # An xpi is a zip whose manifest.json sits at its root.
        COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
            ${dir}
            ${xpi}
            notopdir
        DEPENDS ${NODE}
            ${TOOLS_DIR}/zipdir.js
            ${FIREFOXEXTENSIONFILES}
            webodf.js-target
            ${CMAKE_CURRENT_BINARY_DIR}/${manifest}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )
endmacro()

PACK_FIREFOX_EXTENSION(${FIREFOX_EXTENSION_ODFVIEWER}
    ${FIREFOX_EXTENSION_ODFVIEWER_DIR} manifest-v3.json background.js)
PACK_FIREFOX_EXTENSION(${FIREFOX_EXTENSION_ODFVIEWER_MV2}
    ${FIREFOX_EXTENSION_ODFVIEWER_MV2_DIR} manifest-v2.json background.js)
PACK_FIREFOX_EXTENSION(${CHROME_EXTENSION_ODFVIEWER}
    ${CHROME_EXTENSION_ODFVIEWER_DIR} manifest-chrome.json background-chrome.js)

add_custom_target(build-firefoxextension
    DEPENDS ${FIREFOX_EXTENSION_ODFVIEWER} ${FIREFOX_EXTENSION_ODFVIEWER_MV2}
        ${CHROME_EXTENSION_ODFVIEWER})

add_custom_target(test-firefoxextension DEPENDS webodf.js-tests)

add_custom_target(product-firefoxextension DEPENDS build-firefoxextension test-firefoxextension)
