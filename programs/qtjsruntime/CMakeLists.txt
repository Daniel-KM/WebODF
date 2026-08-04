# The moc of qt reads the classes that declare Q_OBJECT and writes the code of
# their signals and slots, which is compiled along with them. The header of the
# filter is listed as a source so that moc sees it, as it holds a class of its
# own.
set(CMAKE_AUTOMOC ON)

add_executable(qtjsruntime
    main.cpp
    runner.cpp
    nativeio.cpp
    bindings.cpp
    requestfilter.h
)

target_link_libraries(qtjsruntime
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::WebChannel
    Qt6::WebEngineCore
    Qt6::WebEngineWidgets
)
