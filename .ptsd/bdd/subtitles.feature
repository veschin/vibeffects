@feature:subtitles
Feature: subtitles

  Scenario: SubtitleOverlay renders current word highlighted at correct timecode
    Given a transcription from transcription-excerpt.json where word "формате" spans startMs 950 to endMs 1370
    When the composition renders at frame matching time 1100ms at 30fps
    Then SubtitleOverlay displays the phrase containing "формате"
    Then "формате" is rendered with white color and surrounding words with rgba(255,255,255,0.6)

  Scenario: Words separated by more than 200ms are placed in separate phrases
    Given words "Так" ending at 260ms and "попробуем" starting at 550ms with a 290ms gap between them
    When SubtitleOverlay computes phrases
    Then "Так" and "попробуем" are placed in separate phrases

  Scenario: Words separated by less than 200ms form one phrase
    Given words "в" ending at 910ms and "формате" starting at 950ms with a 40ms gap
    When SubtitleOverlay computes phrases
    Then "в" and "формате" are in the same phrase

  Scenario: Subtitles disabled via spec.subtitles false
    Given a spec with "subtitles": false and a transcription from transcription-excerpt.json
    When the composition renders
    Then SubtitleOverlay is not mounted and no subtitle text is visible

  Scenario: Subtitle font size is configurable via spec
    Given a spec with "subtitles": {"enabled": true, "fontSize": 36, "position": "bottom", "style": "highlight"}
    When SubtitleOverlay renders
    Then the subtitle text uses fontSize 36

  Scenario: Empty transcription renders no subtitles and no errors
    Given a spec with subtitles enabled and transcription "words": []
    When the composition renders at any frame
    Then SubtitleOverlay renders nothing
    Then no JavaScript errors are thrown

  Scenario: Subtitle position top places overlay at top 40px
    Given a spec with "subtitles": {"enabled": true, "position": "top"}
    When SubtitleOverlay renders
    Then the component is positioned at top 40px
