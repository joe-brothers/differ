import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommon from "@zxcvbn-ts/language-common";
import * as zxcvbnEn from "@zxcvbn-ts/language-en";

const APP_DICTIONARY = ["differ", "differgame", "spotthedifference"];

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  zxcvbnOptions.setOptions({
    dictionary: {
      ...zxcvbnCommon.dictionary,
      ...zxcvbnEn.dictionary,
      app: APP_DICTIONARY,
    },
    graphs: zxcvbnCommon.adjacencyGraphs,
    translations: zxcvbnEn.translations,
  });
  configured = true;
}

// User-facing copy of the password rules. The submit-button gate enforces
// the first two items (length + character classes) — zxcvbn output below
// is purely visual feedback to nudge users toward stronger choices.
export const PASSWORD_HINT = {
  title: "Password requirements",
  items: ["At least 8 characters", "At least one letter and one number"],
} as const;

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  warning: string;
  suggestion: string;
}

const LABELS: Record<number, string> = {
  0: "Too weak",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

// Visual-only helper: the strength meter renders the score and a hint
// from zxcvbn, but no submit gate consults this. Validation is the
// length + character-class regex from `PasswordSchema`.
export function evaluatePassword(password: string, userInputs: string[] = []): StrengthResult {
  ensureConfigured();
  if (!password) {
    return { score: 0, label: "", warning: "", suggestion: "" };
  }
  const r = zxcvbn(password, userInputs);
  const score = r.score as 0 | 1 | 2 | 3 | 4;
  return {
    score,
    label: LABELS[score] ?? "",
    warning: r.feedback.warning ?? "",
    suggestion: r.feedback.suggestions[0] ?? "",
  };
}
