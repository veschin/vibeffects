PROJECT ?= default

install:
	npm install

studio:
	npx remotion studio src/index.ts --props projects/$(PROJECT)/spec.json

render:
	npx remotion render src/index.ts Main --props projects/$(PROJECT)/spec.json --output projects/$(PROJECT)/out/$(PROJECT).mp4

render-hw:
	npx remotion render src/index.ts Main --props projects/$(PROJECT)/spec.json --output projects/$(PROJECT)/out/$(PROJECT).mp4 --codec h264 --video-codec h264_nvenc

capture:
	node scripts/capture-web.mjs $(PROJECT)

pipeline:
	npx tsx scripts/pipeline.ts status $(if $(PROJECT),$(PROJECT),)

pipeline-next:
	npx tsx scripts/pipeline.ts next $(PROJECT)

transcribe:
	npx tsx scripts/transcribe.ts "projects/$(PROJECT)/audio/$$(ls projects/$(PROJECT)/audio/ | head -1)" projects/$(PROJECT)/transcription.json

validate:
	npx tsx scripts/validate-spec.ts $(PROJECT)

init:
	npx tsx scripts/init-project.ts $(PROJECT)

.PHONY: install studio render render-hw capture pipeline pipeline-next transcribe validate init
