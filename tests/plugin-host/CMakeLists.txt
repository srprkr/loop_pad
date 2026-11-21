# Loads the built VST3 in a minimal host, sends MIDI and checks that audio comes out.
juce_add_console_app(plugin_host_test PRODUCT_NAME "plugin_host_test")
target_sources(plugin_host_test PRIVATE PluginHostTest.cpp)
target_compile_definitions(plugin_host_test PRIVATE
    JUCE_PLUGINHOST_VST3=1
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0)
target_link_libraries(plugin_host_test PRIVATE
    juce::juce_audio_processors
    juce::juce_recommended_config_flags)

# Build the plugin first so the test always checks the current build.
add_dependencies(plugin_host_test ${PRODUCT_TARGET}_VST3)

# The VST3 bundle sits in a VST3 folder beside the plugin's shared-code library
# (<target>_artefacts/<config>/VST3/<product name>.vst3).
add_test(NAME plugin_midi
         COMMAND plugin_host_test "$<TARGET_FILE_DIR:${PRODUCT_TARGET}>/VST3/${PRODUCT_NAME}.vst3")
