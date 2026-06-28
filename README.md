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

Open the project folder in VS Code and press F5 with the `Run TestTrace Extension` launch configuration. This starts an Extension Development Host with the latest compiled bundle.

## Package as VSIX

Build a local VSIX package with:

```bash
npm run package:vsix
```

The package script currently allows a missing repository URL and skips the license-file check so local packaging stays non-interactive while the project is still private.
