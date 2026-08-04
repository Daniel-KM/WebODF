SET(COMMON_EDITOR_FILES
    Tools.js
    avatar-joe.png
    EditorSession.js
    Translator.js
    FullWindowZoomHelper.js
    wodotexteditor.css
)

SET(ALONE_EDITOR_ONLY_FILES
    wodotexteditor.js
    images/kogmbh.png
    images/webodf.png
    images/saveas.png
)
SET(ALONE_EDITOR_EXAMPLE_FILES
    FileSaver.js
    localfileeditor.js
    localeditor.html
    revieweditor.js
    revieweditor.html
    texteditor.html
    welcome.odt
)
SET(ALONE_EDITOR_FILES
    ${COMMON_EDITOR_FILES}
    ${ALONE_EDITOR_ONLY_FILES}
)

SET(COMMON_COLLAB_FILES
    SessionListView.js
    MemberListView.js
    wodocollabpane.css
    wodocollabtexteditor.js
)

SET(PULLBOXCOLLAB_EDITOR_ONLY_FILES
    collabeditor.html
    pullboxeditor.js
    document-save.png
    network-disconnect.png
    vcs-locally-modified.png
)

SET(SPLIT_SCREEN_EDITOR_ONLY_FILES
    splitscreeneditor.css
    splitscreeneditor.js
    splitscreeneditor.html
    welcome.odt
    avatar-peggy.png
    document-save.png
    network-disconnect.png
    vcs-locally-modified.png
)

# creates a copy of the compiled webodf.js in the editor build dir
add_custom_target(editor-webodf.js-target
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/webodf/webodf.js .
)
add_dependencies(editor-webodf.js-target webodf.js-target)


####################
## Dojo amalgamation
####################

SET(DOJO_DEPS ${CMAKE_CURRENT_BINARY_DIR}/dojo-deps)

add_custom_command(
    OUTPUT dojo-amalgamation.js

    # from our sources
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/dojo-deps/ dojo-deps/

    # from dojo download (DEPENDS Dojo), one package for each directory
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO_CORE}/ dojo-deps/src/dojo/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO_DIJIT}/ dojo-deps/src/dijit/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO_DOJOX}/ dojo-deps/src/dojox/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${DOJO_UTIL}/ dojo-deps/src/util/

    # now do the dojo magic...
    COMMAND ${NODE} ${DOJO_DEPS}/src/dojo/dojo.js load=build
        --require ${DOJO_DEPS}/src/app/run.js
        --profile ${DOJO_DEPS}/profiles/app.profile.js
        --releaseDir ${DOJO_DEPS}/dist

    COMMAND ${CMAKE_COMMAND} -E make_directory dojo/

    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/dojo/dojo.js dojo/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dojo/resources/ dojo/resources/

    COMMAND ${CMAKE_COMMAND} -E make_directory app/resources/
    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/app/resources/app.css app/resources/

    COMMAND ${CMAKE_COMMAND} -E make_directory dijit/
    COMMAND ${CMAKE_COMMAND} -E make_directory dijit/themes
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dijit/themes/a11y/ dijit/themes/a11y/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dijit/themes/claro/ dijit/themes/claro/
    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/dijit/themes/dijit.css dijit/themes/dijit.css
    COMMAND ${CMAKE_COMMAND} -E copy dojo-deps/dist/dijit/themes/dijit_rtl.css dijit/themes/dijit_rtl.css
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dijit/icons/ dijit/icons/

    COMMAND ${CMAKE_COMMAND} -E make_directory dojox/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dojox/layout/resources/ dojox/layout/resources/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo-deps/dist/dojox/widget/ColorPicker/ dojox/widget/ColorPicker/

    COMMAND ${NODE} ${CMAKE_SOURCE_DIR}/webodf/tools/dojoNlsCompile.js dojo-deps/dist de fr nl it eu > dojobundle.js

    COMMAND ${NODE} ${CMAKE_CURRENT_SOURCE_DIR}/libexec/mergeIntoDojo.js dojobuild=${DOJO_DEPS}/dist/dojo/dojo.js dojobundle.js > dojo-amalgamation.js

    # cleanup
    # COMMAND ${CMAKE_COMMAND} -E remove_directory dojo-deps/dist

    DEPENDS ${NODE} Dojo
)

####################
## Dojo amalgamation
####################

add_custom_target(more-common-editorfiles-target
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/resources/ resources/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/translations/ translations/
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/widgets/ widgets/
)

##################
## Wodo.TextEditor
##################

set(OPENDOCUMENTTEXTEDITORDOC_BUILDDIR  ${OPENDOCUMENTTEXTEDITORBUILDDIR}/docs)
set(OPENDOCUMENTTEXTEDITORCODE_BUILDDIR ${OPENDOCUMENTTEXTEDITORBUILDDIR}/wodotexteditor)

