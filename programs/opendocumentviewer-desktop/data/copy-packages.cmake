# Copy the package CPack wrote into the products of the build. The one of this
# build is named, and not every package of the kind that is there: CPack
# leaves the packages of the builds that went before beside it, whose names
# hold their own version, and they are none of this build's business.
set(PACKAGE "${DIR}/${NAME}.${EXT}")
if (NOT EXISTS "${PACKAGE}")
    message(FATAL_ERROR "No package was written as ${PACKAGE}.")
endif ()
file(MAKE_DIRECTORY "${DEST}")
file(COPY "${PACKAGE}" DESTINATION "${DEST}")
message("Wrote ${PACKAGE}")
