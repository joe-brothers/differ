import { Application, Assets, Container, Sprite, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS } from "../constants";
import { HtmlOverlay } from "../ui/HtmlOverlay";
import { createBetaBadge } from "../ui/pixiBetaBadge";
import { createGithubFooter } from "../ui/pixiGithubFooter";
import { authState } from "../managers/AuthStateManager";
import { ApiError, authApi } from "../network/rest";
import { game } from "../core/Game";
import { evaluatePassword, PASSWORD_HINT } from "../managers/passwordStrength";

type AuthView = "chooser" | "signin" | "signup" | "totp" | "forgot" | "reset" | "verify";

// Pending email-action handed in by Game.start when the SPA loads with
// `?action=reset-password&token=...` or `?action=verify-email&token=...`.
// AuthScene routes straight to the matching view instead of the chooser.
export interface AuthSceneInitial {
  view: AuthView;
  token?: string;
}

export class AuthScene extends Container implements IScene {
  private app: Application;
  private overlay: HtmlOverlay | null = null;
  private title: Text | null = null;
  private logo: Sprite | null = null;
  private betaBadge: Container | null = null;
  private footerText: Text | null = null;
  private view: AuthView = "chooser";
  private totpTicket: string | null = null;
  private resetToken: string | null = null;
  private verifyToken: string | null = null;

  constructor(app: Application, initial?: AuthSceneInitial) {
    super();
    this.app = app;
    if (initial?.view) this.view = initial.view;
    if (initial?.view === "reset" && initial.token) this.resetToken = initial.token;
    if (initial?.view === "verify" && initial.token) this.verifyToken = initial.token;
  }

  async init(): Promise<void> {
    this.createTitle();
    this.createFooter();
    this.render();
  }

  private createFooter(): void {
    this.footerText = createGithubFooter();
    this.positionFooter();
    this.addChild(this.footerText);
  }

  private positionFooter(): void {
    if (!this.footerText) return;
    this.footerText.position.set(this.app.screen.width / 2, this.app.screen.height - 16);
  }

  private createTitle(): void {
    this.title = new Text({
      text: "Differ: Spot the Difference",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 36,
        fontWeight: "500",
        fill: COLORS.text,
      },
    });
    this.title.anchor.set(0.5);
    this.addChild(this.title);

    this.betaBadge = createBetaBadge();
    this.addChild(this.betaBadge);

