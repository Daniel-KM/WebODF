# Take out of the directory of the products what another build left there.
#
# The products carry the version of the sources they were built from, so a
# second build writes files of another name beside the ones of the first, and
# a reader is left to tell which is which. Only the products of this build are
# kept: DIR is the directory, KEEP the names to leave in it.
# The names come as one string parted by commas: a list of cmake is parted by
# ";", which the shell that runs the build would read as the end of a command.
string(REPLACE "," ";" KEEP "${KEEP}")
file(GLOB WEBODF_THERE ${DIR}/*)
foreach (WEBODF_ONE ${WEBODF_THERE})
    get_filename_component(WEBODF_NAME ${WEBODF_ONE} NAME)
    list(FIND KEEP ${WEBODF_NAME} WEBODF_WANTED)
    if (WEBODF_WANTED EQUAL -1)
        message(STATUS "Taking away the product of another build: ${WEBODF_NAME}")
        file(REMOVE_RECURSE ${WEBODF_ONE})
    endif ()
endforeach ()
