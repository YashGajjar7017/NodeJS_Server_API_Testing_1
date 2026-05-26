# TODO - File server (GET/POST file transfer)

- [x] Create implementation in `server.js` (Node + Express)
- [x] GET `/file?name=<filename>`: stream file from server storage directory
- [x] POST `/file?name=<filename>`: receive raw request body as chunks and write to disk (stream)
- [x] Ensure no authentication is required

- [ ] Handle content-length, timeouts, and basic validation (filename/path traversal)
- [ ] Add minimal error handling and proper HTTP status codes
- [ ] Update/verify `Dockerfile`/`docker-compose.yml` compatibility with storage directory
- [ ] Run `npm test` or basic start smoke-test

