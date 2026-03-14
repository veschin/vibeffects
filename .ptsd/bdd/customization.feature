@feature:customization
Feature: customization

  Scenario: make init creates the expected project directory structure
    Given no directory exists at "projects/my-podcast/"
    When "make init PROJECT=my-podcast" is run
    Then the following directories are created: "projects/my-podcast/audio/", "projects/my-podcast/assets/", "projects/my-podcast/custom/patterns/", "projects/my-podcast/custom/components/", "projects/my-podcast/out/"
    Then "projects/my-podcast/custom/theme.json" is created with content {"palette": "dark-cosmos", "fonts": {}}

  Scenario: make init with existing project name exits with code 1
    Given "projects/existing-project/" already exists
    When "make init PROJECT=existing-project" is run
    Then the process exits with code 1
    Then stderr contains "project 'existing-project' already exists"

  Scenario: make init with invalid project name exits with code 1
    Given no project named "My Project!" exists
    When "make init PROJECT=My Project!" is run
    Then the process exits with code 1
    Then stderr contains "invalid project name: 'My Project!'. Use only lowercase letters, digits, hyphens, underscores"

  Scenario: Three-level theme resolution deep-merges in correct order
    Given engine default palette is "dark-cosmos" with "bg": "#0a0a1a"
    Given "~/.vibeffects/theme.json" sets "palette": "nibelung"
    Given "projects/my-podcast/custom/theme.json" from theme-happy.json sets "palette": "nibelung" with "overrides": {"bg": "#0a0a12", "radiusBlock": 16}
    When the theme is resolved for project "my-podcast"
    Then the final "bg" is "#0a0a12" and "radiusBlock" is 16

  Scenario: Custom pattern shadows built-in pattern of same ID
    Given a file "projects/my-podcast/custom/patterns/title-card.tsx" exporting a pattern with id "title-card"
    When the spec for project "my-podcast" is loaded
    Then PATTERN_REGISTRY["title-card"] resolves to the custom implementation
    Then the built-in "title-card" is not used for this project

  Scenario: Palette specified as object merges over current palette
    Given "theme.json" from theme-palette-object.json specifies "palette" as a partial object with overridden colors
    When the theme is resolved
    Then the specified color fields overwrite the base palette values
    Then unspecified palette fields retain their base palette defaults

  Scenario: theme.json with invalid JSON exits with code 1
    Given "projects/broken/custom/theme.json" contains syntactically invalid JSON
    When the spec for project "broken" is loaded
    Then the process exits with code 1
    Then stderr contains "invalid JSON in projects/broken/custom/theme.json"
