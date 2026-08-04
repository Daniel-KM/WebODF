# Copy the packages CPack wrote into the products of the build. The name of a
# package is settled by CPack itself, so it is looked for rather than written
# again here, and what CPack leaves beside it is left where it is.
file(GLOB PACKAGES "${DIR}/*.${EXT}")
if (NOT PACKAGES)
    message(FATAL_ERROR "No package of the kind ${EXT} was written in ${DIR}.")
endif ()
file(MAKE_DIRECTORY "${DEST}")
foreach (PACKAGE ${PACKAGES})
    file(COPY "${PACKAGE}" DESTINATION "${DEST}")
    message("Wrote ${PACKAGE}")
endforeach ()
