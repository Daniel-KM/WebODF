# Docnosis tells whether a document keeps to the OpenDocument standard, by
# reading it against the schemas of Relax NG that OASIS publishes, which are
# beside it. It is a page and nothing else: the document is read in the browser
# of the one who asks, and it goes nowhere.
#
# It reads the library from its sources rather than from "webodf.js": the
# validator of Relax NG is left out of the file that ships, as no viewer uses
# it, see "scripts/lib/sources.js".

set(DOCNOSIS_DIR ${CMAKE_CURRENT_BINARY_DIR}/docnosis)

FILE(GLOB DOCNOSIS_SCHEMAS RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/*.rng)
FILE(GLOB DOCNOSIS_ICONS RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/*.png)

COPY_FILES(DOCNOSIS_FILES ${CMAKE_CURRENT_SOURCE_DIR} ${DOCNOSIS_DIR}
    index.html docnosis.js docnosis.css
    ${DOCNOSIS_SCHEMAS} ${DOCNOSIS_ICONS})

# The sources of the library, under "lib", where the page looks for them. They
# are gathered here rather than taken from LIBJSFILES, that is only known in
# the directory of the library and in the ones below it.
FILE(GLOB_RECURSE DOCNOSIS_LIBFILES RELATIVE ${CMAKE_SOURCE_DIR}/webodf
    ${CMAKE_SOURCE_DIR}/webodf/lib/*.js)
COPY_FILES(DOCNOSIS_FILES ${CMAKE_SOURCE_DIR}/webodf ${DOCNOSIS_DIR}
    ${DOCNOSIS_LIBFILES} lib/manifest.json)

add_custom_target(build-docnosis ALL DEPENDS manifest.json-target
    ${DOCNOSIS_FILES})

add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/docnosis-${WEBODF_VERSION}.zip
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${DOCNOSIS_DIR}
        ${CMAKE_CURRENT_BINARY_DIR}/docnosis-${WEBODF_VERSION}.zip
    DEPENDS ${NODE} ${TOOLS_DIR}/zipdir.js ${DOCNOSIS_FILES}
)
add_custom_target(product-docnosis
    DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/docnosis-${WEBODF_VERSION}.zip)
