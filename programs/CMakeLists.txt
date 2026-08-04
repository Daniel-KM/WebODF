add_subdirectory(touchui)

if(BUILD_QTJSRUNTIME)
  add_subdirectory(qtjsruntime)
endif(BUILD_QTJSRUNTIME)

add_subdirectory(docnosis)

add_subdirectory(odfviewer-webext)

add_subdirectory(benchmark)
add_subdirectory(editor)
add_subdirectory(cordova)

add_subdirectory(odfviewer-android)
