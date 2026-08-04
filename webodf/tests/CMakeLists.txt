# What a test writes goes to "out/" of the directory it runs in, and never
# beside the documents it reads: a test that saves a document and reads it
# back left it among the sources before, where the next build found it.
# The documents the tests read are gathered in "documents/", beside the
# tests that read them and not among them: what is code is told from what
# is read, and the licence each document is under is written in one place,
# see "documents/README".

FILE( GLOB_RECURSE TESTS_TESTFILES RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}
	${CMAKE_CURRENT_SOURCE_DIR}/manifest.json
	${CMAKE_CURRENT_SOURCE_DIR}/tests.js
	${CMAKE_CURRENT_SOURCE_DIR}/tests.html
	${CMAKE_CURRENT_SOURCE_DIR}/utf8.txt
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.js
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.xml
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.zip
	${CMAKE_CURRENT_SOURCE_DIR}/documents/*
   	)

COPY_FILES(tests_nodetests ${CMAKE_CURRENT_SOURCE_DIR}
	${CMAKE_CURRENT_BINARY_DIR}/_nodetest ${TESTS_TESTFILES} )

# create copy of list with path relative to this folder
foreach(JSFILE ${LIBJSFILES})
    if (IS_ABSOLUTE ${JSFILE})
        list(APPEND TESTS_LIBJSFILES ${JSFILE})
    else (IS_ABSOLUTE ${JSFILE})
        list(APPEND TESTS_LIBJSFILES "../${JSFILE}")
    endif (IS_ABSOLUTE ${JSFILE})
endforeach(JSFILE ${LIBJSFILES})

add_custom_command(
    OUTPUT _nodetest/nodetest.timestamp
    COMMAND ${CMAKE_COMMAND} -E make_directory out
    COMMAND ${NODE} ${RUNTIMEJS} tests.js
    COMMAND ${TOUCHFILE} nodetest.timestamp
    WORKING_DIRECTORY _nodetest
    DEPENDS ${NODE} manifest.json-target ${TESTS_LIBJSFILES} ${tests_nodetests}
)
add_custom_target(test-node ALL DEPENDS _nodetest/nodetest.timestamp)
add_dependencies(webodf.js-tests test-node)

# The same suite, in the javascript engine of mozilla, on a java virtual
# machine: a library that passes two engines leans on the particulars of
# neither. It runs in a directory of its own, as the one of node does, since a
# test writes files, and it is told where the library is: rhino tells a script
# no path of its own, see "libraryPaths" in "runtime.js".
# Rhino is run by java, so a machine without it runs the suite in node and in
# the webengine of qt alone, see "find_package(Java ...)" in the root.
if (WEBODF_HAS_JAVA)
COPY_FILES(tests_rhinotests ${CMAKE_CURRENT_SOURCE_DIR}
	${CMAKE_CURRENT_BINARY_DIR}/_rhinotest ${TESTS_TESTFILES} )

add_custom_command(
    OUTPUT _rhinotest/rhinotest.timestamp
    COMMAND ${CMAKE_COMMAND} -E make_directory out
    COMMAND ${Java_JAVA_EXECUTABLE}
        -Dwebodf.lib=${CMAKE_CURRENT_SOURCE_DIR}/../lib
        -jar ${RHINO} ${RUNTIMEJS} tests.js
    COMMAND ${TOUCHFILE} rhinotest.timestamp
    WORKING_DIRECTORY _rhinotest
    DEPENDS Rhino manifest.json-target ${TESTS_LIBJSFILES} ${tests_rhinotests}
)
add_custom_target(test-rhino ALL DEPENDS _rhinotest/rhinotest.timestamp)
add_dependencies(webodf.js-tests test-rhino)

# The same suite again, from the file the compiler wrote rather than from the
# sources: what is shipped is what is tested. It carries the library, so it
# needs no path to it, and it runs in a directory of its own, as a test writes
# files and two engines would write the same ones at once.
COPY_FILES(tests_simplerhinotests ${CMAKE_CURRENT_SOURCE_DIR}
	${CMAKE_CURRENT_BINARY_DIR}/_simplerhinotest ${TESTS_TESTFILES} )

add_custom_command(
    OUTPUT _simplerhinotest/simplerhinotest.timestamp
    COMMAND ${CMAKE_COMMAND} -E make_directory out
    COMMAND ${Java_JAVA_EXECUTABLE} -jar ${RHINO}
        ${CMAKE_CURRENT_BINARY_DIR}/../simplecompiled.js
    COMMAND ${TOUCHFILE} simplerhinotest.timestamp
    WORKING_DIRECTORY _simplerhinotest
    DEPENDS Rhino simplecompiled.js-target ${tests_simplerhinotests}
)
add_custom_target(test-simplerhino ALL
    DEPENDS _simplerhinotest/simplerhinotest.timestamp)
add_dependencies(webodf.js-tests test-simplerhino)
endif ()

if (BUILD_QTJSRUNTIME)
    COPY_FILES(tests_qtjsruntimetest ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_BINARY_DIR}/_qtjsruntimetest ${TESTS_TESTFILES} )
    COPY_FILES(tests_qtjsruntimetest2 ${CMAKE_CURRENT_SOURCE_DIR}/..
        ${CMAKE_CURRENT_BINARY_DIR} webodf.css)

    # The tests are run without a screen: the runtime shows its window, as
    # chromium slows the timers of a page that is not seen, and a window that
    # opens and shuts at each build is a window in the face of whoever is
    # working. Under the platform of no screen it costs nothing and is seen by
    # no one. A reader who wants to watch the tests run asks for it with
    # -DWEBODF_TESTS_ON_SCREEN=ON.
    option(WEBODF_TESTS_ON_SCREEN
        "Show the window of the runtime while the tests run" OFF)
    if (WEBODF_TESTS_ON_SCREEN)
        set(TESTS_PLATFORM "")
    else ()
        set(TESTS_PLATFORM ${CMAKE_COMMAND} -E env QT_QPA_PLATFORM=offscreen)
    endif ()

    add_custom_command(
        OUTPUT _qtjsruntimetest/qtjsruntimetest.timestamp
        COMMAND ${CMAKE_COMMAND} -E make_directory out
        COMMAND ${TESTS_PLATFORM} $<TARGET_FILE:qtjsruntime> ${RUNTIMEJS} tests.js
        COMMAND ${TOUCHFILE} qtjsruntimetest.timestamp
        WORKING_DIRECTORY _qtjsruntimetest
        DEPENDS
            qtjsruntime
            manifest.json-target
            ${TESTS_LIBJSFILES}
            ${tests_qtjsruntimetest}
            ${tests_qtjsruntimetest2}
    )
    add_custom_target(test-qtjsruntime ALL DEPENDS _qtjsruntimetest/qtjsruntimetest.timestamp)
    add_dependencies(webodf.js-tests test-qtjsruntime)
endif (BUILD_QTJSRUNTIME)

