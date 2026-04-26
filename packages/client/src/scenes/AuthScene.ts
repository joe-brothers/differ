import { Application, Container, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS } from "../constants";
import { HtmlOverlay } from "../ui/HtmlOverlay";
import { createBetaBadge } from "../ui/pixiBetaBadge";
import { authState } from "../managers/AuthStateManager";
import { ApiError, authApi } from "../network/rest";
import { game } from "../core/Game";
import { evaluatePassword, PASSWORD_HINT } from "../managers/passwordStrength";

type AuthView = "chooser" | "signin" | "signup" | "totp" | "forgot";

export class AuthScene extends Container implements IScene {
  private app: Application;
  private overlay: HtmlOverlay | null = null;
  private title: Text | null = null;
  private betaBadge: Container | null = null;
  private view: AuthView = "chooser";
  private totpTicket: string | null = null;

  constructor(app: Application) {
    super();
    this.app = app;
  }

  async init(): Promise<void> {
    this.createTitle();
    this.render();
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
  }

  private positionTitle(): void {
    if (!this.title) return;
    this.title.position.set(this.app.screen.width / 2, this.app.screen.height * 0.15);
    if (this.betaBadge) {
      this.betaBadge.position.set(this.title.x + this.title.width / 2 + 8, this.title.y);
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
    else this.renderCredentialsForm();
  }

  private renderChooser(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;

    const heading = document.createElement("h2");
    heading.textContent = "Welcome";
    Object.assign(heading.style, {
      color: "#202124",
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
      guestBtn.textContent = "Loading...";
      try {
        await authState.createGuest();
        game.showMainMenu();
      } catch {
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
      color: "#202124",
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
        color: "#1A73E8",
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
    const isSignupValid = (): boolean => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (username.length < 3 || username.length > 32) return false;
      if (!/^[A-Za-z0-9_]+$/.test(username)) return false;
      if (password.length < 8 || password.length > 128) return false;
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return false;
      return true;
    };

    const overlay = this.overlay;
    const refreshSubmit = () => {
      if (!isSignUp) return;
      overlay.setButtonEnabled(submitBtn, isSignupValid());
    };

    if (isSignUp) {
      overlay.setButtonEnabled(submitBtn, false);
      passwordInput.addEventListener("input", () => {
        recomputeStrength();
        refreshSubmit();
      });
      usernameInput.addEventListener("input", () => {
        recomputeStrength();
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
      submitBtn.textContent = "Loading...";
      errorText.textContent = "";
      try {
        if (isSignUp) {
          // Signup = create a guest account, then upgrade it with credentials.
          if (!authState.isAuthenticated()) {
            await authState.createGuest();
          }
          await authState.upgrade(username, password);
          game.showMainMenu();
        } else {
          const result = await authState.login(username, password);
          if (result.kind === "totp") {
            this.totpTicket = result.ticket;
            this.view = "totp";
            this.render();
            return;
          }
          game.showMainMenu();
        }
      } catch (err) {
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
      color: "#202124",
      margin: "0 0 8px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent = "Enter the 6-digit code from your authenticator app.";
    Object.assign(blurb.style, {
      color: "#5F6368",
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
      submitBtn.textContent = "Verifying...";
      errorText.textContent = "";
      try {
        await authState.completeTotpLogin(this.totpTicket, code);
        this.totpTicket = null;
        game.showMainMenu();
      } catch (err) {
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
      color: "#202124",
      margin: "0 0 8px 0",
      fontSize: "22px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent =
      "Enter your username or email. If a matching account exists, we'll send a reset link. (Email delivery is mocked for now.)";
    Object.assign(blurb.style, {
      color: "#5F6368",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(blurb);

    const idInput = this.overlay.createInput(card, {
      type: "text",
      placeholder: "Username or email",
      name: "identifier",
      autocomplete: "username",
    });

    const status = this.overlay.createErrorText(card);
    const submitBtn = this.overlay.createButton(card, "Send Reset Link");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");

    backBtn.addEventListener("click", () => {
      this.view = "signin";
      this.render();
    });

    const submit = async () => {
      const value = idInput.value.trim();
      if (!value) {
        status.style.color = "#D93025";
        status.textContent = "Enter a username or email.";
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      try {
        const isEmail = value.includes("@");
        await authApi.forgotPassword(isEmail ? { email: value } : { username: value });
        status.style.color = "#188038";
        status.textContent = "If an account matches, you'll receive an email shortly.";
      } catch {
        // Mocked endpoint always succeeds; treat any failure as transient.
        status.style.color = "#188038";
        status.textContent = "If an account matches, you'll receive an email shortly.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
      }
    };
    submitBtn.addEventListener("click", submit);
    idInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    idInput.focus();
  }

  update(): void {
    /* no-op */
  }

  resize(_width: number, _height: number): void {
    this.positionTitle();
  }

  destroy(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
