
FILE( GLOB_RECURSE TESTS_TESTFILES RELATIVE ${CMAKE_CURRENT_SOURCE_DIR}
	${CMAKE_CURRENT_SOURCE_DIR}/manifest.json
	${CMAKE_CURRENT_SOURCE_DIR}/tests.js
	${CMAKE_CURRENT_SOURCE_DIR}/tests.html
	${CMAKE_CURRENT_SOURCE_DIR}/utf8.txt
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.js
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.xml
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.zip
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.odt
	${CMAKE_CURRENT_SOURCE_DIR}/*/*.fodt
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
COPY_FILES(tests_rhinotests ${CMAKE_CURRENT_SOURCE_DIR}
	${CMAKE_CURRENT_BINARY_DIR}/_rhinotest ${TESTS_TESTFILES} )

add_custom_command(
    OUTPUT _rhinotest/rhinotest.timestamp
    COMMAND ${Java_JAVA_EXECUTABLE}
        -Dwebodf.lib=${CMAKE_CURRENT_SOURCE_DIR}/../lib
        -jar ${RHINO} ${RUNTIMEJS} tests.js
    COMMAND ${TOUCHFILE} rhinotest.timestamp
    WORKING_DIRECTORY _rhinotest
    DEPENDS Rhino manifest.json-target ${TESTS_LIBJSFILES} ${tests_rhinotests}
)
add_custom_target(test-rhino ALL DEPENDS _rhinotest/rhinotest.timestamp)
add_dependencies(webodf.js-tests test-rhino)

if (BUILD_QTJSRUNTIME)
    COPY_FILES(tests_qtjsruntimetest ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_BINARY_DIR}/_qtjsruntimetest ${TESTS_TESTFILES} )
    COPY_FILES(tests_qtjsruntimetest2 ${CMAKE_CURRENT_SOURCE_DIR}/..
        ${CMAKE_CURRENT_BINARY_DIR} webodf.css)

    add_custom_command(
        OUTPUT _qtjsruntimetest/qtjsruntimetest.timestamp
        COMMAND qtjsruntime ${RUNTIMEJS} tests.js
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

