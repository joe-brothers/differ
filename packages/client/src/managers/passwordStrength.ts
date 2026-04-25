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

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  warning: string;
  suggestion: string;
  passes: boolean;
}

const LABELS: Record<number, string> = {
  0: "Too weak",
  1: "Too weak",
  2: "OK",
  3: "Good",
  4: "Strong",
};

export function evaluatePassword(password: string, userInputs: string[] = []): StrengthResult {
  ensureConfigured();
  if (!password) {
    return { score: 0, label: "", warning: "", suggestion: "", passes: false };
  }
  const r = zxcvbn(password, userInputs);
  const score = r.score as 0 | 1 | 2 | 3 | 4;
  return {
    score,
    label: LABELS[score],
    warning: r.feedback.warning ?? "",
    suggestion: r.feedback.suggestions[0] ?? "",
    passes: score >= 2,
  };
}
