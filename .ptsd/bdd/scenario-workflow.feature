@feature:scenario-workflow
Feature: scenario-workflow

  Scenario: Generate scenario from transcription and segments produces scenario.json
    Given "transcription.json" from input-transcription.json and "segments.json" from input-segments.json exist in "projects/cljs-podcast/"
    When AI generates the scenario for project "cljs-podcast"
    Then "projects/cljs-podcast/scenario.json" is created
    Then the file contains a "scenes" array where each scene has "id", "startSec", "endSec", "topic", "plannedPatterns"

  Scenario: Scenario includes assetRequests when AI identifies needed assets
    Given the transcription references a project website in the first 30 seconds
    When AI generates the scenario
    Then "scenario.json" contains an "assetRequests" array with at least one entry
    Then each assetRequest has "id", "description", and "context" fields

  Scenario: Scenario includes commentary entries with type and startSec
    Given a transcription where the speaker makes a factual claim at 15.5s
    When AI generates the scenario
    Then "scenario.json" contains a "commentary" array
    Then each commentary entry has "startSec", "text", and "type" fields where type is one of "correction", "note", "joke"

  Scenario: Finalize scenario produces valid spec.json
    Given "scenario.json" exists in "projects/cljs-podcast/" with 2 scenes and resolved assets
    When AI finalizes the scenario into spec.json
    Then "projects/cljs-podcast/spec.json" is created
    Then the spec passes Zod validation with no errors

  Scenario: Each segment maps to one scene in the spec
    Given "segments.json" contains exactly 2 segments from segments-happy.json with boundaries 0-12.5s and 12.5-30.0s
    When AI finalizes the spec from the scenario
    Then spec.json contains exactly 2 scenes
    Then scene[0].startSec is 0.0 and scene[0].endSec is 12.5
    Then scene[1].startSec is 12.5 and scene[1].endSec is 30.0

  Scenario: Adjacent scenes have different accent colors
    Given a spec generated from a scenario with 3 scenes
    When the spec is finalized
    Then no two adjacent scenes share the same accent color
    Then all accent values are hex colors from the current palette

  Scenario: Missing transcription.json causes AI to report error
    Given no "transcription.json" exists in "projects/new-project/"
    When AI attempts to generate a scenario for project "new-project"
    Then AI outputs "transcription.json not found in project 'new-project'. Run make transcribe first."

  Scenario: validate-spec script reports valid for well-formed spec
    Given "projects/cljs-podcast/spec.json" matches expected-spec.json
    When make validate is run for project "cljs-podcast"
    Then the script outputs "valid"
    Then the process exits with code 0
