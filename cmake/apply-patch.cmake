# Applies PATCH to the current directory (a FetchContent source tree) once.
# Usage: cmake -DPATCH=<file> -P apply-patch.cmake
execute_process(COMMAND git apply --reverse --check "${PATCH}"
                RESULT_VARIABLE already_applied OUTPUT_QUIET ERROR_QUIET)
if(already_applied EQUAL 0)
    message(STATUS "Already applied: ${PATCH}")
    return()
endif()

execute_process(COMMAND git apply "${PATCH}" RESULT_VARIABLE result)
if(NOT result EQUAL 0)
    message(FATAL_ERROR "Could not apply ${PATCH}")
endif()
message(STATUS "Applied: ${PATCH}")
