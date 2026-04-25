import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommon from "@zxcvbn-ts/language-common";
import * as zxcvbnEn from "@zxcvbn-ts/language-en";

// Score 0-4 from zxcvbn. We require >= 2 ("somewhat guessable"). Score 0/1
// includes top-1k passwords, simple variations, and short alphanumeric runs
// that pass our regex but fall to credential-stuffing in seconds.
const MIN_SCORE = 2;

// User inputs (e.g. username, the literal "differ") are added to zxcvbn's
// dictionary so passwords like `differ123` get penalized properly.
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

export interface PasswordPolicyResult {
  ok: boolean;
  score: number; // 0..4
  reason?: string;
}

export function checkPasswordStrength(
  password: string,
  userInputs: string[] = [],
): PasswordPolicyResult {
  ensureConfigured();
  const result = zxcvbn(password, userInputs);
  if (result.score < MIN_SCORE) {
    const warning = result.feedback.warning;
    const suggestion = result.feedback.suggestions[0];
    const reason = warning || suggestion || "Password is too easy to guess";
    return { ok: false, score: result.score, reason };
  }
  return { ok: true, score: result.score };
}
