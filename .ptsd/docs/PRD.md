# vibeffects v2 -- Product Requirements Document

## Обзор

vibeffects v2 -- движок генерации видео из подкастов на базе Remotion. Человек записывает аудио, Whisper транскрибирует, Claude генерирует визуальную спецификацию, Remotion рендерит финальное видео.

**Ключевое отличие от v1:** в v1 было 14 фиксированных типов слайдов, и AI писал контент. В v2 человек говорит -- AI только визуализирует. Движок предоставляет библиотеку визуальных паттернов, AI подбирает подходящие паттерны для визуализации содержимого речи.

### Архитектура: три слоя

1. **Elements** -- атомарные рендереры (text, heading, code, image, graph, chart, table, bullet list, badge, divider, callout, counter, progress, icon). Каждый -- React-компонент с типизированными пропсами.
2. **Patterns** -- рецепты, которые разворачиваются в массив Element с layout и timing. AI выбирает паттерны из каталога.
3. **Scenes** -- контейнеры с таймкодами, привязанные к аудиосегментам.

### Pipeline

```
1. make init PROJECT=name          → структура проекта
2. Кладём mp3/mp4                  → projects/name/audio/
3. make transcribe PROJECT=name    → Whisper → transcription.json
4. Интерактивно в Claude Code:     → scenario.json + spec.json
5. make capture PROJECT=name       → скриншоты для web-scroll
6. make studio PROJECT=name        → Remotion Studio
7. make render PROJECT=name        → mp4
```

### Формат: 16:9 (1920x1080). Shorts не поддерживаются.

### Структура каталогов

```
src/
  engine/
    types.ts              # VideoSpec, SceneSpec, Element union, Pattern types
    timing.ts             # Audio-driven timing
    layout.ts             # Stage layout engine
    animations.ts         # Spring-анимации
    context.ts            # ThemeContext + DesignTokens
    palette.ts            # 6 пресетов палитр
    fonts.ts              # Типографская шкала
    font-loader.ts        # Загрузка Google Fonts
    loadSpec.ts           # Загрузка спецификации + транскрипции
    resolve.ts            # Резолюция паттернов в элементы
    design-constants.ts   # Все пиксельные размеры в одном месте
  patterns/               # 22 реализации паттернов
  elements/               # 14 компонентов элементов
  components/             # SceneRenderer, ElementRenderer, Overlay, Deco3D,
                          # SubtitleOverlay, CommentaryOverlay
  lib/                    # parseOrgMarkup, prismSetup
  Composition.tsx         # Оркестратор с <Audio>
  Root.tsx                # Remotion root
scripts/
  init-project.ts         # Создание структуры проекта
  transcribe.ts           # Whisper транскрипция
  capture-web.ts          # Puppeteer → скриншоты для web-scroll
  validate-spec.ts        # Валидация спецификации (Zod)
projects/                 # Один каталог на эпизод
  <name>/
    web-captures/         # Скриншоты web-scroll паттерна (Puppeteer)
Makefile
```

### Makefile

```makefile
PROJECT ?= default

init:           # Scaffold нового проекта
transcribe:     # Audio -> transcription.json (Whisper)
capture:        # Puppeteer → web-captures/ (для web-scroll паттерна)
validate:       # Валидация spec.json (Zod)
studio:         # Remotion Studio с hot-reload
render:         # Software render -> mp4
render-hw:      # GPU render (NVIDIA h264_nvenc)
render-vaapi:   # AMD/Intel hardware encode
pipeline:       # Полный цикл: transcribe -> render
```

### Что переиспользуется из legacy

| Компонент | Источник | Действие |
|-----------|----------|----------|
| Whisper-интеграция | youtube_v4 `scripts/transcribe.ts` | Скопировать, адаптировать |
| 6 палитр | legacy `palette.ts` | Копия as-is |
| Spring-анимации | legacy `animations.ts` | Копия хуков |
| Org-markup парсер | legacy `parseOrgMarkup.tsx` | Копия |
| ELK graph layout | legacy `useElkLayout.ts` | Копия |
| Stage layout engine | legacy `stageLayout.ts` | Эволюция в core |
| Font loader | legacy `font-loader.ts` | Копия |
| Design constants | youtube_v4 `design-constants.ts` | Перенос подхода |

---

## Features

<!-- feature:engine-core -->

### 1. engine-core -- Ядро движка рендеринга

**Одной строкой:** Система типов, audio-driven timing, stage layout, анимации и тема -- все, что нужно для рендеринга сцен из элементов.

#### Проблема

В v1 тайминг считался эвристически (количество слов / wordsPerSec). Это приводило к рассинхронизации видео и аудио: текст появлялся раньше или позже, чем автор об этом говорил. Фиксированные слайды не позволяли размещать несколько элементов на экране одновременно с независимыми таймингами.

Затрагивает: автора (видео не синхронизировано с речью), AI-генератор (не может точно управлять визуализацией), зрителя (контент не соответствует аудио).

#### Acceptance Criteria

**Типы данных:**

- AC-1.1: `VideoSpec` содержит поле `version: 2`. Спецификация с `version: 1` или без поля `version` отклоняется Zod-валидацией с ошибкой `"unsupported spec version"`.
- AC-1.2: `Element` -- discriminated union из 14 типов (`text`, `heading`, `code`, `image`, `bulletList`, `table`, `graph`, `chart`, `icon`, `divider`, `badge`, `progress`, `counter`, `callout`). Каждый тип имеет `BaseElement` поля (`id`, `enterSec`, `exitSec?`, `position?`, `animation?`). TypeScript compilation fails если передать неизвестный тип.
- AC-1.3: `SceneSpec` содержит `startSec` и `endSec` (числа >= 0, `endSec > startSec`). Zod-схема отклоняет `endSec <= startSec` с ошибкой `"endSec must be greater than startSec"`.
- AC-1.4: `ContentItem` -- union `PatternInstance | RawElement`. `PatternInstance` содержит `pattern: string` (ID из каталога), `params: Record<string, unknown>`, опциональные `enterSec` и `durationSec`. `RawElement` -- любой из 14 Element-типов.

