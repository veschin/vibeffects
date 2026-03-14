@feature:engine-core
Feature: engine-core

  Scenario: VideoSpec v2 passes Zod validation
    Given a spec with "version": 2 and valid scenes from spec-happy.json
    When Zod parses the spec
    Then validation passes with no errors

  Scenario: VideoSpec with version 1 is rejected
    Given a spec with "version": 1 and otherwise valid fields
    When Zod parses the spec
    Then validation fails with error "unsupported spec version"

  Scenario: VideoSpec without version field is rejected
    Given a spec with no "version" field and otherwise valid fields
    When Zod parses the spec
    Then validation fails with error "unsupported spec version"

  Scenario: SceneSpec with endSec <= startSec is rejected
    Given a spec from spec-invalid.json with "startSec": 50 and "endSec": 30
    When Zod parses the spec
    Then validation fails with error "endSec must be greater than startSec"

  Scenario: Total duration is computed from max scene endSec
    Given a spec from spec-happy.json with last scene "endSec": 210.0 and fps 30
    When getTotalDurationFrames is called
    Then the result is 6300 frames

  Scenario: Empty scenes array renders as 1 frame
    Given a spec from spec-empty-scenes.json with "scenes": []
    When getTotalDurationFrames is called
    Then the result is 1 frame

  Scenario: Element visibility window respects enterSec and exitSec
    Given a scene with "startSec": 45.2 and an element with "enterSec": 6 and "exitSec": 20
    When calculateElementStates is called at frame matching absolute time 51.5s at 30fps
    Then the element phase is not "hidden"

  Scenario: Element before enterSec is hidden
    Given a scene with "startSec": 45.2 and an element with "enterSec": 6
    When calculateElementStates is called at frame matching absolute time 45.5s at 30fps
    Then the element phase is "hidden"

  Scenario: Focus phase places element at 78% x 72% of viewport center
    Given a single element in a scene with no other elements
    When calculateElementStates returns its state with phase "focus"
    Then the element occupies 78% of viewport width and 72% of viewport height centered

  Scenario: New element entrance triggers spring interpolation for existing elements
    Given two elements where the second enters at a later frame
    When calculateElementStates is called at the frame the second element enters
    Then existing element positions use spring interpolation with durationInFrames equal to fps * 0.85

  Scenario: useSlideAnimation returns spring entrance and linear fade exit
    Given a composition duration of 90 frames at 30fps
    When useSlideAnimation is called with durationInFrames 90
    Then opacity at frame 0 is below 1 and rises with spring damping 200
    Then opacity at frame 72 begins linear fade to 0 over 18 frames

  Scenario: useBlockEntrance center direction scales from 0.92 to 1.0
    Given useBlockEntrance is called with type "center" and delayFrames 0
    When the entrance animation plays
    Then scale starts at 0.92 and reaches 1.0 at completion

  Scenario: ThemeContext provides palette fonts and design tokens via hooks
    Given ThemeContext wraps a component with palette "dark-cosmos" and fonts "Raleway"/"Manrope"/"JetBrains Mono"
    When the component calls usePalette, useThemeFonts, useTypeScale
    Then each hook returns the corresponding values from the active theme

  Scenario: All 6 palette presets exist in PRESETS registry
    Given the palette registry is loaded
    When the preset IDs are enumerated
    Then the registry contains "dark-cosmos", "warm-ember", "deep-ocean", "nibelung", "rose-quartz", "acid-neon"

  Scenario: Unknown font falls back to system font with log message
    Given font-loader is configured with display font "UnknownFont"
    When the font is loaded
    Then font-loader logs "[font-loader] Font \"UnknownFont\" is not in the registry. Falling back to system font."
    Then the system font is used

  Scenario: Design constants are the only source of pixel sizes
    Given the design-constants.ts module is loaded
    When any component imports a pixel size value such as padding or gap
    Then the value comes from design-constants.ts and no magic number is inline in the component
