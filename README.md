# TestTrace

TestTrace is a VS Code extension that parses gtest and CUnit test code, lets developers confirm detected cases, and generates AI test trace labels in the format:

AI_UT_<TEAM>_<COMPONENT>_<CASE_HASH16B>_<CONTENT_HASH16B>

## Current scope

- gtest: TEST, TEST_F, TEST_P, TYPED_TEST, TYPED_TEST_P
- CUnit: CU_add_suite and CU_add_test registration flow
- Right-click commands for current file and current selection
- Review panel for case confirmation and label generation

## Development

Install dependencies:

```bash
npm install
```

Build once:

```bash
npm run compile
```

Watch mode:

```bash
npm run watch
```

Run tests:

```bash
npm test
```

## Debug in VS Code

The extension now expects a standalone backend service.

Build and start the backend service:

```bash
npm run server:build
npm run server:start
```

Then start the extension host with `Run TestTrace Extension`, or use the compound configuration `Run TestTrace Service + Extension` to start both together.

The plugin calls the backend at `testTrace.serviceBaseUrl`, which defaults to `http://127.0.0.1:43125`.

## Package as VSIX

Build a local VSIX package with:

```bash
npm run package:vsix
```

The package script currently allows a missing repository URL and skips the license-file check so local packaging stays non-interactive while the project is still private.