**Audio-driven timing:**

- AC-1.5: Длительность сцены определяется полями `startSec` / `endSec` из транскрипции, а не эвристикой по количеству слов. `getTotalDurationFrames(spec)` вычисляет общую длительность как `max(scene.endSec) * fps`.
- AC-1.6: Каждый элемент внутри сцены имеет `enterSec` (относительно начала сцены) и опциональный `exitSec`. Элемент виден на канвасе ровно в интервале `[scene.startSec + el.enterSec, el.exitSec ?? scene.endSec]`.
- AC-1.7: Remotion `<Audio>` компонент воспроизводит аудиофайл из `spec.audio`. Аудио начинается с кадра 0 и длится до конца композиции.

**Stage layout engine:**

- AC-1.8: `calculateElementStates(frame, fps, elements, viewport)` принимает массив элементов и возвращает массив `ElementState` с позициями (`x`, `y`, `width`, `height`), `opacity`, `scale`, `translateY`, `phase`, `zIndex`.
- AC-1.9: Поддерживает фазы `hidden`, `focus`, `refocus`, `grid`. При `focus` -- элемент занимает 78% x 72% viewport по центру; остальные элементы dimmed. При `grid` -- элементы распределены по доступному пространству с content-aware весами.
- AC-1.10: При появлении нового элемента существующие элементы плавно перемещаются к новым позициям (spring interpolation, `durationInFrames = fps * 0.85`). Резких скачков нет.

**Анимации:**

- AC-1.11: `useSlideAnimation(durationInFrames)` возвращает `{ opacity, translateY, frame, fps }`. Entrance: spring с `damping: 200`, длительность `fps * 0.8` кадров. Exit: линейный fade за 18 кадров до конца.
- AC-1.12: `useBlockEntrance(type, delayFrames, direction)` поддерживает направления `left`, `right`, `bottom`, `center`. Для `center` -- scale от 0.92 до 1.0.

**Тема:**

- AC-1.13: `ThemeContext` предоставляет через React Context: palette (цвета), fonts (display, body, code), design tokens (все пиксельные размеры). Доступ через хуки `usePalette()`, `useThemeFonts()`, `useTypeScale()`.
- AC-1.14: 6 пресетов палитр: `dark-cosmos`, `warm-ember`, `deep-ocean`, `nibelung`, `rose-quartz`, `acid-neon`. Каждая палитра содержит: bg, surface, surfaceElevated, overlay, text (3 уровня), border (2 уровня), glow, shadow (2 уровня), blurAmount, radiusBlock, radiusSmall, deco3dPrimary, deco3dSecondary.
- AC-1.15: Шрифты загружаются через `@remotion/google-fonts`. Реестр включает 5 display (Raleway, Montserrat, Comfortaa, Oswald, Rubik), 5 body (Manrope, Nunito, Open Sans, PT Sans, Roboto), 4 code (JetBrains Mono, Fira Code, Source Code Pro, Ubuntu Mono). Все шрифты загружаются с subset `cyrillic` + `latin`.
- AC-1.16: `design-constants.ts` -- единственный источник истины для всех пиксельных размеров (padding, gap, heading height, focus ratios). Ни один компонент не содержит magic numbers -- все импортируются из этого файла.

#### Non-goals

- Поддержка формата 9:16 (Shorts/Reels). Только 16:9.
- Поддержка нескольких аудиодорожек или микширование аудио.
- Realtime preview с аудио в браузере (Remotion Studio обеспечивает это из коробки).
- Анимации по keyframes (only spring-based и linear interpolation).

#### Edge cases

- **Пустой массив `scenes`:** Композиция рендерится как 1 черный кадр. Длительность = 1 фрейм.
- **Сцена без `content`:** Рендерится пустой фон сцены (background + accent color) на всю длительность `endSec - startSec`.
- **`enterSec` элемента > длительности сцены:** Элемент никогда не появляется. Zod-валидация выдает warning (не ошибку).
- **Два элемента с одинаковым `id` внутри сцены:** Zod-валидация отклоняет спецификацию с ошибкой `"duplicate element id '<id>' in scene '<sceneId>'"`.
- **Шрифт не найден в реестре:** `font-loader.ts` логирует `[font-loader] Font "<name>" is not in the registry. Falling back to system font.` и использует системный шрифт.
- **Аудиофайл не найден:** Remotion выбрасывает ошибку при `<Audio>`. Движок не пытается рендерить без аудио.
- **`startSec` и `endSec` в spec не совпадают с длительностью аудио:** Используются значения из spec. Если `endSec` последней сцены превышает длительность аудио, аудио заканчивается раньше. Видео продолжается в тишине.

---

<!-- feature:pattern-library -->

### 2. pattern-library -- Библиотека визуальных паттернов

**Одной строкой:** Каталог из 22 паттернов -- функций, которые принимают параметры и возвращают массив размещенных элементов с layout и timing.

#### Проблема

В v1 AI должен был собирать каждый слайд вручную, выбирая тип и заполняя все поля. Это приводило к однообразным визуализациям и частым ошибкам в структуре данных. AI лучше работает с высокоуровневыми "рецептами": назвать паттерн + заполнить семантические параметры, а не конструировать низкоуровневый layout.

Затрагивает: AI-генератор (проще и надежнее генерировать спецификации), автора (более разнообразные визуализации без ручной работы).