add_custom_command(
    OUTPUT ${OPENDOCUMENTTEXTEDITORBUILDDIR}
    # clean up output dir
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${OPENDOCUMENTTEXTEDITORBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${OPENDOCUMENTTEXTEDITORBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}

    COMMAND ${CMAKE_COMMAND} -E copy webodf.js ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}

    COMMAND ${CMAKE_COMMAND} -E copy_directory resources/ ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/resources/
    COMMAND ${CMAKE_COMMAND} -E copy_directory translations/ ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/translations/
    COMMAND ${CMAKE_COMMAND} -E copy_directory widgets/ ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/widgets/

    # dojo compiled
    COMMAND ${CMAKE_COMMAND} -E copy dojo-amalgamation.js ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}

    # more dojo (data) files
    COMMAND ${CMAKE_COMMAND} -E make_directory ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/dojo
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo/resources ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/dojo/resources
    COMMAND ${CMAKE_COMMAND} -E copy_directory app/ ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/app/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dijit/ ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/dijit/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojox/ ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/dojox/

    COMMAND ${CMAKE_COMMAND} -E copy ${LIBJSLICENSEFILE} ${OPENDOCUMENTTEXTEDITORBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/HOWTO-wodotexteditor.md  ${OPENDOCUMENTTEXTEDITORBUILDDIR}/HOWTO.md

    DEPENDS dojo-amalgamation.js editor-webodf.js-target more-common-editorfiles-target
)

foreach(AE_FILE ${ALONE_EDITOR_FILES})
    set(AE_BUILDFILE ${OPENDOCUMENTTEXTEDITORCODE_BUILDDIR}/${AE_FILE})
    set(AE_FILE ${CMAKE_CURRENT_SOURCE_DIR}/${AE_FILE})
    add_custom_command(
      OUTPUT ${AE_BUILDFILE}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${AE_FILE}
        ${AE_BUILDFILE}
      DEPENDS
        ${AE_FILE} ${OPENDOCUMENTTEXTEDITORBUILDDIR}
    )
    list(APPEND OPENDOCUMENTTEXTEDITOR_BUILDFILES ${AE_BUILDFILE})
endforeach(AE_FILE)

foreach(AE_FILE ${ALONE_EDITOR_EXAMPLE_FILES})
    set(AE_BUILDFILE ${OPENDOCUMENTTEXTEDITORBUILDDIR}/${AE_FILE})
    set(AE_FILE ${CMAKE_CURRENT_SOURCE_DIR}/${AE_FILE})
    add_custom_command(
      OUTPUT ${AE_BUILDFILE}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${AE_FILE}
        ${AE_BUILDFILE}
      DEPENDS
        ${AE_FILE} ${OPENDOCUMENTTEXTEDITORBUILDDIR}
    )
    list(APPEND OPENDOCUMENTTEXTEDITOR_BUILDFILES ${AE_BUILDFILE})
endforeach(AE_FILE)

add_custom_target(opendocumenttexteditorbuilddir-target DEPENDS ${OPENDOCUMENTTEXTEDITORBUILDDIR} ${OPENDOCUMENTTEXTEDITOR_BUILDFILES})

add_custom_command(
    OUTPUT ${OPENDOCUMENTTEXTEDITORDOC_BUILDDIR}/index.html
    COMMAND ${NODE} ARGS ${CMAKE_SOURCE_DIR}/scripts/doc.js
        --output ${OPENDOCUMENTTEXTEDITORDOC_BUILDDIR}
        --source ${CMAKE_CURRENT_SOURCE_DIR}/wodotexteditor.js
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    DEPENDS ${NODE} opendocumenttexteditorbuilddir-target
        ${CMAKE_SOURCE_DIR}/scripts/doc.js
)
add_custom_target(opendocumenttexteditor-doc DEPENDS ${OPENDOCUMENTTEXTEDITORDOC_BUILDDIR}/index.html)

# package opendocumenttexteditor
set(OPENDOCUMENTTEXTEDITOR_ZIP opendocumenttexteditor-${WEBODF_VERSION}.zip)
add_custom_command(
    OUTPUT ${OPENDOCUMENTTEXTEDITOR_ZIP}
    # zip using javascript code running in node.js
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${OPENDOCUMENTTEXTEDITORBUILDDIR}
        ${CMAKE_BINARY_DIR}/${OPENDOCUMENTTEXTEDITOR_ZIP}
        notopdir
        opendocumenttexteditor-${WEBODF_VERSION}
    DEPENDS
        opendocumenttexteditorbuilddir-target
        opendocumenttexteditor-doc
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)
add_custom_target(build-opendocumenttexteditor DEPENDS ${OPENDOCUMENTTEXTEDITOR_ZIP})

add_custom_target(test-opendocumenttexteditor DEPENDS webodf.js-tests)

add_custom_target(product-opendocumenttexteditor DEPENDS build-opendocumenttexteditor test-opendocumenttexteditor)
# The zip is named without a path, so it is written where the build was
# started from, which is the root of the build and not this directory.
WEBODF_PRODUCT(product-opendocumenttexteditor
    ${CMAKE_BINARY_DIR}/${OPENDOCUMENTTEXTEDITOR_ZIP})


