string(COMPARE EQUAL "${CMAKE_SOURCE_DIR}" "${CMAKE_CURRENT_SOURCE_DIR}"
    WRONGCMAKEDIR)
if(WRONGCMAKEDIR)
  message(FATAL_ERROR "You should point CMake to the parent directory.")
endif(WRONGCMAKEDIR)

# update the list of needed files
execute_process(
  COMMAND ${NODE} ${RUNTIMEJS} ${TOOLS_DIR}/updateJS.js ${CMAKE_BINARY_DIR}/jsfileslist.txt
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)
include(${CMAKE_BINARY_DIR}/jsfileslist.txt)

configure_file(webodfversion.js.in ${CMAKE_CURRENT_BINARY_DIR}/webodfversion.js)

set(EXTERNS_LIST
    "--env CUSTOM"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_dom1.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_dom2.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_dom3.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_elementtraversal.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_anim_timing.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_range.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_xml.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_css.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/w3c_event.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/window.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/gecko_xml.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/gecko_dom.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/ie_dom.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/gecko_event.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/ie_event.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/html5.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/iphone.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs/fileapi.js"
    "--externs ${CMAKE_CURRENT_SOURCE_DIR}/tools/externs.js"
)
string(REPLACE ";" " " EXTERNS "${EXTERNS_LIST}")

set(TESTJSFILES
    tests/webodfcore/UnitTester.js
    tests/webodfcore/ZipTests.js
    tests/webodfcore/Base64Tests.js
    tests/webodfcore/CursorTests.js
    tests/webodfcore/DomUtilsTests.js
    tests/webodfcore/EventSubscriptionsTests.js
    tests/webodfcore/PositionIteratorTests.js
    tests/webodfcore/RuntimeTests.js
    tests/webodfcore/StepIteratorTests.js
    tests/gui/DirectFormattingControllerTests.js
    tests/gui/GuiStepUtilsTests.js
    tests/gui/MetadataControllerTests.js
    tests/gui/SelectionControllerTests.js
    tests/gui/StyleSummaryTests.js
    tests/gui/TextControllerTests.js
    tests/gui/ImageControllerTests.js
    tests/gui/TrivialUndoManagerTests.js
    tests/gui/UndoStateRulesTests.js
    tests/odf/StyleParseUtilsTests.js
    tests/odf/StyleTreeTests.js
    tests/odf/StyleCacheTests.js
    tests/odf/FormattingTests.js
    tests/odf/LayoutTests.js
    tests/odf/PageLayoutTests.js
    tests/odf/ListStyleToCssTests.js
    tests/odf/ObjectNameGeneratorTests.js
    tests/odf/MaliciousDocumentTests.js
    tests/odf/OdfContainerTests.js
    tests/odf/OdfContainerSafetyTests.js
    tests/odf/OdfUtilsTests.js
    tests/odf/StyleInfoTests.js
    tests/odf/TextStyleApplicatorTests.js
    tests/ops/OperationTestHelper.js
    tests/ops/OdtDocumentTests.js
    tests/ops/OperationTests.js
    tests/ops/SessionTests.js
    tests/ops/OdtStepsTranslatorTests.js
    tests/ops/TransformationTests.js
    tests/ops/TransformerTests.js
    tests/xmldom/LSSerializerTests.js
    tests/xmldom/XPathTests.js
    tests/tests.js
)

add_custom_target(manifest.json-target
    COMMAND ${NODE}
    ${RUNTIMEJS} ${TOOLS_DIR}/updateJS.js ${CMAKE_BINARY_DIR}/jsfileslist.txt
    DEPENDS ${TOOLS_DIR}/updateJS.js
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)

add_custom_command(
    OUTPUT webodf.css.js
    COMMAND ${NODE}
    ARGS ${RUNTIMEJS} ${TOOLS_DIR}/css2js.js webodf.css ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js
    DEPENDS ${TOOLS_DIR}/css2js.js webodf.css
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
)
add_custom_target(webodf.css.js-target DEPENDS webodf.css.js)