#### Acceptance Criteria

**Архитектура паттернов:**

- AC-2.1: Каждый паттерн -- TypeScript-модуль в `src/patterns/`, экспортирующий объект `{ id: string, schema: ZodSchema, resolve: (params, ctx) => Element[] }`. `schema` валидирует `params` перед вызовом `resolve`.
- AC-2.2: `src/patterns/index.ts` экспортирует `PATTERN_REGISTRY: Record<string, PatternDefinition>` -- реестр всех 22 паттернов. Ключ -- `id` паттерна (строка в kebab-case).
- AC-2.3: `resolve.ts` содержит функцию `resolveContent(content: ContentItem[], ctx: ResolveContext): Element[]`. Для `PatternInstance` -- вызывает `PATTERN_REGISTRY[pattern].resolve(params, ctx)`. Для `RawElement` -- возвращает as-is. Неизвестный `pattern` ID выбрасывает ошибку `"unknown pattern: '<id>'"`.
- AC-2.4: Zod-валидация params происходит при вызове `resolveContent`. Невалидные params выбрасывают `ZodError` с путем к конкретному невалидному полю.

**Каталог (22 паттерна):**

- AC-2.5: `title-card` -- принимает `{ text: string, subtitle?: string, tagline?: string }`. Генерирует heading + text элементы. Heading с presentation `cinematic`, текстовые элементы с `enterSec` с задержкой 0.5с относительно heading.
- AC-2.6: `key-point` -- принимает `{ statement: string, emphasis?: string }`. Генерирует один text-элемент крупным шрифтом по центру. Если `emphasis` задан, выделенное слово оборачивается в org-markup `*emphasis*`.
- AC-2.7: `bullet-reveal` -- принимает `{ title?: string, items: string[], revealIntervalSec?: number }`. Генерирует bulletList-элемент. Каждый item появляется с задержкой `revealIntervalSec` (default: 1.5с). `items` должен содержать >= 1 элемент.
- AC-2.8: `code-walkthrough` -- принимает `{ code: string, language: string, highlights?: number[][] }`. Генерирует code-элемент. `highlights` -- массив массивов номеров строк; каждая группа подсвечивается последовательно.
- AC-2.9: `architecture-diagram` -- принимает `{ nodes: { id: string, label: string, group?: string }[], edges: { from: string, to: string, label?: string }[] }`. Генерирует graph-элемент. Layout рассчитывается через ELK.js. Узлы раскрываются группами с задержкой 1с между группами.
- AC-2.10: `process-flow` -- принимает `{ steps: { label: string, description?: string }[], direction?: "horizontal" | "vertical" }`. Генерирует последовательность badge + divider + text элементов. Steps >= 2.
- AC-2.11: `comparison` -- принимает `{ left: { label: string, items: string[] }, right: { label: string, items: string[] }, criteria?: string[] }`. Генерирует два столбца элементов. Левый и правый столбцы появляются с задержкой 0.5с.
- AC-2.12: `data-table` -- принимает `{ headers: string[], rows: string[][], highlightRows?: number[] }`. Генерирует table-элемент. `rows` >= 1. `highlightRows` -- индексы строк (0-based), которые выделяются accent-цветом.
- AC-2.13: `timeline` -- принимает `{ events: { date: string, title: string, description?: string }[] }`. Генерирует последовательность badge + text элементов вдоль вертикальной линии. Events >= 2.
- AC-2.14: `metric-dashboard` -- принимает `{ metrics: { label: string, value: number, unit?: string, prefix?: string }[] }`. Генерирует counter-элементы с анимированным отсчетом от 0 до value. Metrics >= 1, <= 6.
- AC-2.15: `quote-card` -- принимает `{ text: string, author?: string, source?: string }`. Генерирует callout-элемент стиля "quote" с текстом в кавычках и атрибуцией.
- AC-2.16: `split-media` -- принимает `{ src: string, text: string, side?: "left" | "right" }`. Генерирует image + text элементы в двухколоночном layout. `side` определяет, с какой стороны image (default: `"left"`).
- AC-2.17: `concept-map` -- принимает `{ center: string, branches: { label: string, children?: string[] }[] }`. Генерирует graph-элемент с радиальным layout от центрального узла. Branches >= 2.
- AC-2.18: `stack-diagram` -- принимает `{ layers: { name: string, description?: string, color?: string }[] }`. Генерирует стопку badge-элементов снизу вверх. Layers >= 2.
- AC-2.19: `before-after` -- принимает `{ before: { label: string, content: string }, after: { label: string, content: string } }`. Генерирует два столбца с heading + text в каждом. Столбец "before" появляется первым, "after" -- через 1.5с.
- AC-2.20: `callout` -- принимает `{ type: "warning" | "tip" | "note" | "important", text: string, title?: string }`. Генерирует callout-элемент с иконкой, соответствующей типу, и accent-цветом.
- AC-2.21: `term-definition` -- принимает `{ term: string, definition: string, example?: string }`. Генерирует heading (term) + text (definition) + опциональный code (example) элементы.
- AC-2.22: `web-scroll` -- принимает `{ url: string, caption?: string, scrollSpeed?: "slow" | "normal" | "fast" }`. Загружает полностраничный скриншот из `web-captures/` (заранее снятый Puppeteer через `make capture`). Рендерит анимированный вертикальный скролл внутри browser chrome frame (traffic lights, URL bar). Скролл использует ease-in-out easing. Путь к скриншоту определяется хешированием URL. Default `scrollSpeed`: `"normal"`.
- AC-2.23: `external-video` -- принимает `{ src: string, trim?: { from: number, to: number }, caption?: string }`. Рендерит внешний видеофайл через Remotion `<OffthreadVideo>`. `src` -- путь относительно `projects/<PROJECT>/assets/`. `trim.from` и `trim.to` -- секунды (default: от начала до конца). Caption опционально под видео. Если файл не найден, рендеринг падает с ошибкой Remotion.
- AC-2.24: `pie-chart` -- принимает `{ segments: { label: string, value: number, color?: string }[], title?: string }`. Анимированная круговая диаграмма: сегменты появляются один за другим с rotation-анимацией. `segments` >= 2. Если `color` не задан, используются цвета из текущей палитры.
- AC-2.25: `line-chart` -- принимает `{ points: { x: string, y: number }[], title?: string, yLabel?: string }`. Линейный график с анимированным рисованием слева направо. `points` >= 2. Ось Y масштабируется автоматически по min/max значениям.
- AC-2.26: `stat-card` -- принимает `{ value: string | number, label: string, delta?: { value: number, direction: "up" | "down" } }`. Крупное анимированное число/значение по центру, подпись ниже. Если `delta` задан, показывает индикатор изменения с цветом (зелёный для `"up"`, красный для `"down"`). Число анимируется counter-эффектом если `value` -- number.

