add_executable(engine_tests EngineTests.cpp)
target_link_libraries(engine_tests PRIVATE core_engine)
add_test(NAME engine_tests COMMAND engine_tests)