# Windows has a command-line limit of around 8,000 chars, so files to be compiled are supplied to CC using the --flagfile
# option to help keep the length of the compilation command as small as possible.
SET(CLOSURE_ERROR_OPTION_LIST
    "--language_in ECMASCRIPT3"
    "--language_out ECMASCRIPT3"
    "--use_types_for_optimization"
    #    "--new_type_inf"
    "--hide_warnings_for=synthetic"
    "--jscomp_error accessControls"
    "--jscomp_error checkRegExp"
    "--jscomp_error checkTypes"
    "--jscomp_error checkVars"
    "--jscomp_error conformanceViolations"
    "--jscomp_error const"
    "--jscomp_error constantProperty"
    "--jscomp_error deprecated"
    "--jscomp_error deprecatedAnnotations"
    "--jscomp_error duplicateMessage"
    "--jscomp_error es5Strict"
    "--jscomp_error externsValidation"
    "--jscomp_error globalThis"
    "--jscomp_error invalidCasts"
    "--jscomp_error misplacedTypeAnnotation"
    "--jscomp_error missingProperties"
    "--jscomp_error missingProvide"
    "--jscomp_off   missingRequire"
    "--jscomp_error missingReturn"
    "--jscomp_error msgDescriptions"
    "--jscomp_off   nonStandardJsDocs"
    "--jscomp_error strictModuleDepCheck"
    "--jscomp_error suspiciousCode"
    "--jscomp_error typeInvalidation"
    "--jscomp_error undefinedVars"
    "--jscomp_error underscore"
    "--jscomp_error unknownDefines"
    "--jscomp_error unusedLocalVariables"
    "--jscomp_error uselessCode"
    "--jscomp_error visibility")
string(REPLACE ";" " " CLOSURE_ERROR_OPTIONS "${CLOSURE_ERROR_OPTION_LIST}")

file (WRITE ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt "--warning_level VERBOSE ${CLOSURE_ERROR_OPTIONS} --summary_detail_level 3 ${EXTERNS}")

foreach(JSFILE ${LIBJSFILES})
    if (IS_ABSOLUTE ${JSFILE})
        file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt " --js ${JSFILE}")
    else (IS_ABSOLUTE ${JSFILE})
        file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt " --js ${CMAKE_CURRENT_SOURCE_DIR}/${JSFILE}")
    endif (IS_ABSOLUTE ${JSFILE})
endforeach(JSFILE ${LIBJSFILES})

file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt " --js ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js")

# copy the flagfile for some targets which require the test files to be passed into CC
# this requires a separate file as other targets don't want to compile the test files
execute_process(COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt ${CMAKE_CURRENT_BINARY_DIR}/cc-withTestFiles.txt)

# A third flagfile, for the file that is run rather than checked: it carries
# jszip, which the strict compilation refuses as it is minified, and it carries
# it before the tests. The compiler puts a file named on the command line after
# the ones of a flagfile, and jszip writes itself into the scope when it is
# read: a test that opens a zip reads it at once in an engine that has no loop
# of events, rhino among them.
execute_process(COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt ${CMAKE_CURRENT_BINARY_DIR}/cc-runTestFiles.txt)
file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-runTestFiles.txt
    " --js ${CMAKE_CURRENT_SOURCE_DIR}/lib/externs/JSZip.js")

foreach(JSFILE ${TESTJSFILES})
    file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-withTestFiles.txt " --js ${CMAKE_CURRENT_SOURCE_DIR}/${JSFILE}")
    file (APPEND ${CMAKE_CURRENT_BINARY_DIR}/cc-runTestFiles.txt " --js ${CMAKE_CURRENT_SOURCE_DIR}/${JSFILE}")
endforeach(JSFILE ${TESTJSFILES})

# nonStandardJsDocs is not used because we use @licstart @licend and @source
# ideally we would enable --jscomp_error reportUnknownTypes
# -XX:+TieredCompilation reduces compilation time by about 30%
set(SHARED_CLOSURE_ARGS -XX:+TieredCompilation -jar ${CLOSURE_JAR})

# What the closure compiler writes is written by java alone: a machine
# without it builds the library and every product, and only the checks of the
# types are left out, see "find_package(Java ...)" in the root.
if (WEBODF_HAS_JAVA)
    set(WEBODF_TYPE_CHECK webodf-compiled.js)
else ()
    set(WEBODF_TYPE_CHECK "")
endif ()
if (WEBODF_HAS_JAVA)

