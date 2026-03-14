@feature:ai-commentary
Feature: ai-commentary

  Scenario: Commentary entry renders at correct timecode
    Given a spec with commentary from commentary-happy.json where entry "correction" has startSec 15.5 and durationSec 4
    When the composition renders at frame matching time 17.0s at 30fps
    Then CommentaryOverlay displays the text "На самом деле ClojureScript появился в 2011, а не в 2010"

  Scenario: Each commentary type renders with its distinct accent color
    Given a spec with three entries: type "correction" at 15.5s, type "note" at 45.0s, type "joke" at 120.0s
    When CommentaryOverlay renders each entry
    Then "correction" entry background is rgba(239,68,68,0.85)
    Then "note" entry background is rgba(59,130,246,0.85)
    Then "joke" entry background is rgba(234,179,8,0.85)

  Scenario: Commentary text exceeding 140 chars is rejected by Zod
    Given commentary-toolong.json with a "note" entry whose text is 155 characters
    When Zod parses the spec
    Then validation fails with an error referencing the "text" field and max length 140

  Scenario: Overlapping commentary entries are resolved so second waits
    Given commentary-overlap.json with entry1 startSec 10.0 durationSec 5 and entry2 startSec 12.0 durationSec 5
    When resolveCommentaryTimings is called
    Then entry2 effective startSec is 15.5 (entry1.startSec + entry1.durationSec + 0.5)
    Then the original startSec values in the spec are not modified

  Scenario: Empty commentary array renders nothing and causes no errors
    Given a spec with "commentary": [] from commentary-empty.json
    When the composition renders
    Then CommentaryOverlay renders no pill cards
    Then no JavaScript errors are thrown

  Scenario: Commentary entry animates in with spring slide from top and fades out
    Given a spec with a "joke" commentary entry at startSec 120.0 and durationSec 4
    When the composition renders at the first frame of startSec 120.0
    Then the entry translateY starts at -60px and moves toward 0 via spring with damping 200
    When the composition renders at the last 12 frames before startSec + durationSec
    Then the entry opacity decreases linearly to 0
