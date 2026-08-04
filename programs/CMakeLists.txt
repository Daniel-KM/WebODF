add_subdirectory(touchui)

if(BUILD_QTJSRUNTIME)
  add_subdirectory(qtjsruntime)
endif(BUILD_QTJSRUNTIME)

add_subdirectory(docnosis)

add_subdirectory(opendocumentviewer-webext)

if(BUILD_DESKTOP)
  add_subdirectory(opendocumentviewer-desktop)
endif(BUILD_DESKTOP)

add_subdirectory(benchmark)
add_subdirectory(editor)
add_subdirectory(cordova)

add_subdirectory(opendocumentviewer-android)

add_subdirectory(opendocumentviewer-ios)
