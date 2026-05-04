import { authState } from "../../managers/AuthStateManager";
import { evaluatePassword, PASSWORD_HINT } from "../../managers/passwordStrength";
import { ApiError } from "../../network/rest";
import { HtmlOverlay } from "../HtmlOverlay";

const USERNAME_RULE_TEXT = "Letters, digits, and _ . - · 3-32 characters";

export interface UpgradeAccountModalOpts {
  onSuccess: () => void | Promise<void>;
}

export class UpgradeAccountModal {
  private overlay: HtmlOverlay | null = null;

  open(opts: UpgradeAccountModalOpts): void {
    this.overlay?.destroy();
    const overlay = new HtmlOverlay();
    this.overlay = overlay;
    const card = overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Save Account";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent = "Pick a username and password to keep your guest progress.";
    Object.assign(blurb.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(blurb);

    const usernameInput = overlay.createInput(card, {
      type: "text",
      placeholder: "Username",
      name: "username",
      autocomplete: "username",
    });
    const usernameHelper = overlay.createHelperText(card);
    usernameHelper.textContent = USERNAME_RULE_TEXT;
    const passwordInput = overlay.createInputWithHint(
      card,
      {
        type: "password",
        placeholder: "Password",
        name: "password",
        autocomplete: "new-password",
      },
      { title: PASSWORD_HINT.title, items: [...PASSWORD_HINT.items] },
    );
    overlay.addPasswordToggle(passwordInput);
    const meter = overlay.createStrengthMeter(card);

    const errorText = overlay.createErrorText(card);
    const submitBtn = overlay.createButton(card, "Save");
    const cancelBtn = overlay.createSecondaryButton(card, "Cancel");

    const refreshStrength = () => {
      const r = evaluatePassword(passwordInput.value, [usernameInput.value.trim()]);
      const detail = r.warning || r.suggestion;
      meter.update(
        r.score,
        passwordInput.value ? (detail ? `${r.label} — ${detail}` : r.label) : "",
      );
    };

    // Mirror the server-side rules so the Save button only lights up once
    // the form would actually be accepted (matches AuthScene signup).
    // zxcvbn output is shown via the meter as a nudge, not as a gate.
    const usernameError = (value: string): string | null => {
      if (value.length === 0) return null;
      if (value.length < 3) return "Username must be at least 3 characters.";
      if (value.length > 32) return "Username must be 32 characters or fewer.";
      if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
        return "Allowed: letters, digits, and _ . -";
      }
      return null;
    };
    const isFormValid = (): boolean => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (username.length < 3 || username.length > 32) return false;
      if (!/^[A-Za-z0-9_.-]+$/.test(username)) return false;
      if (password.length < 8 || password.length > 128) return false;
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return false;
      return true;
    };
    const refreshSubmit = () => overlay.setButtonEnabled(submitBtn, isFormValid());
    const refreshUsernameHelper = () => {
      const err = usernameError(usernameInput.value.trim());
      if (err) {
        usernameHelper.textContent = err;
        usernameHelper.style.color = "var(--error)";
      } else {
        usernameHelper.textContent = USERNAME_RULE_TEXT;
        usernameHelper.style.color = "var(--text-secondary)";
      }
    };
    overlay.setButtonEnabled(submitBtn, false);

    // Mirror the server's lowercase normalization in the field itself so the
    // user always sees the form they're actually submitting. Registered first
    // so subsequent input listeners read the already-lowercased value.
    usernameInput.addEventListener("input", () => {
      const v = usernameInput.value;
      const lower = v.toLowerCase();
      if (v === lower) return;
      const start = usernameInput.selectionStart;
      const end = usernameInput.selectionEnd;
      usernameInput.value = lower;
      if (start !== null && end !== null) usernameInput.setSelectionRange(start, end);
    });

    passwordInput.addEventListener("input", () => {
      refreshStrength();
      refreshSubmit();
    });
    usernameInput.addEventListener("input", () => {
      refreshStrength();
      refreshUsernameHelper();
      refreshSubmit();
    });

    cancelBtn.addEventListener("click", () => this.close());

    const submit = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorText.textContent = "Username and password are required.";
        return;
      }
      overlay.setButtonEnabled(submitBtn, false);
      const stopDots = overlay.animateButtonDots(submitBtn, "Saving");
      errorText.textContent = "";
      try {
        await authState.upgrade(username, password);
        stopDots();
        this.close();
        await opts.onSuccess();
      } catch (err) {
        stopDots();
        if (err instanceof ApiError) {
          if (err.code === "username_taken") {
            errorText.textContent = "Username is already taken.";
          } else {
            errorText.textContent = err.message || "Something went wrong.";
          }
        } else {
          errorText.textContent = "Network error. Try again.";
        }
        submitBtn.textContent = "Save";
        refreshSubmit();
      }
    };
    submitBtn.addEventListener("click", submit);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") submit();
    };
    usernameInput.addEventListener("keydown", onKeyDown);
    passwordInput.addEventListener("keydown", onKeyDown);
    usernameInput.focus();
  }

  close(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }
}