# Do quick syntax check on javascript files of webodf lib and webodf tests.
# This compile uses no optimization and runs simple syntax tests. That is why
# this target is mentioned early in the list of dependencies.
# The result of this compilation is used in running tests with Node and Rhino.
add_custom_command(
    OUTPUT simplecompiled.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS}
        --js ${HEADERCOMPILED_FILE}
        --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-runTestFiles.txt
        --compilation_level WHITESPACE_ONLY
        --formatting PRETTY_PRINT
        --js_output_file simplecompiled.js-
    # in WHITESPACE_ONLY mode, it is not possible to define IS_COMPILED_CODE
    # so the value for IS_COMPILED_CODE is set by find and replace in the code
    COMMAND ${CMAKE_COMMAND} -DFILENAME:STRING="${CMAKE_CURRENT_BINARY_DIR}/simplecompiled.js" -P ${CMAKE_CURRENT_SOURCE_DIR}/tools/set_IS_COMPILED_CODE.cmake
    DEPENDS ClosureCompiler ${LIBJSFILES} ${TESTJSFILES} ${HEADERCOMPILED_FILE}
    ${CMAKE_CURRENT_BINARY_DIR}/webodf.css.js
)
add_custom_target(simplecompiled.js-target DEPENDS simplecompiled.js)

