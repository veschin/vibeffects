@feature:transcription-pipeline
Feature: transcription-pipeline

  Scenario: Transcribe mp3 produces transcription.json with words array
    Given an mp3 file exists at "projects/test-project/audio/narration.mp3"
    When the transcribe script is run with that path
    Then "projects/test-project/transcription.json" is created
    Then the file contains a "words" array where each item has "text", "startMs", "endMs", "confidence"
    Then the file contains a "durationMs" field

  Scenario: Transcribe mp4 auto-converts to WAV before processing
    Given an mp4 file exists at "projects/test-project/audio/recording.mp4"
    When the transcribe script is run with that path
    Then ffmpeg converts the file to a temporary WAV at 16000 Hz mono PCM s16le
    Then the temporary WAV file is deleted after transcription completes

  Scenario: File not found exits with code 1
    Given no file exists at "projects/test-project/audio/missing.mp3"
    When the transcribe script is run with "projects/test-project/audio/missing.mp3"
    Then the process exits with code 1
    Then stderr contains "file not found: projects/test-project/audio/missing.mp3"

  Scenario: Sub-word tokens are merged into whole words
    Given a transcription where Whisper returned tokens "кожа" at 4040-4200ms and "скрипт" at 4200-4600ms as sub-words of one word
    When post-processing runs
    Then the merged word is "кожаскрипт" with startMs 4040 and endMs 4600

  Scenario: Punctuation-only tokens are removed from words array
    Given a raw Whisper output containing tokens ["Привет", ",", "мир", "."]
    When post-processing runs
    Then the words array contains only ["Привет", "мир"] with no punctuation tokens

  Scenario: Segments cover full audio duration with no gaps
    Given "transcription.json" from transcription-real.json with "durationMs": 30000
    When the segment script runs
    Then segments[0].startSec equals 0
    Then segments[last].endSec equals 30.0
    Then for every adjacent pair segments[N].endSec equals segments[N+1].startSec

  Scenario: Segment shorter than 10s is merged with neighbour
    Given Claude returns a segment with startSec 0.0 and endSec 7.0 adjacent to a segment ending at 25.0
    When the post-processing merges short segments
    Then no segment in the output is shorter than 10 seconds

  Scenario: Missing transcription.json causes segment script to exit with code 1
    Given no transcription.json exists in "projects/empty-project/"
    When the segment script is run for project "empty-project"
    Then the process exits with code 1
    Then stderr contains "transcription.json not found in project 'empty-project'"

  Scenario: ffmpeg not in PATH causes transcribe to exit with code 1
    Given ffmpeg is not installed or not in PATH
    When the transcribe script is run
    Then the process exits with code 1
    Then stderr contains "ffmpeg is required but not found in PATH"
