# Framework-independent DSP core. Builds and tests on any platform without JUCE.
add_library(core_engine STATIC
    src/Biquad.cpp
    src/RegionReader.cpp
    src/SamplerEngine.cpp
    src/StepClock.cpp
    src/StretchPlayer.cpp
    src/Voice.cpp)

target_include_directories(core_engine PUBLIC include)
target_compile_features(core_engine PUBLIC cxx_std_17)
set_target_properties(core_engine PROPERTIES POSITION_INDEPENDENT_CODE ON)

if(MSVC)
    target_compile_options(core_engine PRIVATE /W4)
else()
    target_compile_options(core_engine PRIVATE -Wall -Wextra -Wshadow -Wconversion -Wno-sign-conversion)
endif()
