# The files that go into the extension, copied as they are. "webodf.js" comes
# from the build and the manifest carries the version, see below.
set(OPENDOCUMENTVIEWER_WEBEXT_FILES
    background.js
    background-chrome.js
    background-thunderbird.js
    viewer.html
    viewer.css
    viewer.js
    welcome.html
    welcome-open.js
    welcome-browser.en.html.in
    welcome-browser.fr.html.in
    welcome-thunderbird.en.html.in
    welcome-thunderbird.fr.html.in
    welcome.css
    welcome.js
    skin/default/icon.png
    _locales/en/messages.json
    _locales/fr/messages.json
)

# The page of the welcome comes in two: what is to be done to read a document
# is not the same in a browser, where a link is enough, as in Thunderbird, where
# an attachment is opened from its menu. Each package carries the one of its own
# under the same name, and both hold the text of the format, that is written
# once, see "INSERT_TEXT" in the CMakeLists of the root.
foreach (FLAVOUR browser thunderbird)
    foreach (LANGUAGE en fr)
        INSERT_TEXT(welcome-${FLAVOUR}.${LANGUAGE}.html.in
            ${CMAKE_CURRENT_BINARY_DIR}/welcome-${FLAVOUR}.${LANGUAGE}.html
            ${LANGUAGE})
    endforeach ()
endforeach ()

configure_file(manifest-v3.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-v3.json)
configure_file(manifest-v2.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-v2.json)
configure_file(manifest-chrome.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-chrome.json)
configure_file(manifest-thunderbird-v3.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-thunderbird-v3.json)
configure_file(manifest-thunderbird-v2.json.in ${CMAKE_CURRENT_BINARY_DIR}/manifest-thunderbird-v2.json)

# Pack the add-on from one of the five manifests. The viewer is the same in
# all of them: only the way the documents reach it differs, as Chrome takes a
# file of rules rather than a script, and Thunderbird reads an attachment of a
# message rather than a request, see "README-Products.md".
macro(PACK_OPENDOCUMENTVIEWER_WEBEXT xpi dir manifest extra flavour)
    add_custom_command(
        OUTPUT ${xpi}
        COMMAND ${CMAKE_COMMAND} -E remove_directory ${dir}
        COMMAND ${CMAKE_COMMAND} -E make_directory ${dir}
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_BINARY_DIR}/${manifest} ${dir}/manifest.json
        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/webodf/webodf.js ${dir}
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_SOURCE_DIR}/viewer.html
            ${CMAKE_CURRENT_SOURCE_DIR}/viewer.css
            ${CMAKE_CURRENT_SOURCE_DIR}/viewer.js
            ${CMAKE_CURRENT_SOURCE_DIR}/welcome.html
            ${CMAKE_CURRENT_SOURCE_DIR}/welcome-open.js
            ${CMAKE_CURRENT_SOURCE_DIR}/welcome.css
            ${CMAKE_CURRENT_SOURCE_DIR}/welcome.js
            ${CMAKE_CURRENT_SOURCE_DIR}/${extra}
            ${dir}
        # The whole of the skin is copied, as the pictures of the page of the
        # welcome sit beside the icon, one for each language they are taken in.
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_BINARY_DIR}/welcome-${flavour}.en.html
            ${dir}/welcome.en.html
        COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_BINARY_DIR}/welcome-${flavour}.fr.html
            ${dir}/welcome.fr.html
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            ${CMAKE_CURRENT_SOURCE_DIR}/skin ${dir}/skin
        # The words of the menus, one file for each language.
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            ${CMAKE_CURRENT_SOURCE_DIR}/_locales ${dir}/_locales
        # An xpi is a zip whose manifest.json sits at its root.
        COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
            ${dir}
            ${xpi}
            notopdir
        DEPENDS ${NODE}
            ${TOOLS_DIR}/zipdir.js
            ${OPENDOCUMENTVIEWER_WEBEXT_FILES}
            webodf.js-target
            ${CMAKE_CURRENT_BINARY_DIR}/${manifest}
            ${CMAKE_CURRENT_BINARY_DIR}/welcome-${flavour}.en.html
            ${CMAKE_CURRENT_BINARY_DIR}/welcome-${flavour}.fr.html
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )
endmacro()

PACK_OPENDOCUMENTVIEWER_WEBEXT(${OPENDOCUMENTVIEWER_FIREFOX}
    ${OPENDOCUMENTVIEWER_FIREFOX_DIR} manifest-v3.json background.js browser)
PACK_OPENDOCUMENTVIEWER_WEBEXT(${OPENDOCUMENTVIEWER_FIREFOX_MV2}
    ${OPENDOCUMENTVIEWER_FIREFOX_MV2_DIR} manifest-v2.json background.js browser)
PACK_OPENDOCUMENTVIEWER_WEBEXT(${OPENDOCUMENTVIEWER_CHROME}
    ${OPENDOCUMENTVIEWER_CHROME_DIR} manifest-chrome.json background-chrome.js
    browser)
PACK_OPENDOCUMENTVIEWER_WEBEXT(${OPENDOCUMENTVIEWER_THUNDERBIRD}
    ${OPENDOCUMENTVIEWER_THUNDERBIRD_DIR} manifest-thunderbird-v3.json
    background-thunderbird.js thunderbird)
PACK_OPENDOCUMENTVIEWER_WEBEXT(${OPENDOCUMENTVIEWER_THUNDERBIRD_MV2}
    ${OPENDOCUMENTVIEWER_THUNDERBIRD_MV2_DIR} manifest-thunderbird-v2.json
    background-thunderbird.js thunderbird)

add_custom_target(build-opendocumentviewer-webext
    DEPENDS ${OPENDOCUMENTVIEWER_FIREFOX} ${OPENDOCUMENTVIEWER_FIREFOX_MV2}
        ${OPENDOCUMENTVIEWER_CHROME})

add_custom_target(test-opendocumentviewer-webext DEPENDS webodf.js-tests)

add_custom_target(product-opendocumentviewer-webext DEPENDS build-opendocumentviewer-webext test-opendocumentviewer-webext)

# The add-on of Thunderbird is packed from the same files, and is a product of
# its own, as it is published on addons.thunderbird.net and not on AMO.
add_custom_target(build-opendocumentviewer-thunderbird
    DEPENDS ${OPENDOCUMENTVIEWER_THUNDERBIRD} ${OPENDOCUMENTVIEWER_THUNDERBIRD_MV2})

add_custom_target(test-opendocumentviewer-thunderbird DEPENDS webodf.js-tests)

add_custom_target(product-opendocumentviewer-thunderbird DEPENDS build-opendocumentviewer-thunderbird test-opendocumentviewer-thunderbird)
