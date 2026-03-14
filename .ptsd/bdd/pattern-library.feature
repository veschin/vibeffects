@feature:pattern-library
Feature: pattern-library

  Scenario: PATTERN_REGISTRY contains all 22 patterns
    Given the pattern registry is loaded from src/patterns/index.ts
    When the registry keys are enumerated
    Then the count is 22
    Then all IDs are in kebab-case

  Scenario: resolveContent with valid PatternInstance returns Element array
    Given content items from patterns-happy.json including "title-card" with params "text": "ClojureScript"
    When resolveContent is called with a valid ResolveContext
    Then each PatternInstance resolves to a non-empty Element array

  Scenario: resolveContent with unknown pattern ID throws error
    Given a PatternInstance from pattern-unknown.json with pattern "nonexistent-pattern"
    When resolveContent is called
    Then an error is thrown with message "unknown pattern: 'nonexistent-pattern'"

  Scenario: Zod validation rejects invalid pattern params
    Given a "bullet-reveal" PatternInstance with "items": [] from pattern-empty-items.json
    When resolveContent is called
    Then a ZodError is thrown referencing the "items" field path

  Scenario: title-card resolves heading plus text elements with staggered enterSec
    Given a "title-card" PatternInstance with params "text": "ClojureScript" and "subtitle": "Функциональный фронтенд"
    When resolveContent is called
    Then the result contains a heading element and a text element
    Then the text element has enterSec at least 0.5s after the heading element

  Scenario: bullet-reveal staggeres items by revealIntervalSec
    Given a "bullet-reveal" PatternInstance with 4 items and "revealIntervalSec": 1.5
    When resolveContent is called
    Then the returned bulletList element has 4 items
    Then each item's enterSec offset is 1.5s more than the previous

  Scenario: code-walkthrough generates code element with highlight groups
    Given a "code-walkthrough" PatternInstance with code from patterns-happy.json and "highlights": [[1,2],[4]]
    When resolveContent is called
    Then the result contains a code element
    Then the code element has 2 highlight groups referencing lines [1,2] and [4]

  Scenario: architecture-diagram generates graph element
    Given an "architecture-diagram" PatternInstance with 3 nodes and 2 edges from spec-happy.json scene "repl"
    When resolveContent is called
    Then the result contains a graph element
    Then the graph element includes all 3 nodes and 2 edges

  Scenario: web-scroll missing screenshot causes render error
    Given a "web-scroll" PatternInstance with a URL that has no file in web-captures/
    When resolveContent is called and the composition renders
    Then Remotion throws a file-not-found error

  Scenario: external-video renders OffthreadVideo from assets path
    Given an "external-video" PatternInstance with "src": "demo.mp4" and "trim": {"from": 0, "to": 10}
    When resolveContent is called
    Then the result contains a video element with the resolved assets path and trim values

  Scenario: pie-chart with one segment is rejected by Zod
    Given a "pie-chart" PatternInstance with "segments": [{"label": "A", "value": 100}]
    When resolveContent is called
    Then a ZodError is thrown with message containing "at least 2"

  Scenario: stat-card with numeric value generates counter animation
    Given a "stat-card" PatternInstance with "value": 42 and "label": "Stars"
    When resolveContent is called
    Then the result contains a counter element animating from 0 to 42

  Scenario: ResolveContext is passed to every pattern resolve call
    Given a ResolveContext with "sceneDurationSec": 45.2 and "accent": "#6366f1" and fps 30
    When a "key-point" PatternInstance is resolved
    Then the pattern receives sceneDurationSec 45.2 and accent "#6366f1" and fps 30