###########################
## Wodo.CollabTextEditor
###########################
# Needs more thinking still, interface not yet done

set(OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR ${OPENDOCUMENTTEXTCOLLABBUILDDIR}/wodo)

add_custom_command(
    OUTPUT ${OPENDOCUMENTTEXTCOLLABBUILDDIR}
    # clean up output dir
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${OPENDOCUMENTTEXTCOLLABBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${OPENDOCUMENTTEXTCOLLABBUILDDIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}

    COMMAND ${CMAKE_COMMAND} -E copy webodf.js ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}

    COMMAND ${CMAKE_COMMAND} -E copy_directory resources/ ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/resources/
    COMMAND ${CMAKE_COMMAND} -E copy_directory translations/ ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/translations/
    COMMAND ${CMAKE_COMMAND} -E copy_directory widgets/ ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/widgets/

    # dojo compiled
    COMMAND ${CMAKE_COMMAND} -E copy dojo-amalgamation.js ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}

    # more dojo (data) files
    COMMAND ${CMAKE_COMMAND} -E make_directory ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/dojo
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojo/resources ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/dojo/resources
    COMMAND ${CMAKE_COMMAND} -E copy_directory app/ ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/app/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dijit/ ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/dijit/
    COMMAND ${CMAKE_COMMAND} -E copy_directory dojox/ ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/dojox/

    COMMAND ${CMAKE_COMMAND} -E copy ${LIBJSLICENSEFILE} ${OPENDOCUMENTTEXTCOLLABBUILDDIR}

    DEPENDS dojo-amalgamation.js editor-webodf.js-target more-common-editorfiles-target
)

foreach(CE_FILE ${COMMON_COLLAB_FILES} ${COMMON_EDITOR_FILES})
    set(CE_BUILDFILE ${OPENDOCUMENTTEXTCOLLABCODE_BUILDDIR}/${CE_FILE})
    set(CE_FILE ${CMAKE_CURRENT_SOURCE_DIR}/${CE_FILE})
    add_custom_command(
      OUTPUT ${CE_BUILDFILE}
      COMMAND ${CMAKE_COMMAND} ARGS -E copy_if_different
        ${CE_FILE}
        ${CE_BUILDFILE}
      DEPENDS
        ${CE_FILE} ${OPENDOCUMENTTEXTCOLLABBUILDDIR}
    )
    list(APPEND OPENDOCUMENTTEXTCOLLAB_BUILDFILES ${CE_BUILDFILE})
endforeach(CE_FILE)

add_custom_target(opendocumenttextcollabbuilddir-target DEPENDS ${OPENDOCUMENTTEXTCOLLABBUILDDIR} ${OPENDOCUMENTTEXTCOLLAB_BUILDFILES})

# package opendocumenttexteditor
add_custom_command(
    OUTPUT ${OPENDOCUMENTTEXTCOLLAB_ZIP}
    # zip using javascript code running in node.js
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${OPENDOCUMENTTEXTCOLLABBUILDDIR}
        ${OPENDOCUMENTTEXTCOLLAB_ZIP}
        notopdir
        opendocumenttextcollab-${WEBODF_VERSION}
    DEPENDS
        opendocumenttextcollabbuilddir-target
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)
add_custom_target(build-opendocumenttextcollab DEPENDS ${OPENDOCUMENTTEXTCOLLAB_ZIP})

add_custom_target(test-opendocumenttextcollab DEPENDS webodf.js-tests)

add_custom_target(product-opendocumenttextcollab DEPENDS build-opendocumenttextcollab test-opendocumenttextcollab)
# This one is named with the path of the root of the build already.
WEBODF_PRODUCT(product-opendocumenttextcollab ${OPENDOCUMENTTEXTCOLLAB_ZIP})


################
## Collab editor
################

# intermediate solution until session-based editor component and backends are sorted out

COPY_FILES(COLLAB_EDITOR_DEPS ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_BINARY_DIR}
    ${COMMON_EDITOR_FILES}
    ${COMMON_COLLAB_FILES}
    ${PULLBOXCOLLAB_EDITOR_ONLY_FILES}
)

add_custom_target(server-collab-editorfiles-target
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/backend/jsglobal backend/jsglobal
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/backend/pullbox backend/pullbox
)

add_custom_target(collabeditor DEPENDS dojo-amalgamation.js editor-webodf.js-target ${COLLAB_EDITOR_DEPS} more-common-editorfiles-target server-collab-editorfiles-target)

COPY_FILES(SPLIT_SCREEN_EDITOR_DEPS ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_BINARY_DIR}
    ${COMMON_EDITOR_FILES}
    ${COMMON_COLLAB_FILES}
    ${SPLIT_SCREEN_EDITOR_ONLY_FILES}
)

add_custom_target(splitscreeneditor DEPENDS dojo-amalgamation.js editor-webodf.js-target ${SPLIT_SCREEN_EDITOR_DEPS} more-common-editorfiles-target server-collab-editorfiles-target)