**ResolveContext:**

- AC-2.27: `ResolveContext` передается в каждый `resolve()` и содержит: `sceneDurationSec: number`, `accent: string` (hex), `palette: Palette`, `fonts: ThemeFonts`, `fps: number`. Паттерн использует context для расчета timing и стилей.

#### Non-goals

- Визуальный редактор паттернов (drag-and-drop). Паттерны определяются кодом.
- Runtime-загрузка паттернов из URL. Только статический реестр + project custom.
- Анимации переходов между паттернами (переходы -- между сценами, не между паттернами внутри сцены).
- Адаптивный layout для разных разрешений. Все размеры заточены под 1920x1080.

#### Edge cases

- **Пустой массив `items`/`steps`/`events`/`segments`/`points` в паттерне:** Zod-схема отклоняет с ошибкой `"array must contain at least 1 element"` (или 2 для `process-flow`, `timeline`, `concept-map`, `stack-diagram`, `pie-chart`, `line-chart`).
- **Неизвестный `pattern` ID в `PatternInstance`:** `resolveContent` выбрасывает ошибку `"unknown pattern: '<id>'"`. Рендеринг прерывается.
- **`enterSec` паттерна не задан:** Используется 0 (начало сцены).
- **`durationSec` паттерна не задан:** Элементы паттерна остаются видимыми до конца сцены.
- **Паттерн генерирует элементы с `enterSec` за пределами сцены:** Элементы не появляются. Warning в консоль: `"pattern '<id>' generates elements outside scene bounds"`.
- **`highlights` в `code-walkthrough` ссылаются на несуществующие строки:** Игнорируются. Подсвечиваются только существующие строки.
- **`highlightRows` в `data-table` с индексом >= rows.length:** Игнорируются.
- **`web-scroll` ссылается на URL, для которого нет скриншота в `web-captures/`:** Рендеринг падает с ошибкой Remotion (файл не найден). Пользователь должен запустить `make capture` перед рендерингом.
- **`external-video` ссылается на несуществующий файл:** `<OffthreadVideo>` выбрасывает ошибку Remotion. Рендеринг прерывается.
- **`trim.to` > длительности видео в `external-video`:** Видео заканчивается по своей фактической длительности. Оставшееся время -- чёрный кадр.
- **`pie-chart` с одним сегментом:** Zod-схема отклоняет -- минимум 2 сегмента.
- **`line-chart` с одной точкой:** Zod-схема отклоняет -- минимум 2 точки.

---

<!-- feature:transcription-pipeline -->

### 3. transcription-pipeline -- Транскрипция аудио

**Одной строкой:** Whisper-интеграция для получения word-level timestamps из аудио и сегментация транскрипции по темам через Claude API.

#### Проблема

Для audio-driven timing нужны точные таймкоды каждого слова. Ручная расстановка таймкодов нереалистична для подкастов длительностью 10-60 минут. Кроме того, для генерации сцен нужно разбить поток речи на тематические сегменты -- это семантическая задача, которую решает LLM.

Затрагивает: автора (ручной тайминг -- дни работы), pipeline (без таймкодов невозможна синхронизация видео и аудио).

#### Acceptance Criteria

**Транскрипция (`scripts/transcribe.ts`):**

- AC-3.1: Скрипт принимает путь к mp3 или mp4 файлу как аргумент. Если файл не существует, завершается с exit code 1 и сообщением `"file not found: <path>"`.
- AC-3.2: Если входной файл -- mp4 или формат не WAV 16KHz mono, скрипт конвертирует в WAV (16000 Hz, mono, PCM s16le) через ffmpeg. Временный WAV файл удаляется после транскрипции.
- AC-3.3: Использует `@remotion/install-whisper-cpp` для установки Whisper при первом запуске. Модель: `medium`. Автоматическая загрузка модели если не установлена.
- AC-3.4: Запускает Whisper с `tokenLevelTimestamps: true`. Выходной формат:
  ```json
  {
    "words": [
      { "text": "слово", "startMs": 1200, "endMs": 1450, "confidence": 0.92 }
    ],
    "durationMs": 180000
  }
  ```
- AC-3.5: Постобработка: sub-word tokens (части слов, разбитые Whisper) мержатся в целые слова. Punctuation-only tokens (`"."`, `","`, `"!"`) удаляются. Результат: каждый элемент `words` -- полноценное слово.
- AC-3.6: Результат записывается в `projects/<PROJECT>/transcription.json`. Если файл уже существует, перезаписывается.

**Сегментация (`scripts/segment.ts`):**

