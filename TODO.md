# TODO
- [ ] Update POST /file so that the request body can specify overwrite/append via a flag/mode and write corresponding data.
- [ ] Ensure overwrite vs append is determined from the request body (JSON field like `{ "mode": "append" }`) while still supporting existing query param `mode` for backward compatibility.
- [ ] For JSON body uploads, use `{ "mode": "append|overwrite", "data": "..." }` where `data` becomes the file bytes.

- [ ] Verify dedicated append route `POST /file/append` matches the same behavior.
- [ ] Run a quick manual test (curl) to confirm overwrite replaces and append adds.