# Compile code and tests with more strict settings.
# This reports more syntax issues with the code and tests but cannot be used
# to actually run the tests because the strong compilation gives broken code.
# One of the things that break is that many more function and member names are
# shortened. This is a problem in the tests where test status is determined
# from code in strings.
# See https://developers.google.com/closure/compiler/docs/limitations
add_custom_command(
    OUTPUT compiled.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS}
        --js ${HEADERCOMPILED_FILE}
        --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-withTestFiles.txt
        --define IS_COMPILED_CODE=true
        --compilation_level ADVANCED_OPTIMIZATIONS
        --formatting PRETTY_PRINT
        --externs ${CMAKE_CURRENT_SOURCE_DIR}/externs/*.js
        --js_output_file compiled.js-
    COMMAND ${CMAKE_COMMAND} ARGS -E rename compiled.js- compiled.js
    DEPENDS ClosureCompiler ${LIBJSFILES} ${TESTJSFILES} tools/externs.js
        webodf.css.js-target ${HEADERCOMPILED_FILE}
)
add_custom_target(compiled.js-target DEPENDS compiled.js)

# Compile the optimized production version of WebODF.
add_custom_command(
    OUTPUT webodf-compiled.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS} --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt
        --jscomp_error reportUnknownTypes
        --define IS_COMPILED_CODE=true
        --compilation_level SIMPLE_OPTIMIZATIONS
        --externs ${CMAKE_CURRENT_SOURCE_DIR}/externs/*.js
        --js_output_file webodf-compiled.js-
    COMMAND ${CMAKE_COMMAND} ARGS -E rename webodf-compiled.js- webodf-compiled.js
    DEPENDS ClosureCompiler ${LIBJSFILES} tools/externs.js
        webodf.css.js-target
)
endif ()

# The library is written by the build with node, so that both builds produce
# the same file. The closure compiler still reads the sources, in
# "webodf-compiled.js" above, but only to check their types: it compiles with
# SIMPLE_OPTIMIZATIONS, that neither folds the definition IS_COMPILED_CODE nor
# drops what it makes unreachable, so it kept the loader of the classes and
# the runner of the scripts, that read a file with eval(), inside a library
# that never calls them.
add_custom_command(
    OUTPUT webodf.js
    COMMAND ${NODE} ARGS ${CMAKE_SOURCE_DIR}/scripts/build.js
        --output ${CMAKE_CURRENT_BINARY_DIR}/webodf.js
        --header ${HEADERCOMPILED_FILE}
    DEPENDS ${NODE} ${WEBODF_TYPE_CHECK} manifest.json-target
        ${CMAKE_SOURCE_DIR}/scripts/build.js
        ${CMAKE_SOURCE_DIR}/scripts/lib/bundle.js
        ${CMAKE_SOURCE_DIR}/scripts/lib/sources.js
        ${CMAKE_SOURCE_DIR}/scripts/lib/generated.js
        ${HEADERCOMPILED_FILE}
        ${LIBJSFILES}
        # The css of the viewer is written into the library as a string, so a
        # change of it is a change of the library: without this, the packages
        # were built again with the css of the build before.
        ${CMAKE_CURRENT_SOURCE_DIR}/webodf.css
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)
add_custom_target(webodf.js-target DEPENDS webodf.js)

if (WEBODF_HAS_JAVA)
# Compile the debug version of WebODF. This is also published as a product.
add_custom_command(
    OUTPUT webodf-debug-compiled.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS} --flagfile ${CMAKE_CURRENT_BINARY_DIR}/cc-noTestFiles.txt
        --jscomp_error reportUnknownTypes
        --define IS_COMPILED_CODE=true
        --compilation_level WHITESPACE_ONLY
        --formatting PRETTY_PRINT
        --externs ${CMAKE_CURRENT_SOURCE_DIR}/externs/*.js
        --js_output_file webodf-debug-compiled.js-
    # in WHITESPACE_ONLY mode, it is not possible to define IS_COMPILED_CODE
    # so the value for IS_COMPILED_CODE is set by find and replace in the code
    COMMAND ${CMAKE_COMMAND} -DFILENAME:STRING="${CMAKE_CURRENT_BINARY_DIR}/webodf-debug-compiled.js" -P ${CMAKE_CURRENT_SOURCE_DIR}/tools/set_IS_COMPILED_CODE.cmake
    DEPENDS ClosureCompiler ${LIBJSFILES} tools/externs.js
        webodf.css.js-target
)
# Include non-Closure Compiler compatible libraries with no further recompilation
add_custom_command(
    OUTPUT webodf-debug.js
    COMMAND ${Java_JAVA_EXECUTABLE}
    ARGS ${SHARED_CLOSURE_ARGS}
        --js ${HEADERCOMPILED_FILE}
        --js webodf-debug-compiled.js
        --js ${CMAKE_CURRENT_SOURCE_DIR}/lib/externs/*.js
        --compilation_level WHITESPACE_ONLY
        --formatting PRETTY_PRINT
        --js_output_file webodf-debug.js-
    COMMAND ${CMAKE_COMMAND} ARGS -E rename webodf-debug.js- webodf-debug.js
    DEPENDS ClosureCompiler webodf-debug-compiled.js ${HEADERCOMPILED_FILE}
)
add_custom_target(webodf-debug.js-target DEPENDS webodf-debug.js)

endif ()

if (WEBODF_HAS_JAVA)
    add_custom_target(syntaxcheck ALL
        DEPENDS simplecompiled.js-target webodf.js-target
            compiled.js-target
    )
else ()
    add_custom_target(syntaxcheck ALL DEPENDS webodf.js-target)
endif ()


# The documentation is written by the build with node, with jsdoc 4, as the
# jsdoc-toolkit 2.4.0 of 2011 the build downloaded is abandoned.
add_custom_command(
    OUTPUT docs/index.html
    COMMAND ${NODE} ARGS ${CMAKE_SOURCE_DIR}/scripts/doc.js
        --output ${CMAKE_CURRENT_BINARY_DIR}/docs
    DEPENDS ${NODE} ${LIBJSFILES} manifest.json-target
        ${CMAKE_SOURCE_DIR}/scripts/doc.js
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
)
add_custom_target(doc DEPENDS docs/index.html)

# The suite is run from the file the compiler wrote, which java writes: a
# machine without java runs the suite from the sources alone, in node and in
# the webengine of qt.
if (WEBODF_HAS_JAVA)
    add_custom_command(
        OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/simplenodetest.timestamp
        COMMAND ${NODE} ${CMAKE_CURRENT_BINARY_DIR}/simplecompiled.js
        COMMAND ${TOUCHFILE} ${CMAKE_CURRENT_BINARY_DIR}/simplenodetest.timestamp
        DEPENDS ${NODE} simplecompiled.js copy_node_modules
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/tests
    )
    add_custom_target(test-simplenode ALL DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/simplenodetest.timestamp)
    add_custom_target(webodf.js-tests DEPENDS syntaxcheck test-simplenode)
else ()
    add_custom_target(webodf.js-tests DEPENDS syntaxcheck)
endif ()

add_custom_command(
    OUTPUT ${WEBODFJS_DIR}

    # clear working dir
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${WEBODFJS_DIR}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${WEBODFJS_DIR}

    # API docs
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_BINARY_DIR}/docs ${WEBODFJS_DIR}/docs
    # webodf.js
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/webodf.js ${WEBODFJS_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/webodf-debug.js ${WEBODFJS_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy ${LIBJSLICENSEFILE} ${WEBODFJS_DIR}

    # zip using javascript code running in Node.js
    COMMAND ${NODE} ARGS ${RUNTIMEJS} ${TOOLS_DIR}/zipdir.js
        ${WEBODFJS_DIR}
        ${CMAKE_BINARY_DIR}/${WEBODFJS_ZIP}

    DEPENDS
        ${TOOLS_DIR}/zipdir.js
        doc
        webodf.js-target
        webodf-debug.js-target
        ${LIBJSLICENSEFILE}
)
add_custom_target(build-library DEPENDS ${WEBODFJS_DIR} )

add_custom_target(test-library DEPENDS webodf.js-tests)

add_custom_target(product-library DEPENDS build-library test-library)

add_subdirectory(tests)

# vim:expandtab