- AC-3.7: Скрипт читает `transcription.json` из каталога проекта. Если файл не существует, завершается с exit code 1 и сообщением `"transcription.json not found in project '<PROJECT>'"`.
- AC-3.8: Отправляет текст транскрипции в Claude API (model: `claude-sonnet-4-20250514`) с промптом для идентификации тематических сегментов. Промпт инструктирует: определить границы смены темы, выделить ключевые фразы, дать заголовок каждому сегменту.
- AC-3.9: Выходной формат:
  ```json
  {
    "segments": [
      {
        "startSec": 0.0,
        "endSec": 45.2,
        "topic": "Введение в тему",
        "keyPhrases": ["ключевое понятие", "другой термин"]
      }
    ]
  }
  ```
- AC-3.10: Сегменты покрывают всю длительность аудио без пробелов: `segments[0].startSec === 0` и `segments[last].endSec === durationMs / 1000`. `segments[N].endSec === segments[N+1].startSec` для всех N.
- AC-3.11: Минимальная длительность сегмента: 10 секунд. Если Claude вернул сегмент короче 10с, он мержится с соседним.
- AC-3.12: Результат записывается в `projects/<PROJECT>/segments.json`.

#### Non-goals

- Поддержка языков кроме русского и английского (Whisper medium поддерживает их, но мы не тестируем другие).
- Diarization (определение говорящего). Один спикер на подкаст.
- Транскрипция в реальном времени (streaming).
- Ручная корректировка транскрипции через UI.

#### Edge cases

- **Аудио короче 5 секунд:** Whisper может не вернуть слов. Скрипт генерирует пустой `transcription.json` с `"words": [], "durationMs": <actual>`. Сегментация создает один сегмент на всю длительность.
- **Аудио длиннее 2 часов:** Whisper обрабатывает файл целиком (без разбивки). Время обработки может быть значительным (10+ минут). Прогресс выводится в stdout.
- **ffmpeg не установлен:** Скрипт проверяет наличие ffmpeg при запуске. Если не найден, завершается с exit code 1 и сообщением `"ffmpeg is required but not found in PATH"`.
- **ffprobe не установлен:** Аналогично ffmpeg, проверяется при запуске.
- **Claude API недоступен (сегментация):** Скрипт повторяет запрос 3 раза с экспоненциальной задержкой (1с, 2с, 4с). После 3 неудач завершается с exit code 1.
- **Claude возвращает невалидный JSON:** Скрипт парсит ответ, при ошибке парсинга повторяет запрос (до 3 раз).
- **Аудио содержит длинные паузы (>10с тишины):** Whisper может разбить слова с большими промежутками. Сегментация обрабатывает это корректно -- паузы попадают в сегмент.

---

<!-- feature:scenario-workflow -->

### 4. scenario-workflow -- Интерактивный сценарий

**Одной строкой:** Интерактивный процесс создания видеоспецификации: AI анализирует транскрипцию, создаёт scenario.json (разбивка на сцены, планируемые вставки, запросы ассетов, комментарии), автор ревьюит и предоставляет ассеты, сценарий финализируется в spec.json.

#### Проблема

Ручное написание spec.json для 20-минутного подкаста -- это 200+ строк JSON с точными таймкодами, выбором паттернов и заполнением параметров. Одноразовая автогенерация (v1-подход) давала посредственный результат: AI не знает, какие ассеты доступны, не может учесть контекст, который знает только автор. Нужен интерактивный процесс: AI предлагает сценарий, автор ревьюит и дополняет, AI финализирует.

Затрагивает: автора (основной bottleneck в pipeline), качество визуализации (интерактивный процесс даёт результат лучше одноразовой генерации), скорость итераций.

#### Acceptance Criteria

**Создание сценария (интерактивно в Claude Code):**

- AC-4.1: AI читает `transcription.json` из каталога проекта. Если файл не существует, сообщает пользователю: `"transcription.json not found in project '<PROJECT>'. Run make transcribe first."`.
- AC-4.2: AI анализирует транскрипцию и создаёт `scenario.json` -- промежуточный документ:
  ```json
  {
    "scenes": [
      {
        "id": "intro",
        "startSec": 0.0,
        "endSec": 45.2,
        "topic": "Введение",
        "plannedPatterns": ["title-card", "key-point"],
        "notes": "Нужна вводная картинка или скриншот проекта"
      }
    ],
    "assetRequests": [
      { "id": "intro-screenshot", "description": "Скриншот главной страницы проекта", "context": "Автор упоминает сайт проекта в первые 30 секунд" }
    ],
    "commentary": [
      { "startSec": 12.5, "text": "На самом деле это не совсем так", "type": "correction" }
    ]
  }
  ```
- AC-4.3: `scenario.json` содержит `assetRequests: AssetRequest[]` -- список ассетов, которые AI хочет использовать. `AssetRequest`: `{ id: string, description: string, context: string }`. AI описывает что нужно и зачем; автор решает, предоставить ассет или нет.
- AC-4.4: AI генерирует `commentary` entries в сценарии, анализируя содержание транскрипции. Типы: `"correction"` (автор ошибся или неточен), `"note"` (пояснение/контекст), `"joke"` (ироничный комментарий). Комментарии привязаны к таймкодам из транскрипции.
- AC-4.5: Автор ревьюит сценарий в Claude Code: утверждает/отклоняет сцены, предоставляет ассеты (кладёт файлы в `projects/<PROJECT>/assets/`), корректирует комментарии. Процесс итеративный -- AI обновляет `scenario.json` по запросу.

**Финализация в spec.json:**

