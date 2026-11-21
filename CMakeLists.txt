cmake_minimum_required(VERSION 3.22)

#==============================================================================
# Product identity. This block is the only place a new plugin needs to rename.
# CI and the installer read these lines too (scripts/product-info.sh), so keep them
# as plain one-line set() calls with quoted values.
set(PRODUCT_NAME "Loop Pad")                   # shown in DAWs, window titles and folders
set(PRODUCT_TARGET "LoopPad")                  # CMake target and file names; no spaces
set(PRODUCT_VERSION "0.1.0")
set(PRODUCT_COMPANY "Your Company")
set(PRODUCT_BUNDLE_ID "com.yourcompany.looppad")
set(PRODUCT_MANUFACTURER_CODE "Ycmp")          # 4 chars, first one uppercase; same for all your plugins
set(PRODUCT_PLUGIN_CODE "Lpd1")                # 4 chars, unique per plugin, at least one uppercase
set(PRODUCT_WINDOWS_APP_ID "DFAE9896-DEF7-4DD4-9675-7D8C4A477038") # Windows installer AppId; new GUID per product, then never change it
#==============================================================================

# Universal binary by default on macOS (must be set before project()).
if(APPLE AND NOT CMAKE_OSX_ARCHITECTURES)
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "macOS architectures")
endif()
set(CMAKE_OSX_DEPLOYMENT_TARGET "10.15" CACHE STRING "Minimum macOS version")

# Windows: link the C++ runtime statically, so the plugin doesn't need the
# Visual C++ Redistributable (MSVCP140.dll) installed on the user's PC.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

project(${PRODUCT_TARGET} VERSION ${PRODUCT_VERSION} LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(BUILD_PLUGIN "Build the JUCE plugin (needs JUCE and Node.js)" ON)
option(BUILD_TESTS "Build the engine unit tests" ON)
set(UI_DEV_SERVER_URL "" CACHE STRING "Load the UI from a Vite dev server, e.g. http://localhost:5173/ (development only)")
set(JUCE_DIR "" CACHE PATH "Use a local JUCE checkout instead of downloading one")

# The DSP engine has no JUCE dependency.
add_subdirectory(engine)

if(BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

if(BUILD_PLUGIN)
    if(JUCE_DIR)
        add_subdirectory(${JUCE_DIR} juce EXCLUDE_FROM_ALL)
    else()
        include(FetchContent)
        # The patch fixes JUCE 8.0.9's Linux web view pipe, which loses its framing when a
        # message to the UI is larger than one atomic pipe write (~4 KB) and then crashes the
        # web view process with std::bad_alloc. Windows and macOS don't use that code.
        FetchContent_Declare(JUCE
            GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
            GIT_TAG 8.0.9
            GIT_SHALLOW TRUE
            PATCH_COMMAND ${CMAKE_COMMAND} -DPATCH=${CMAKE_CURRENT_SOURCE_DIR}/cmake/patches/juce-linux-webview-ipc.patch
                          -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/apply-patch.cmake)
        FetchContent_MakeAvailable(JUCE)
    endif()

    add_subdirectory(plugin)

    if(BUILD_TESTS)
        add_subdirectory(tests/plugin-host)
    endif()
endif()
