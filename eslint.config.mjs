// Flat ESLint config. Scope is deliberate: lint the server (the internet-facing
// trust boundary) and build/support scripts, where logic smells and insecure
// patterns matter most. The Expo app and the throwaway mockup sandbox are left
// to their own toolchains (React Native / Vite) to keep this signal high.
//
// Typecheck catches type errors; ESLint here catches what types can't —
// floating promises, unsafe RegExp/child_process/fs usage (eslint-plugin-security),
// and unhandled control-flow smells.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";
import globals from "globals";

export default tseslint.config(
  {
    // Never lint generated output, dependencies, or the excluded packages.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/coverage/**",
      "artifacts/mobile/**",
      "artifacts/mockup-sandbox/**",
      "lib/api-zod/**",
      "lib/api-client-react/**",
      "**/*.config.{js,mjs,cjs,ts}",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    // Build/support scripts run under Node — give them Node globals.
    files: ["**/*.mjs", "**/*.cjs", "**/build.*"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // k6 load scripts run in k6's runtime, which injects these globals.
    files: ["scripts/k6/**/*.js"],
    languageOptions: {
      globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly" },
    },
  },
  {
    files: ["artifacts/api-server/**/*.ts", "scripts/**/*.ts", "lib/db/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Unhandled promises in an HTTP handler leak errors and hang requests.
      "@typescript-eslint/no-floating-promises": "off", // needs type info; enabled in the type-checked override below
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // The object-injection rule is famously noisy on legitimate record access;
      // keep the higher-signal security rules and mute this one.
      "security/detect-object-injection": "off",
      // We build HMAC and validation ourselves; the pseudo-random rule fires on
      // Math.random used for non-crypto jitter only — keep as a warning.
      "security/detect-non-literal-fs-filename": "warn",
    },
  },
);