- AC-4.6: После утверждения сценария AI генерирует финальный `spec.json` из `scenario.json`:
  - Каждая сцена из сценария → `SceneSpec` с конкретными паттернами и заполненными параметрами.
  - `assetRequests` резолвятся в конкретные пути к файлам в `assets/`.
  - `commentary` entries переносятся в `spec.commentary`.
  - Таймкоды `startSec`/`endSec` берутся из сценария (изначально из транскрипции).
- AC-4.7: Назначает accent-цвета сценам. Соседние сцены не должны иметь одинаковый accent. Используются цвета из текущей палитры.
- AC-4.8: После генерации AI запускает Zod-валидацию. Если валидация не проходит, AI исправляет ошибки в spec самостоятельно (итеративно в Claude Code).
- AC-4.9: Результат записывается в `projects/<PROJECT>/spec.json`.

**Валидация (`scripts/validate-spec.ts`):**

- AC-4.10: Скрипт читает `spec.json` из каталога проекта и запускает Zod-валидацию. Выводит результат: `"valid"` или список ошибок с путями к невалидным полям.
- AC-4.11: Валидация включает: структуру VideoSpec, все SceneSpec, все ContentItem (PatternInstance и RawElement), `commentary` массив, `subtitles` конфиг. Для PatternInstance дополнительно валидируются params по Zod-схеме соответствующего паттерна.

**Интерактивная доработка:**

- AC-4.12: Финальный `spec.json` можно дорабатывать в Claude Code. Пользователь просит изменения (сменить паттерн, поправить текст, изменить тайминг, добавить/убрать комментарии), AI редактирует файл напрямую.
- AC-4.13: `make validate` проверяет spec после ручных правок. Если spec невалиден, выводит ошибки.

#### Non-goals

- AI-генерация изображений или скриншотов. AI только подбирает паттерны и текстовый контент. Изображения предоставляет автор.
- Полностью автоматическая генерация без ревью (one-shot). Процесс всегда интерактивный.
- Генерация spec без транскрипции (из текстового скрипта). Транскрипция обязательна для таймкодов.
- Автоматическое скачивание ассетов по URL из `assetRequests`. Автор кладёт файлы вручную.

#### Edge cases

- **Транскрипция пуста (0 слов):** AI создаёт сценарий с одной сценой и паттерном `title-card` с текстом из `meta.title`.
- **Очень длинная транскрипция (>60 минут):** AI может обрабатывать сценарий частями -- сначала первую половину, потом вторую. Финальный spec собирается из частей.
- **Автор не предоставил запрошенные ассеты:** AI генерирует spec без этих ассетов, заменяя `split-media` на `key-point` или другой текстовый паттерн.
- **`assetRequests` ссылается на ассет, файл которого отсутствует в `assets/`:** Zod-валидация не проверяет существование файлов. Ошибка при рендеринге.
- **`commentary` entry с `startSec` за пределами аудио:** Комментарий никогда не появляется. Zod-валидация выдаёт warning.
- **Промпт превышает context window Claude Code:** AI работает итеративно, обрабатывая части транскрипции последовательно.

---

<!-- feature:customization -->

### 5. customization -- Система кастомизации проектов

**Одной строкой:** Трехуровневая система переопределений (engine defaults -> user presets -> project custom) и инфраструктура для пользовательских паттернов, элементов и тем.

#### Проблема

Разные подкасты требуют разного визуального стиля: технический подкаст -- один набор паттернов и цветов, образовательный -- другой. В v1 стиль был глобальным. Автору нужна возможность настраивать внешний вид per-project, добавлять собственные паттерны и переопределять стандартные компоненты.

Затрагивает: автора (хочет разный стиль для разных серий), продвинутого пользователя (хочет кастомные визуализации без fork движка).

#### Acceptance Criteria

**Структура проекта:**

- AC-5.1: `make init PROJECT=name` создает структуру каталогов:
  ```
  projects/name/
    audio/
    assets/
    custom/
      patterns/
      components/
      theme.json
    out/
  ```
  Если каталог `projects/name/` уже существует, скрипт завершается с exit code 1 и сообщением `"project 'name' already exists"`.
- AC-5.2: `theme.json` создается с минимальным шаблоном: `{ "palette": "dark-cosmos", "fonts": {} }`. Это валидный ThemeConfig.

**Три уровня переопределений:**

- AC-5.3: Уровень 1 (engine defaults): `src/engine/palette.ts`, `src/engine/fonts.ts`, `src/engine/design-constants.ts`. Базовые значения, используемые если ничего не переопределено.
- AC-5.4: Уровень 2 (user presets): `~/.vibeffects/theme.json`. Если файл существует, его значения мержатся поверх engine defaults. Deep merge: вложенные объекты мержатся рекурсивно, примитивы перезаписываются.
- AC-5.5: Уровень 3 (project custom): `projects/<PROJECT>/custom/theme.json`. Мержится поверх user presets. Это финальная тема для проекта.
- AC-5.6: Порядок резолюции: engine defaults <- `~/.vibeffects/theme.json` <- `projects/<PROJECT>/custom/theme.json` <- `spec.json.theme` (inline в спецификации). Каждый уровень может переопределить палитру, шрифты, радиусы, blur.

**Custom patterns:**

- AC-5.7: TSX-файлы в `projects/<PROJECT>/custom/patterns/` подхватываются автоматически при загрузке spec для этого проекта. Каждый файл экспортирует объект, созданный через `definePattern({ id, schema, resolve })`.
- AC-5.8: `definePattern` -- фабрика из `src/engine/resolve.ts`. Принимает `{ id: string, schema: ZodSchema, resolve: (params, ctx) => Element[] }`. Возвращает `PatternDefinition`.
- AC-5.9: Custom patterns добавляются в `PATTERN_REGISTRY` при загрузке проекта. Если custom pattern имеет тот же `id`, что и встроенный, custom перезаписывает встроенный для этого проекта.

