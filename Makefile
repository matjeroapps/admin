.PHONY: test go-test openapi openapi-check frontend-install frontend-lint frontend-typecheck frontend-test docker-build

test: go-test openapi-check frontend-lint frontend-typecheck frontend-test

go-test:
	go test ./...

openapi:
	go run ./cmd/openapi-gen

openapi-check: openapi
	git diff --exit-code -- docs/api

frontend-install:
	npm install

frontend-lint:
	npm run lint

frontend-typecheck:
	npm run typecheck

frontend-test:
	npm run test

docker-build:
	docker build -f docker/go-app.Dockerfile --build-arg APP_PATH=./apps/admin-api -t matjero-admin-api:local .
	docker build -f docker/web-app.Dockerfile --build-arg WORKSPACE=@commerce/admin-web -t matjero-admin-web:local .
