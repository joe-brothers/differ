import { Application, Container, Graphics, Text } from "pixi.js";
import QRCode from "qrcode";
import type { IScene } from "../types";
import { COLORS } from "../constants";
import { game } from "../core/Game";
import { authState } from "../managers/AuthStateManager";
import { HtmlOverlay } from "../ui/HtmlOverlay";
import { ApiError, authApi } from "../network/rest";
import { evaluatePassword, PASSWORD_HINT } from "../managers/passwordStrength";

export class MainMenuScene extends Container implements IScene {
  private app: Application;
  private title: Text | null = null;
  private sprintButton: Container | null = null;
  private matchButton: Container | null = null;
  private leaderboardButton: Container | null = null;
  private historyButton: Container | null = null;
  private usernameText: Text | null = null;
  private winsText: Text | null = null;
  private logoutText: Text | null = null;
  private upgradeText: Text | null = null;
  private settingsText: Text | null = null;
  private upgradeOverlay: HtmlOverlay | null = null;
  private settingsOverlay: HtmlOverlay | null = null;

  constructor(app: Application) {
    super();
    this.app = app;
  }

  async init(): Promise<void> {
    this.createTitle();
    this.createSprintButton();
    this.createMatchButton();
    this.createLeaderboardButton();
    // History affordance is registered-user only — guests' /me/recent always
    // returns [] so the button would just lead to an empty card.
    if (!authState.getUser()?.isGuest) {
      this.createHistoryButton();
    }
    this.createUserInfo();
    // Pull fresh stats (wins) so the counter reflects games played in the
    // last session — fire-and-forget so the menu still draws instantly.
    void authState.refresh().then(() => this.refreshUserInfo());
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
    this.title.position.set(this.app.screen.width / 2, this.app.screen.height / 4);
    this.addChild(this.title);
  }

  private drawFilledButton(bg: Graphics, w: number, h: number, fill: number): void {
    bg.clear();
    bg.roundRect(-w / 2, -h / 2, w, h, 4);
    bg.fill(fill);
  }

  private drawOutlinedButton(bg: Graphics, w: number, h: number, fill: number): void {
    bg.clear();
    bg.roundRect(-w / 2, -h / 2, w, h, 4);
    bg.fill(fill);
    bg.stroke({ color: COLORS.border, width: 1 });
  }

  private createSprintButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 48;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 - 40;

    this.sprintButton = new Container();
    this.sprintButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    this.drawFilledButton(bg, buttonWidth, buttonHeight, COLORS.primary);