**Custom elements:**

- AC-5.10: TSX-файлы в `projects/<PROJECT>/custom/components/` регистрируются через `defineElement({ type, component })`. `type` -- строка, `component` -- React-компонент, принимающий typed props.
- AC-5.11: Custom elements подключаются в `ElementRenderer`. Если custom element имеет тот же `type`, что и встроенный, custom перезаписывает встроенный для этого проекта.

**Theme overrides:**

- AC-5.12: `theme.json` поддерживает поля: `palette` (строка -- имя пресета, или объект -- partial Palette для мержа), `fonts` (partial `{ display?, body?, code? }`), `overrides` (partial Palette для точечных изменений поверх пресета).
- AC-5.13: При указании `palette` как строки -- загружается пресет из `PRESETS`. При указании как объекта -- мержится поверх текущей палитры. `overrides` мержится после `palette`.

#### Non-goals

- Hot-reload custom patterns/elements в Studio (требуется перезапуск `make studio`).
- Версионирование custom patterns (нет lock-файлов, нет dependency resolution).
- Sharing пресетов между пользователями (через npm или registry).
- GUI для настройки темы (только JSON-файлы).

#### Edge cases

- **`~/.vibeffects/` не существует:** Пропускается. Используются engine defaults.
- **`theme.json` содержит невалидный JSON:** Скрипт завершается с exit code 1 и сообщением `"invalid JSON in <path>"`.
- **Custom pattern с дублирующим `id` внутри одного проекта:** Загрузчик берет последний по алфавиту файл. Warning: `"duplicate pattern id '<id>' in project custom patterns, using <filename>"`.
- **Custom pattern `resolve` выбрасывает runtime error:** Ошибка всплывает при рендеринге. Remotion показывает error overlay. Скрипт не пытается fallback на встроенный паттерн.
- **`make init` с невалидным именем проекта (спецсимволы, пробелы):** Скрипт принимает только `[a-z0-9-_]`. Иначе exit code 1 с сообщением `"invalid project name: '<name>'. Use only lowercase letters, digits, hyphens, underscores"`.
- **Custom element `type` совпадает со встроенным:** Custom перезаписывает встроенный. Нет warning (это ожидаемое поведение для override).
- **`spec.json` ссылается на custom pattern, но `custom/patterns/` пуст:** `resolveContent` выбрасывает `"unknown pattern: '<id>'"`.

---

<!-- feature:subtitles -->

### 6. subtitles -- Субтитры из транскрипции

**Одной строкой:** Пословные субтитры, синхронизированные с аудио через word-level timestamps из Whisper. Рендерятся внизу видео ненавязчиво, фразами по 2-5 слов.

#### Проблема

Зритель может смотреть видео без звука (соцсети, публичное место) или на языке, который понимает частично. Субтитры повышают accessibility и engagement. При наличии word-level timestamps из Whisper можно сделать точную синхронизацию без дополнительных инструментов.

Затрагивает: зрителя (accessibility, просмотр без звука), автора (повышение вовлечённости аудитории).

#### Acceptance Criteria

**Компонент субтитров:**

- AC-6.1: `SubtitleOverlay` -- React-компонент, рендерящийся поверх всех сцен (но ниже `CommentaryOverlay`). Позиционируется внизу по центру канваса (bottom: 80px).
- AC-6.2: Компонент читает массив `words` из `transcription.json` (загруженной через `loadSpec`). Каждое слово имеет `startMs`, `endMs`, `text`.
- AC-6.3: Текущий кадр конвертируется в миллисекунды (`frame / fps * 1000`). Находится текущее слово: первое слово, для которого `startMs <= currentMs <= endMs`.
- AC-6.4: Слова группируются во фразы по proximity: слова, между которыми < 200ms паузы, объединяются в одну фразу. Фраза -- единица отображения.
- AC-6.5: На экране одновременно видно максимум 2 строки текста. Если фраза не помещается в 2 строки, она разбивается. Длина строки: max 60 символов.
- AC-6.6: Текущее произносимое слово визуально выделяется: белый цвет, остальные слова фразы -- `rgba(255,255,255,0.6)`. Переход между словами мгновенный (без анимации).
- AC-6.7: Фон субтитров: скруглённый прямоугольник (pill), `rgba(0,0,0,0.65)`, padding `12px 24px`, `borderRadius: 8px`.
- AC-6.8: Анимация появления фразы: fade-in за 6 кадров. Анимация ухода: fade-out за 6 кадров.

**Конфигурация в spec:**

- AC-6.9: `VideoSpec` получает опциональное поле `subtitles`:
  ```typescript
  subtitles?: {
    enabled: boolean       // default: true
    fontSize?: number      // default: 28
    position?: "bottom" | "top"  // default: "bottom"
    style?: "highlight" | "appear"  // default: "highlight"
  } | false  // shorthand: false = disabled
  ```
- AC-6.10: `spec.subtitles: false` -- субтитры выключены. `spec.subtitles` отсутствует -- субтитры включены с defaults.
- AC-6.11: `style: "highlight"` -- все слова фразы видны, текущее выделено (default). `style: "appear"` -- слова фразы появляются по одному, предыдущие остаются видимыми.
- AC-6.12: `position: "top"` -- субтитры вверху (top: 40px). Используется если внизу есть progress bar или другие элементы.

#### Non-goals

- Перевод субтитров на другие языки.
- Ручное редактирование текста субтитров (используется as-is из транскрипции).
- Стилизация отдельных слов (bold, italic) в субтитрах.
- SRT/VTT экспорт.

#### Edge cases

