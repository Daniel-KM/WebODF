COPY_FILES(BENCHMARK_HTML ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}
    1page.odt
    10pages.odt
    100pages.odt
    1000pages.odt
    index.html
    runner.css
)

FILE(GLOB BENCHMARK_JS "${CMAKE_CURRENT_SOURCE_DIR}/js/*.js")

# The modules of the benchmark are written for AMD, which the closure compiler
# carried until it dropped it. They are gathered by a script of node instead,
# with the few lines that resolve them: a benchmark measures the library, not
# itself, so nothing here is compiled.
add_custom_command(
  OUTPUT benchmark.js-target

  # from webodf.js target (DEPENDS webodf.js)
  COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/webodf/webodf.js ${CMAKE_CURRENT_BINARY_DIR}

  COMMAND ${NODE} ARGS ${CMAKE_CURRENT_SOURCE_DIR}/libexec/bundle.js
     ${CMAKE_CURRENT_SOURCE_DIR}/js
     ${CMAKE_CURRENT_BINARY_DIR}/benchmark.js

  DEPENDS ${NODE} webodf.js-target ${BENCHMARK_JS}
     ${CMAKE_CURRENT_SOURCE_DIR}/libexec/bundle.js
)

# The benchmark leaves out the actions that take a minute or more on the large
# documents, see "README-Building.md". The whole of it is another target, and
# another page, that asks for them.
add_custom_target(benchmark-html DEPENDS benchmark.js-target ${BENCHMARK_HTML})

COPY_FILES(BENCHMARK_ALL_HTML ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_BINARY_DIR}
    all.html
)

add_custom_target(benchmark-html-all DEPENDS benchmark-html ${BENCHMARK_ALL_HTML})