    this.positionTitle();
    void this.loadLogo();
  }

  private async loadLogo(): Promise<void> {
    const texture = await Assets.load("/assets/differ.webp");
    if (this.destroyed) return;
    this.logo = new Sprite(texture);
    this.logo.anchor.set(0.5);
    this.logo.scale.set(96 / this.logo.height);
    this.addChild(this.logo);
    this.positionTitle();
  }

  private positionTitle(): void {
    if (!this.title) return;
    this.title.position.set(this.app.screen.width / 2, this.app.screen.height * 0.15);
    if (this.betaBadge) {
      this.betaBadge.position.set(this.title.x + this.title.width / 2 + 8, this.title.y);
    }
    if (this.logo) {
      this.logo.position.set(
        this.title.x - this.title.width / 2 - 16 - this.logo.width / 2,
        this.title.y,
      );
    }
  }

  private resetOverlay(): HTMLDivElement | null {
    this.overlay?.destroy();
    this.overlay = new HtmlOverlay();
    return this.overlay.createFormContainer();
  }

  private render(): void {
    if (this.view === "chooser") this.renderChooser();
    else if (this.view === "totp") this.renderTotpForm();
    else if (this.view === "forgot") this.renderForgotForm();
    else if (this.view === "reset") this.renderResetForm();
    else if (this.view === "verify") this.renderVerifyForm();
    else this.renderCredentialsForm();
  }

  private renderChooser(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;

    const heading = document.createElement("h2");
    heading.textContent = "Welcome";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 12px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const signInBtn = this.overlay.createButton(card, "Sign In");
    const signUpBtn = this.overlay.createButton(card, "Create Account");
    const guestBtn = this.overlay.createSecondaryButton(card, "Continue as Guest");

    const errText = this.overlay.createErrorText(card);

    signInBtn.addEventListener("click", () => {
      this.view = "signin";
      this.render();
    });
    signUpBtn.addEventListener("click", () => {
      this.view = "signup";
      this.render();
    });
    guestBtn.addEventListener("click", async () => {
      errText.textContent = "";
      guestBtn.disabled = true;
      const stopDots = this.overlay!.animateButtonDots(guestBtn, "Loading");
      try {
        await authState.createGuest();
        stopDots();
        game.showMainMenu();
      } catch {
        stopDots();
        errText.textContent = "Could not create guest account. Try again.";
        guestBtn.disabled = false;
        guestBtn.textContent = "Continue as Guest";
      }
    });
  }

  private renderCredentialsForm(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;

    const isSignUp = this.view === "signup";

    const heading = document.createElement("h2");
    heading.textContent = isSignUp ? "Create Account" : "Sign In";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const usernameInput = this.overlay.createInput(card, {
      type: "text",
      placeholder: "Username",
      name: "username",
      autocomplete: "username",
    });
    const USERNAME_RULE_TEXT = "Letters, digits, and _ . - · 3-32 characters";
    const usernameHelper = isSignUp ? this.overlay.createHelperText(card) : null;
    if (usernameHelper) usernameHelper.textContent = USERNAME_RULE_TEXT;
    const passwordInput = isSignUp
      ? this.overlay.createInputWithHint(
          card,
          {
            type: "password",
            placeholder: "Password",
            name: "password",
            autocomplete: "new-password",
          },
          { title: PASSWORD_HINT.title, items: [...PASSWORD_HINT.items] },
        )
      : this.overlay.createInput(card, {
          type: "password",
          placeholder: "Password",
          name: "password",
          autocomplete: "current-password",
        });
    this.overlay.addPasswordToggle(passwordInput);

    let strengthMeter: ReturnType<HtmlOverlay["createStrengthMeter"]> | null = null;
    if (isSignUp) {
      strengthMeter = this.overlay.createStrengthMeter(card);
    }

    const errorText = this.overlay.createErrorText(card);
    const submitBtn = this.overlay.createButton(card, isSignUp ? "Create" : "Sign In");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");

    if (!isSignUp) {
      const forgot = document.createElement("a");
      forgot.textContent = "Forgot password?";
      forgot.href = "#";
      Object.assign(forgot.style, {
        color: "var(--primary)",
        fontFamily: "inherit",
        fontSize: "12px",
        textAlign: "center",
        textDecoration: "none",
        margin: "4px 0 0 0",
        cursor: "pointer",
      });
      forgot.addEventListener("click", (e) => {
        e.preventDefault();
        this.view = "forgot";
        this.render();
      });
      card.appendChild(forgot);
    }

    backBtn.addEventListener("click", () => {
      this.view = "chooser";
      this.render();
    });

    const recomputeStrength = () => {
      if (!strengthMeter) return;
      const pwd = passwordInput.value;
      const username = usernameInput.value.trim();
      if (!pwd) {
        strengthMeter.update(0, "");
        return;
      }
      const r = evaluatePassword(pwd, username ? [username] : []);
      const detail = r.warning || r.suggestion;
      strengthMeter.update(r.score, detail ? `${r.label} — ${detail}` : r.label);
    };

    // Server-side rules mirrored here so the submit button only becomes
    // clickable once the form would actually be accepted. zxcvbn output
    // (the strength meter) is informational, not part of the gate.
    const usernameError = (value: string): string | null => {
      if (value.length === 0) return null;
      if (value.length < 3) return "Username must be at least 3 characters.";
      if (value.length > 32) return "Username must be 32 characters or fewer.";
      if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
        return "Allowed: letters, digits, and _ . -";
      }
      return null;
    };
    const isSignupValid = (): boolean => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (username.length < 3 || username.length > 32) return false;
      if (!/^[A-Za-z0-9_.-]+$/.test(username)) return false;
      if (password.length < 8 || password.length > 128) return false;
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return false;
      return true;
    };

    const overlay = this.overlay;
    const refreshSubmit = () => {
      if (!isSignUp) return;
      overlay.setButtonEnabled(submitBtn, isSignupValid());
    };
    const refreshUsernameHelper = () => {
      if (!usernameHelper) return;
      const err = usernameError(usernameInput.value.trim());
      if (err) {
        usernameHelper.textContent = err;
        usernameHelper.style.color = "var(--error)";
      } else {
        usernameHelper.textContent = USERNAME_RULE_TEXT;
        usernameHelper.style.color = "var(--text-secondary)";
      }
    };

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

    if (isSignUp) {
      overlay.setButtonEnabled(submitBtn, false);
      passwordInput.addEventListener("input", () => {
        recomputeStrength();
        refreshSubmit();
      });
      usernameInput.addEventListener("input", () => {
        recomputeStrength();
        refreshUsernameHelper();
        refreshSubmit();
      });
    }

    const submit = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorText.textContent = "Username and password are required.";
        return;
      }
      overlay.setButtonEnabled(submitBtn, false);
      const stopDots = overlay.animateButtonDots(submitBtn, "Loading");
      errorText.textContent = "";
      try {
        if (isSignUp) {
          // Signup = create a guest account, then upgrade it with credentials.
          if (!authState.isAuthenticated()) {
            await authState.createGuest();
          }
          await authState.upgrade(username, password);
          stopDots();
          game.showMainMenu();
        } else {
          const result = await authState.login(username, password);
          if (result.kind === "totp") {
            stopDots();
            this.totpTicket = result.ticket;
            this.view = "totp";
            this.render();
            return;
          }
          stopDots();
          game.showMainMenu();
        }
      } catch (err) {
        stopDots();
        if (err instanceof ApiError) {
          if (err.code === "username_taken") {
            errorText.textContent = "Username is already taken.";
          } else if (err.code === "invalid_credentials") {
            errorText.textContent = "Invalid username or password.";
          } else {
            errorText.textContent = err.message || "Something went wrong.";
          }
        } else {
          errorText.textContent = "Network error. Please try again.";
        }
        submitBtn.textContent = isSignUp ? "Create" : "Sign In";
        // Restore enable-state from the validity rule (signup) or just
        // re-enable (sign-in always allowed to retry).
        if (isSignUp) refreshSubmit();
        else submitBtn.disabled = false;
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

  private renderTotpForm(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;

    const heading = document.createElement("h2");
    heading.textContent = "Two-Factor Code";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent = "Enter the 6-digit code from your authenticator app.";
    Object.assign(blurb.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(blurb);

    const codeInput = this.overlay.createInput(card, {
      type: "text",
      placeholder: "123456",
      name: "totp",
    });
    codeInput.inputMode = "numeric";
    codeInput.autocomplete = "one-time-code";
    codeInput.maxLength = 6;

    const errorText = this.overlay.createErrorText(card);
    const submitBtn = this.overlay.createButton(card, "Verify");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");

    backBtn.addEventListener("click", () => {
      this.totpTicket = null;
      this.view = "signin";
      this.render();
    });

    const submit = async () => {
      const code = codeInput.value.trim();
      if (!/^\d{6}$/.test(code)) {
        errorText.textContent = "Code must be 6 digits.";
        return;
      }
      if (!this.totpTicket) {
        errorText.textContent = "Session expired. Sign in again.";
        return;
      }
      submitBtn.disabled = true;
      const stopDots = this.overlay!.animateButtonDots(submitBtn, "Verifying");
      errorText.textContent = "";
      try {
        await authState.completeTotpLogin(this.totpTicket, code);
        stopDots();
        this.totpTicket = null;
        game.showMainMenu();
      } catch (err) {
        stopDots();
        if (err instanceof ApiError) {
          if (err.code === "invalid_totp") {
            errorText.textContent = "Invalid code. Try again.";
          } else if (err.code === "ticket_invalid") {
            errorText.textContent = "Login session expired. Sign in again.";
            this.totpTicket = null;
          } else {
            errorText.textContent = err.message || "Something went wrong.";
          }
        } else {
          errorText.textContent = "Network error. Try again.";
        }
        submitBtn.disabled = false;
        submitBtn.textContent = "Verify";
      }
    };
    submitBtn.addEventListener("click", submit);
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    codeInput.focus();
  }

  private renderForgotForm(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;

    const heading = document.createElement("h2");
    heading.textContent = "Reset Password";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent =
      "Enter the email on your account. If it matches a verified address, we'll send a reset link.";
    Object.assign(blurb.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(blurb);

    const emailInput = this.overlay.createInput(card, {
      type: "email",
      placeholder: "you@example.com",
      name: "email",
      autocomplete: "email",
    });

    const status = this.overlay.createErrorText(card);
    const submitBtn = this.overlay.createButton(card, "Send Reset Link");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");

    backBtn.addEventListener("click", () => {
      this.view = "signin";
      this.render();
    });

    const submit = async () => {
      const value = emailInput.value.trim();
      // Same regex used elsewhere in the client. Server also re-validates;
      // the gate here just stops obvious typos from burning a request.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        status.style.color = "var(--error)";
        status.textContent = "Enter a valid email.";
        return;
      }
      submitBtn.disabled = true;
      const stopDots = this.overlay!.animateButtonDots(submitBtn, "Sending");
      try {
        await authApi.forgotPassword(value);
        status.style.color = "var(--success)";
        status.textContent = "If a verified account matches, you'll receive an email shortly.";
      } catch {
        // The endpoint is intentionally enumeration-resistant and returns 200
        // for misses; any failure here is a transport hiccup, so we surface
        // the same message rather than leaking detail.
        status.style.color = "var(--success)";
        status.textContent = "If a verified account matches, you'll receive an email shortly.";
      } finally {
        stopDots();
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
      }
    };
    submitBtn.addEventListener("click", submit);
    emailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    emailInput.focus();
  }

  // Rendered when the SPA loads with `?action=reset-password&token=...`.
  // Token came in over email; we don't validate it client-side because the
  // server's reset endpoint is the authority. Submit posts the new password
  // alongside the token and bounces back to sign-in on success.
  private renderResetForm(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;
    const overlay = this.overlay;

    const heading = document.createElement("h2");
    heading.textContent = "Set New Password";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    if (!this.resetToken) {
      const blurb = document.createElement("p");
      blurb.textContent = "Reset link is missing or invalid. Request a new one.";
      Object.assign(blurb.style, {
        color: "var(--error)",
        fontSize: "13px",
        textAlign: "center",
        margin: "0 0 12px 0",
      });
      card.appendChild(blurb);
      const back = overlay.createSecondaryButton(card, "Back to Sign In");
      back.addEventListener("click", () => {
        clearActionFromUrl();
        this.view = "signin";
        this.render();
      });
      return;
    }

    const blurb = document.createElement("p");
    blurb.textContent = "Enter a new password for your account.";
    Object.assign(blurb.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(blurb);

    const passwordInput = overlay.createInputWithHint(
      card,
      {
        type: "password",
        placeholder: "New password",
        name: "password",
        autocomplete: "new-password",
      },
      { title: PASSWORD_HINT.title, items: [...PASSWORD_HINT.items] },
    );
    overlay.addPasswordToggle(passwordInput);
    const strengthMeter = overlay.createStrengthMeter(card);

    const confirmInput = overlay.createInput(card, {
      type: "password",
      placeholder: "Confirm new password",
      name: "confirm",
      autocomplete: "new-password",
    });
    overlay.addPasswordToggle(confirmInput);

    const errorText = overlay.createErrorText(card);
    const submitBtn = overlay.createButton(card, "Reset Password");
    const cancelBtn = overlay.createSecondaryButton(card, "Cancel");

    cancelBtn.addEventListener("click", () => {
      this.resetToken = null;
      clearActionFromUrl();
      this.view = "signin";
      this.render();
    });

    const isValid = (): boolean => {
      const p = passwordInput.value;
      if (p.length < 8 || p.length > 128) return false;
      if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return false;
      return p === confirmInput.value;
    };
    overlay.setButtonEnabled(submitBtn, false);
    const refresh = () => {
      const r = evaluatePassword(passwordInput.value);
      const detail = r.warning || r.suggestion;
      strengthMeter.update(r.score, detail ? `${r.label} — ${detail}` : r.label);
      overlay.setButtonEnabled(submitBtn, isValid());
    };
    passwordInput.addEventListener("input", refresh);
    confirmInput.addEventListener("input", refresh);

    const submit = async () => {
      if (!isValid()) {
        errorText.textContent = "Passwords don't match or are too weak.";
        return;
      }
      const token = this.resetToken;
      if (!token) return;
      overlay.setButtonEnabled(submitBtn, false);
      const stopDots = overlay.animateButtonDots(submitBtn, "Saving");
      errorText.textContent = "";
      try {
        await authApi.resetPassword(token, passwordInput.value);
        stopDots();
        this.resetToken = null;
        clearActionFromUrl();
        // Force-clear any stale session so the user signs in with the new
        // password. The cookie may still be valid for the same account, but
        // we want the post-reset experience to be deterministic.
        try {
          await authState.logout();
        } catch {
          /* ignore */
        }
        errorText.style.color = "var(--success)";
        errorText.textContent = "Password updated. Redirecting to sign in…";
        window.setTimeout(() => {
          this.view = "signin";
          this.render();
        }, 800);
      } catch (err) {
        stopDots();
        if (err instanceof ApiError && err.code === "invalid_token") {
          errorText.textContent = "Reset link expired or already used. Request a new one.";
        } else if (err instanceof ApiError && err.code === "rate_limited") {
          errorText.textContent = "Too many attempts. Try again in a minute.";
        } else if (err instanceof ApiError) {
          errorText.textContent = err.message || "Could not reset password.";
        } else {
          errorText.textContent = "Network error. Try again.";
        }
        overlay.setButtonEnabled(submitBtn, true);
        submitBtn.textContent = "Reset Password";
      }
    };
    submitBtn.addEventListener("click", submit);
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    confirmInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    passwordInput.focus();
  }

  // Rendered when the SPA loads with `?action=verify-email&token=...`.
  // Hits the verify endpoint immediately on mount so the user just sees the
  // outcome — no extra click required.
  private renderVerifyForm(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;
    const overlay = this.overlay;

    const heading = document.createElement("h2");
    heading.textContent = "Verify Email";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const status = document.createElement("p");
    Object.assign(status.style, {
      color: "var(--text-secondary)",
      fontSize: "14px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    status.textContent = "Verifying…";
    card.appendChild(status);

    const continueBtn = overlay.createButton(card, "Continue");
    continueBtn.style.display = "none";

    const finish = () => {
      this.verifyToken = null;
      clearActionFromUrl();
      if (authState.isAuthenticated()) {
        game.showMainMenu();
      } else {
        this.view = "signin";
        this.render();
      }
    };
    continueBtn.addEventListener("click", finish);

    const token = this.verifyToken;
    if (!token) {
      status.style.color = "var(--error)";
      status.textContent = "Verification link is missing.";
      continueBtn.style.display = "";
      return;
    }
    void (async () => {
      try {
        await authApi.verifyEmail(token);
        status.style.color = "var(--success)";
        status.textContent = "Email verified. You're all set.";
      } catch (err) {
        status.style.color = "var(--error)";
        if (err instanceof ApiError && err.code === "invalid_token") {
          status.textContent = "Link expired or already used. Request a fresh one.";
        } else {
          status.textContent = "Could not verify. Try again later.";
        }
      } finally {
        continueBtn.style.display = "";
      }
    })();
  }

  update(): void {
    /* no-op */
  }

  resize(_width: number, _height: number): void {
    this.positionTitle();
    this.positionFooter();
  }

  destroy(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}

// Strips ?action=...&token=... from the address bar after the flow finishes,
// so a casual refresh doesn't keep re-triggering the same verify/reset view.
function clearActionFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* ignore */
  }
}
