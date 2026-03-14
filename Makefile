pipeline:
	npx tsx scripts/pipeline.ts status $(if $(PROJECT),$(PROJECT),)

pipeline-next:
	npx tsx scripts/pipeline.ts next $(PROJECT)

.PHONY: pipeline pipeline-next