- **Пустая транскрипция (`words: []`):** `SubtitleOverlay` не рендерится. Никаких ошибок.
- **Длинная пауза между словами (>3с):** Фраза завершается. Субтитры исчезают до появления следующей фразы. Экран без субтитров на время паузы.
- **Слово с `endMs < startMs`:** Игнорируется. Warning в консоль: `"invalid word timing at index <N>"`.
- **Субтитры перекрываются с Overlay (progress bar, QR):** `position: "top"` решает конфликт. По умолчанию bottom -- автор должен проверить в Studio.
- **Очень длинное слово (>30 символов):** Рендерится as-is, может выйти за пределы pill. CSS `overflow: hidden` с `text-overflow: ellipsis`.
- **Несколько слов с одинаковым `startMs`:** Все попадают в одну фразу. Все считаются "текущими" одновременно.

---

<!-- feature:ai-commentary -->

### 7. ai-commentary -- AI-комментарии к контенту

**Одной строкой:** Ироничные пометки AI к содержимому видео: коррекции, пояснения, шутки. Появляются как popup-карточки вверху экрана на 3-5 секунд, не перекрывая основной контент.

#### Проблема

Видео из подкаста -- это прямая визуализация речи автора. Но автор может ошибаться, упрощать, или пропускать контекст. AI-комментарии добавляют второй голос: исправления, пояснения, ироничные замечания. Это повышает engagement и образовательную ценность видео.

Затрагивает: зрителя (получает дополнительный контекст и fact-checking), автора (видео становится интереснее без дополнительной работы).

#### Acceptance Criteria

**Тип данных:**

- AC-7.1: `VideoSpec` получает опциональное поле `commentary: CommentaryEntry[]`:
  ```typescript
  interface CommentaryEntry {
    startSec: number
    durationSec?: number  // default: 4
    text: string          // max 140 chars (Zod enforced)
    type: "correction" | "note" | "joke"
  }
  ```
- AC-7.2: Zod-схема для `CommentaryEntry`: `text` -- `z.string().max(140)`, `type` -- `z.enum(["correction", "note", "joke"])`, `startSec` -- `z.number().min(0)`, `durationSec` -- `z.number().min(1).max(10).default(4)`.
- AC-7.3: Пустой массив `commentary: []` или отсутствие поля `commentary` -- валидно, комментарии не рендерятся.

**Компонент:**

- AC-7.4: `CommentaryOverlay` -- React-компонент, рендерящийся поверх всех сцен и субтитров. Позиционируется вверху по центру канваса (top: 40px).
- AC-7.5: Каждый комментарий рендерится как pill/card: скруглённый прямоугольник, полупрозрачный фон, текст + иконка типа.
- AC-7.6: Accent-цвета по типу: `"correction"` -- красноватый (`rgba(239, 68, 68, 0.85)`), `"note"` -- синеватый (`rgba(59, 130, 246, 0.85)`), `"joke"` -- жёлтый (`rgba(234, 179, 8, 0.85)`). Цвет текста: white.
- AC-7.7: Иконки по типу: `"correction"` -- `⚠`, `"note"` -- `ℹ`, `"joke"` -- `😏`. Иконка слева от текста.
- AC-7.8: Анимация входа: spring slide сверху (translateY от -60px до 0, `damping: 200`). Анимация выхода: fade-out за последние 12 кадров `durationSec`.
- AC-7.9: Комментарий виден в интервале `[startSec, startSec + durationSec]`. За пределами -- не рендерится.

**Логика перекрытий:**

- AC-7.10: Если два комментария перекрываются по времени (`entry2.startSec < entry1.startSec + entry1.durationSec`), второй ждёт пока первый уйдёт. Effective `startSec` второго = `entry1.startSec + entry1.durationSec + 0.5` (0.5с пауза).
- AC-7.11: Очередь обрабатывается при загрузке spec, а не в рантайме. `resolveCommentaryTimings(entries)` возвращает массив с adjusted `startSec`. Оригинальные `startSec` в spec не модифицируются.

**Генерация комментариев:**

- AC-7.12: AI генерирует комментарии в фазе создания сценария (feature `scenario-workflow`, AC-4.4). Комментарии основаны на анализе содержания транскрипции.
- AC-7.13: Рекомендуемая плотность: 1 комментарий на 2-3 минуты видео. Не более 1 комментария в 30 секунд (после resolve перекрытий).

#### Non-goals

- Интерактивные комментарии (зритель не может кликнуть или развернуть).
- Комментарии от зрителей или crowd-sourced.
- Text-to-speech озвучка комментариев.
- Комментарии длиннее 140 символов (multi-card или expandable).

#### Edge cases

- **Комментарий с `startSec: 0`:** Появляется с первого кадра. Spring-анимация входа начинается с кадра 0.
- **Комментарий после последней сцены (`startSec > max(scene.endSec)`):** Не рендерится. Zod-валидация выдаёт warning.
- **Текст ровно 140 символов:** Валидно. Рендерится as-is. Может потребовать уменьшения font-size -- компонент автоматически уменьшает до `fontSize * 0.85` если текст не помещается в max-width (800px).
- **Все комментарии перекрываются (chain):** `resolveCommentaryTimings` сдвигает каждый следующий. Если сдвинутый комментарий выходит за пределы видео, он отбрасывается. Warning в консоль: `"commentary entry at <startSec>s dropped: extends beyond video duration"`.
- **`durationSec: 1` (минимум):** Комментарий появляется и исчезает за 1 секунду. Spring-анимация входа занимает ~0.5с, fade-out ~0.4с. Текст виден ~0.1с. Работает, но не рекомендуется.
- **Пустой `text`:** Zod-схема отклоняет -- `z.string().min(1).max(140)`.