    const text = new Text({
      text: "5 Sprint",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fontWeight: "500",
        fill: COLORS.primaryOn,
      },
    });
    text.anchor.set(0.5);

    this.sprintButton.addChild(bg, text);
    this.sprintButton.eventMode = "static";
    this.sprintButton.cursor = "pointer";

    this.sprintButton.on("pointerover", () => {
      this.drawFilledButton(bg, buttonWidth, buttonHeight, COLORS.primaryHover);
    });
    this.sprintButton.on("pointerout", () => {
      this.drawFilledButton(bg, buttonWidth, buttonHeight, COLORS.primary);
    });
    this.sprintButton.on("pointerdown", () => {
      game.startSinglePlayer();
    });

    this.addChild(this.sprintButton);
  }

  private createMatchButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 48;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 + 16;

    this.matchButton = new Container();
    this.matchButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);

    const text = new Text({
      text: "1v1 Match",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fontWeight: "500",
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);

    this.matchButton.addChild(bg, text);
    this.matchButton.eventMode = "static";
    this.matchButton.cursor = "pointer";

    this.matchButton.on("pointerover", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surfaceMuted);
    });
    this.matchButton.on("pointerout", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);
    });
    this.matchButton.on("pointerdown", () => {
      game.showMatchmaking();
    });

    this.addChild(this.matchButton);
  }

  private createLeaderboardButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 48;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 + 72;

    this.leaderboardButton = new Container();
    this.leaderboardButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);

    const text = new Text({
      text: "Leaderboard",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 14,
        fontWeight: "500",
        fill: COLORS.primary,
      },
    });
    text.anchor.set(0.5);

    this.leaderboardButton.addChild(bg, text);
    this.leaderboardButton.eventMode = "static";
    this.leaderboardButton.cursor = "pointer";

    this.leaderboardButton.on("pointerover", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.primarySoft);
    });
    this.leaderboardButton.on("pointerout", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);
    });
    this.leaderboardButton.on("pointerdown", () => {
      game.showLeaderboard();
    });

    this.addChild(this.leaderboardButton);
  }

  private createHistoryButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 48;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 + 128;

    this.historyButton = new Container();
    this.historyButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);

    const text = new Text({
      text: "History",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 14,
        fontWeight: "500",
        fill: COLORS.primary,
      },
    });
    text.anchor.set(0.5);

    this.historyButton.addChild(bg, text);
    this.historyButton.eventMode = "static";
    this.historyButton.cursor = "pointer";

    this.historyButton.on("pointerover", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.primarySoft);
    });
    this.historyButton.on("pointerout", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);
    });
    this.historyButton.on("pointerdown", () => {
      game.showHistory();
    });

    this.addChild(this.historyButton);
  }

  private formatWins(n: number): string {
    return n === 1 ? "1 win" : `${n} wins`;
  }

  // Updates just the wins line in place so a refetch doesn't repaint the
  // whole corner (which would also reset hover state on the surrounding
  // links).
  private refreshUserInfo(): void {
    if (this.winsText) {
      this.winsText.text = this.formatWins(authState.getWins());
    }
  }

  private createUserInfo(): void {
    const user = authState.getUser();
    if (!user) return;

    this.usernameText = new Text({
      text: user.name,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 18,
        fill: COLORS.text,
      },
    });
    this.usernameText.anchor.set(1, 0);
    this.usernameText.position.set(this.app.screen.width - 20, 20);
    this.addChild(this.usernameText);

    let nextY = 46;

    // Wins: shown for everyone (guests just always read 0 since their
    // results don't get persisted to the leaderboard). Suppress the line
    // for guests so the corner stays uncluttered.
    if (!user.isGuest) {
      this.winsText = new Text({
        text: this.formatWins(authState.getWins()),
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          fill: COLORS.textSecondary,
        },
      });
      this.winsText.anchor.set(1, 0);
      this.winsText.position.set(this.app.screen.width - 20, nextY);
      this.addChild(this.winsText);
      nextY += 22;
    }

    // Guests get a "Save Account" link that lets them claim a permanent
    // username/password without losing their session or stats.
    if (user.isGuest) {
      this.upgradeText = new Text({
        text: "Save Account",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          fill: COLORS.primary,
        },
      });
      this.upgradeText.anchor.set(1, 0);
      this.upgradeText.position.set(this.app.screen.width - 20, nextY);
      this.upgradeText.eventMode = "static";
      this.upgradeText.cursor = "pointer";
      this.upgradeText.on("pointerover", () => {
        if (this.upgradeText) this.upgradeText.style.fill = COLORS.primaryHover;
      });
      this.upgradeText.on("pointerout", () => {
        if (this.upgradeText) this.upgradeText.style.fill = COLORS.primary;
      });
      this.upgradeText.on("pointerdown", () => this.openUpgradeModal());
      this.addChild(this.upgradeText);
      nextY += 26;
    }

    // Registered users get an "Account" link to manage 2FA + email.
    if (!user.isGuest) {
      this.settingsText = new Text({
        text: "Account",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          fill: COLORS.primary,
        },
      });
      this.settingsText.anchor.set(1, 0);
      this.settingsText.position.set(this.app.screen.width - 20, nextY);
      this.settingsText.eventMode = "static";
      this.settingsText.cursor = "pointer";
      this.settingsText.on("pointerover", () => {
        if (this.settingsText) this.settingsText.style.fill = COLORS.primaryHover;
      });
      this.settingsText.on("pointerout", () => {
        if (this.settingsText) this.settingsText.style.fill = COLORS.primary;
      });
      this.settingsText.on("pointerdown", () => this.openSettingsModal());
      this.addChild(this.settingsText);
      nextY += 26;
    }

    this.logoutText = new Text({
      text: "Logout",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fill: COLORS.textSecondary,
      },
    });
    this.logoutText.anchor.set(1, 0);
    this.logoutText.position.set(this.app.screen.width - 20, nextY);
    this.logoutText.eventMode = "static";
    this.logoutText.cursor = "pointer";
    this.logoutText.on("pointerover", () => {
      if (this.logoutText) this.logoutText.style.fill = COLORS.text;
    });
    this.logoutText.on("pointerout", () => {
      if (this.logoutText) this.logoutText.style.fill = COLORS.textSecondary;
    });
    this.logoutText.on("pointerdown", async () => {
      await authState.logout();
      game.showAuthScene();
    });
    this.addChild(this.logoutText);
  }

  private openUpgradeModal(): void {
    this.upgradeOverlay?.destroy();
    this.upgradeOverlay = new HtmlOverlay();
    const card = this.upgradeOverlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Save Account";
    Object.assign(heading.style, {
      color: "#202124",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent = "Pick a username and password to keep your guest progress.";
    Object.assign(blurb.style, {
      color: "#5F6368",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(blurb);

    const usernameInput = this.upgradeOverlay.createInput(card, {
      type: "text",
      placeholder: "Username",
      name: "username",
      autocomplete: "username",
    });
    const passwordInput = this.upgradeOverlay.createInputWithHint(
      card,
      {
        type: "password",
        placeholder: "Password",
        name: "password",
        autocomplete: "new-password",
      },
      { title: PASSWORD_HINT.title, items: [...PASSWORD_HINT.items] },
    );
    this.upgradeOverlay.addPasswordToggle(passwordInput);
    const meter = this.upgradeOverlay.createStrengthMeter(card);

    const errorText = this.upgradeOverlay.createErrorText(card);
    const submitBtn = this.upgradeOverlay.createButton(card, "Save");
    const cancelBtn = this.upgradeOverlay.createSecondaryButton(card, "Cancel");

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
    const overlay = this.upgradeOverlay;
    const isFormValid = (): boolean => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (username.length < 3 || username.length > 32) return false;
      if (!/^[A-Za-z0-9_]+$/.test(username)) return false;
      if (password.length < 8 || password.length > 128) return false;
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return false;
      return true;
    };
    const refreshSubmit = () => overlay.setButtonEnabled(submitBtn, isFormValid());
    overlay.setButtonEnabled(submitBtn, false);

    passwordInput.addEventListener("input", () => {
      refreshStrength();
      refreshSubmit();
    });
    usernameInput.addEventListener("input", () => {
      refreshStrength();
      refreshSubmit();
    });

    cancelBtn.addEventListener("click", () => {
      this.upgradeOverlay?.destroy();
      this.upgradeOverlay = null;
    });

    const submit = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorText.textContent = "Username and password are required.";
        return;
      }
      overlay.setButtonEnabled(submitBtn, false);
      submitBtn.textContent = "Saving...";
      errorText.textContent = "";
      try {
        await authState.upgrade(username, password);
        this.upgradeOverlay?.destroy();
        this.upgradeOverlay = null;
        // Refresh the menu so the upgrade link disappears and the new name
        // shows up in the corner.
        await game.showMainMenu();
      } catch (err) {
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

  // Account settings overlay: 2FA setup + email (mockup) for registered users.
  // Built lazily — fetches current state when opened, no caching needed.
  private async openSettingsModal(): Promise<void> {
    this.settingsOverlay?.destroy();
    this.settingsOverlay = new HtmlOverlay();
    const card = this.settingsOverlay.createFormContainer();
    Object.assign(card.style, { width: "420px", maxWidth: "92vw" });

    const heading = document.createElement("h2");
    heading.textContent = "Account";
    Object.assign(heading.style, {
      color: "#202124",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const status = document.createElement("p");
    Object.assign(status.style, {
      color: "#5F6368",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 8px 0",
    });
    status.textContent = "Loading…";
    card.appendChild(status);

    let totpEnabled = false;
    let currentEmail: string | null = null;
    try {
      const [t, e] = await Promise.all([authApi.totpStatus(), authApi.getEmail()]);
      totpEnabled = t.enabled;
      currentEmail = e.email;
      status.textContent = "";
    } catch {
      status.style.color = "#D93025";
      status.textContent = "Could not load account state.";
      return;
    }

    this.renderSettingsBody(card, totpEnabled, currentEmail);

    const closeBtn = this.settingsOverlay.createSecondaryButton(card, "Close");
    closeBtn.addEventListener("click", () => {
      this.settingsOverlay?.destroy();
      this.settingsOverlay = null;
    });
  }

  // Re-renders the dynamic part (TOTP + email sections) so toggling state
  // doesn't require destroying the whole overlay. The static "Close" button
  // is appended once by the caller, after this returns.
  private renderSettingsBody(
    card: HTMLDivElement,
    totpEnabled: boolean,
    currentEmail: string | null,
  ): void {
    if (!this.settingsOverlay) return;
    const overlay = this.settingsOverlay;

    // Wipe any pre-existing dynamic section so re-renders stay clean.
    const existing = card.querySelector('[data-section="dynamic"]');
    existing?.remove();

    const dyn = document.createElement("div");
    dyn.dataset.section = "dynamic";
    Object.assign(dyn.style, { display: "flex", flexDirection: "column", gap: "16px" });
    card.insertBefore(dyn, card.lastElementChild); // before "Close"

    // ---- 2FA section ----
    const totpHeader = document.createElement("h3");
    totpHeader.textContent = "Two-Factor Authentication";
    Object.assign(totpHeader.style, {
      margin: "0",
      fontSize: "14px",
      fontWeight: "500",
      color: "#202124",
    });
    dyn.appendChild(totpHeader);

    const totpBlurb = document.createElement("p");
    totpBlurb.textContent = totpEnabled
      ? "2FA is enabled. You'll need a code from your authenticator app to sign in."
      : "Add a one-time code requirement using an authenticator app (Google Authenticator, 1Password, etc).";
    Object.assign(totpBlurb.style, { color: "#5F6368", fontSize: "13px", margin: "0" });
    dyn.appendChild(totpBlurb);

    if (totpEnabled) {
      const disableBtn = overlay.createSecondaryButton(dyn, "Disable 2FA");
      const pwdInput = overlay.createInput(dyn, {
        type: "password",
        placeholder: "Confirm with current password",
        name: "disable-pwd",
        autocomplete: "current-password",
      });
      overlay.addPasswordToggle(pwdInput);
      // The toggle wraps pwdInput in a relative div; hide that wrapper, not
      // the input alone, so the eye button hides with the field.
      const pwdWrap = pwdInput.parentElement ?? pwdInput;
      (pwdWrap as HTMLElement).style.display = "none";
      const errText = overlay.createErrorText(dyn);
      let armed = false;
      disableBtn.addEventListener("click", async () => {
        if (!armed) {
          armed = true;
          (pwdWrap as HTMLElement).style.display = "block";
          disableBtn.textContent = "Confirm Disable";
          pwdInput.focus();
          return;
        }
        if (!pwdInput.value) {
          errText.textContent = "Enter your password.";
          return;
        }
        disableBtn.disabled = true;
        try {
          await authApi.totpDisable(pwdInput.value);
          this.renderSettingsBody(card, false, currentEmail);
        } catch (err) {
          disableBtn.disabled = false;
          if (err instanceof ApiError && err.code === "invalid_credentials") {
            errText.textContent = "Wrong password.";
          } else {
            errText.textContent = "Could not disable 2FA.";
          }
        }
      });
    } else {
      const enableBtn = overlay.createButton(dyn, "Enable 2FA");
      enableBtn.addEventListener("click", () => this.startTotpEnrollment(card, currentEmail));
    }

    // ---- Email section ----
    const emailHeader = document.createElement("h3");
    emailHeader.textContent = "Recovery Email (mocked)";
    Object.assign(emailHeader.style, {
      margin: "0",
      fontSize: "14px",
      fontWeight: "500",
      color: "#202124",
    });
    dyn.appendChild(emailHeader);

    const emailBlurb = document.createElement("p");
    emailBlurb.textContent = currentEmail
      ? `Current: ${currentEmail}. (No email is actually sent yet.)`
      : "Add an email so you can receive a password-reset link. (No email is actually sent yet.)";
    Object.assign(emailBlurb.style, { color: "#5F6368", fontSize: "13px", margin: "0" });
    dyn.appendChild(emailBlurb);

    const emailInput = overlay.createInput(dyn, {
      type: "email",
      placeholder: "you@example.com",
      name: "email",
      autocomplete: "email",
    });
    if (currentEmail) emailInput.value = currentEmail;
    const emailErr = overlay.createErrorText(dyn);
    const saveEmailBtn = overlay.createButton(dyn, "Save Email");
    saveEmailBtn.addEventListener("click", async () => {
      const value = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        emailErr.style.color = "#D93025";
        emailErr.textContent = "Enter a valid email.";
        return;
      }
      saveEmailBtn.disabled = true;
      try {
        await authApi.setEmail(value);
        emailErr.style.color = "#188038";
        emailErr.textContent = "Saved. (Verification not implemented yet.)";
        this.renderSettingsBody(card, totpEnabled, value);
      } catch (err) {
        emailErr.style.color = "#D93025";
        if (err instanceof ApiError && err.code === "email_taken") {
          emailErr.textContent = "Email already in use.";
        } else {
          emailErr.textContent = "Could not save email.";
        }
      } finally {
        saveEmailBtn.disabled = false;
      }
    });
  }

  // Walks the user through TOTP enrollment: setup → show QR + secret → verify.
  private async startTotpEnrollment(
    card: HTMLDivElement,
    currentEmail: string | null,
  ): Promise<void> {
    if (!this.settingsOverlay) return;
    const overlay = this.settingsOverlay;
    const dyn = card.querySelector<HTMLDivElement>('[data-section="dynamic"]');
    if (!dyn) return;
    dyn.innerHTML = "";

    const heading = document.createElement("h3");
    heading.textContent = "Set up 2FA";
    Object.assign(heading.style, { margin: "0", fontSize: "14px", fontWeight: "500" });
    dyn.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent =
      "Scan the QR code with your authenticator app, then enter the 6-digit code below.";
    Object.assign(blurb.style, { color: "#5F6368", fontSize: "13px", margin: "0" });
    dyn.appendChild(blurb);

    let setup: { secret: string; otpauthUrl: string };
    try {
      setup = await authApi.totpSetup();
    } catch (err) {
      const msg = document.createElement("p");
      Object.assign(msg.style, { color: "#D93025", fontSize: "13px", margin: "0" });
      msg.textContent = err instanceof ApiError ? err.message : "Could not start setup.";
      dyn.appendChild(msg);
      return;
    }

    const qrCanvas = document.createElement("canvas");
    Object.assign(qrCanvas.style, { alignSelf: "center" });
    dyn.appendChild(qrCanvas);
    try {
      await QRCode.toCanvas(qrCanvas, setup.otpauthUrl, { width: 180, margin: 1 });
    } catch {
      qrCanvas.remove();
    }

    const secretLine = document.createElement("p");
    Object.assign(secretLine.style, {
      color: "#5F6368",
      fontSize: "12px",
      fontFamily: "ui-monospace, monospace",
      margin: "0",
      wordBreak: "break-all",
      textAlign: "center",
    });
    secretLine.textContent = `Manual entry: ${setup.secret}`;
    dyn.appendChild(secretLine);

    const codeInput = overlay.createInput(dyn, {
      type: "text",
      placeholder: "6-digit code",
      name: "totp-verify",
      autocomplete: "one-time-code",
    });
    codeInput.inputMode = "numeric";
    codeInput.maxLength = 6;

    const errText = overlay.createErrorText(dyn);
    const verifyBtn = overlay.createButton(dyn, "Verify & Enable");
    const cancelBtn = overlay.createSecondaryButton(dyn, "Cancel");

    cancelBtn.addEventListener("click", () => {
      this.renderSettingsBody(card, false, currentEmail);
    });

    const submit = async () => {
      const code = codeInput.value.trim();
      if (!/^\d{6}$/.test(code)) {
        errText.textContent = "Enter the 6-digit code.";
        return;
      }
      verifyBtn.disabled = true;
      try {
        await authApi.totpVerify(code);
        this.renderSettingsBody(card, true, currentEmail);
      } catch (err) {
        verifyBtn.disabled = false;
        if (err instanceof ApiError && err.code === "invalid_totp") {
          errText.textContent = "Invalid code. Try again.";
        } else {
          errText.textContent = "Could not verify.";
        }
      }
    };
    verifyBtn.addEventListener("click", submit);
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    codeInput.focus();
  }

  update(): void {
    // No updates needed for menu
  }

  resize(width: number, height: number): void {
    if (this.title) {
      this.title.position.set(width / 2, height / 4);
    }
    if (this.sprintButton) {
      this.sprintButton.position.set(width / 2, height / 2 - 40);
    }
    if (this.matchButton) {
      this.matchButton.position.set(width / 2, height / 2 + 16);
    }
    if (this.leaderboardButton) {
      this.leaderboardButton.position.set(width / 2, height / 2 + 72);
    }
    if (this.usernameText) {
      this.usernameText.position.set(width - 20, 20);
    }
    let y = 46;
    if (this.winsText) {
      this.winsText.position.set(width - 20, y);
      y += 22;
    }
    if (this.upgradeText) {
      this.upgradeText.position.set(width - 20, y);
      y += 26;
    }
    if (this.settingsText) {
      this.settingsText.position.set(width - 20, y);
      y += 26;
    }
    if (this.logoutText) {
      this.logoutText.position.set(width - 20, y);
    }
  }

  destroy(): void {
    this.upgradeOverlay?.destroy();
    this.upgradeOverlay = null;
    this.settingsOverlay?.destroy();
    this.settingsOverlay = null;
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
