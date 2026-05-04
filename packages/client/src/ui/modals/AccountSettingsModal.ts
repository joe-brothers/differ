import QRCode from "qrcode";
import { ApiError, authApi } from "../../network/rest";
import { HtmlOverlay } from "../HtmlOverlay";

interface EmailState {
  email: string | null;
  verified: boolean;
  resendCooldownSec: number;
}

export class AccountSettingsModal {
  private overlay: HtmlOverlay | null = null;

  async open(): Promise<void> {
    this.overlay?.destroy();
    const overlay = new HtmlOverlay();
    this.overlay = overlay;
    const card = overlay.createFormContainer();
    Object.assign(card.style, { width: "420px", maxWidth: "92vw" });

    const heading = document.createElement("h2");
    heading.textContent = "Account";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const status = document.createElement("p");
    Object.assign(status.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 8px 0",
    });
    status.textContent = "Loading…";
    card.appendChild(status);

    let totpEnabled = false;
    let emailState: EmailState = { email: null, verified: false, resendCooldownSec: 0 };
    try {
      const [t, e] = await Promise.all([authApi.totpStatus(), authApi.getEmail()]);
      totpEnabled = t.enabled;
      emailState = e;
      status.textContent = "";
    } catch {
      status.style.color = "var(--error)";
      status.textContent = "Could not load account state.";
      return;
    }

    this.renderBody(card, totpEnabled, emailState);

    const closeBtn = overlay.createSecondaryButton(card, "Close");
    closeBtn.addEventListener("click", () => this.close());
  }

  close(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  // Re-renders the dynamic part (TOTP + email sections) so toggling state
  // doesn't require destroying the whole overlay. The static "Close" button
  // is appended once by the caller, after this returns.
  private renderBody(card: HTMLDivElement, totpEnabled: boolean, emailState: EmailState): void {
    if (!this.overlay) return;
    const overlay = this.overlay;
    const currentEmail = emailState.email;

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
      color: "var(--text)",
    });
    dyn.appendChild(totpHeader);

    const totpBlurb = document.createElement("p");
    totpBlurb.textContent = totpEnabled
      ? "2FA is enabled. You'll need a code from your authenticator app to sign in."
      : "Add a one-time code requirement using an authenticator app (Google Authenticator, 1Password, etc).";
    Object.assign(totpBlurb.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      margin: "0",
    });
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
          this.renderBody(card, false, emailState);
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
      enableBtn.addEventListener("click", () => this.startTotpEnrollment(card, emailState));
    }

    // ---- Email section ----
    const emailHeader = document.createElement("h3");
    emailHeader.textContent = "Recovery Email";
    Object.assign(emailHeader.style, {
      margin: "0",
      fontSize: "14px",
      fontWeight: "500",
      color: "var(--text)",
    });
    dyn.appendChild(emailHeader);

    const emailBlurb = document.createElement("p");
    if (currentEmail && emailState.verified) {
      emailBlurb.innerHTML = `Verified: <strong>${escapeHtml(currentEmail)}</strong>. We'll only contact you about password resets.`;
    } else if (currentEmail) {
      emailBlurb.innerHTML = `Pending verification: <strong>${escapeHtml(currentEmail)}</strong>. Check your inbox for the confirmation link.`;
    } else {
      emailBlurb.textContent =
        "Add an email so you can recover your account if you forget your password.";
    }
    Object.assign(emailBlurb.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      margin: "0",
    });
    dyn.appendChild(emailBlurb);

    const emailInput = overlay.createInput(dyn, {
      type: "email",
      placeholder: "you@example.com",
      name: "email",
      autocomplete: "email",
    });
    if (currentEmail) emailInput.value = currentEmail;
    const emailErr = overlay.createErrorText(dyn);
    const saveEmailBtn = overlay.createButton(
      dyn,
      currentEmail && emailState.verified ? "Change Email" : "Save & Send Verification",
    );
    saveEmailBtn.addEventListener("click", async () => {
      const value = emailInput.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        emailErr.style.color = "var(--error)";
        emailErr.textContent = "Enter a valid email.";
        return;
      }
      saveEmailBtn.disabled = true;
      try {
        await authApi.setEmail(value);
        emailErr.style.color = "var(--success)";
        emailErr.textContent = `Verification sent to ${value}.`;
        this.renderBody(card, totpEnabled, {
          email: value,
          verified: false,
          resendCooldownSec: 60,
        });
      } catch (err) {
        emailErr.style.color = "var(--error)";
        if (err instanceof ApiError && err.code === "email_taken") {
          emailErr.textContent = "Email already in use.";
        } else if (err instanceof ApiError && err.code === "rate_limited") {
          emailErr.textContent = "Please wait a moment before trying again.";
        } else {
          emailErr.textContent = "Could not save email.";
        }
      } finally {
        saveEmailBtn.disabled = false;
      }
    });

    // Resend button shows only when an email exists but isn't verified.
    // Disabled while the per-user cooldown is active; we tick a local
    // countdown so users see the wait without polling the server.
    if (currentEmail && !emailState.verified) {
      const resendBtn = overlay.createSecondaryButton(dyn, "Resend Verification");
      let secondsLeft = emailState.resendCooldownSec;
      const refreshLabel = () => {
        if (secondsLeft > 0) {
          resendBtn.disabled = true;
          resendBtn.textContent = `Resend in ${secondsLeft}s`;
        } else {
          resendBtn.disabled = false;
          resendBtn.textContent = "Resend Verification";
        }
      };
      refreshLabel();
      const tick = window.setInterval(() => {
        if (secondsLeft <= 0) {
          window.clearInterval(tick);
          return;
        }
        secondsLeft -= 1;
        refreshLabel();
      }, 1000);
      resendBtn.addEventListener("click", async () => {
        resendBtn.disabled = true;
        try {
          const r = await authApi.resendVerification();
          if (r.verified) {
            emailErr.style.color = "var(--success)";
            emailErr.textContent = "Already verified.";
            this.renderBody(card, totpEnabled, {
              email: currentEmail,
              verified: true,
              resendCooldownSec: 0,
            });
            return;
          }
          emailErr.style.color = "var(--success)";
          emailErr.textContent = `Verification re-sent to ${currentEmail}.`;
          secondsLeft = 60;
          refreshLabel();
        } catch (err) {
          emailErr.style.color = "var(--error)";
          if (err instanceof ApiError && err.code === "rate_limited") {
            emailErr.textContent = "Please wait before resending.";
            secondsLeft = Math.max(secondsLeft, 30);
            refreshLabel();
          } else {
            emailErr.textContent = "Could not resend.";
            resendBtn.disabled = false;
          }
        }
      });
    }
  }

  // Walks the user through TOTP enrollment: setup → show QR + secret → verify.
  private async startTotpEnrollment(card: HTMLDivElement, emailState: EmailState): Promise<void> {
    if (!this.overlay) return;
    const overlay = this.overlay;
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
    Object.assign(blurb.style, { color: "var(--text-secondary)", fontSize: "13px", margin: "0" });
    dyn.appendChild(blurb);

    let setup: { secret: string; otpauthUrl: string };
    try {
      setup = await authApi.totpSetup();
    } catch (err) {
      const msg = document.createElement("p");
      Object.assign(msg.style, { color: "var(--error)", fontSize: "13px", margin: "0" });
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
      color: "var(--text-secondary)",
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
      this.renderBody(card, false, emailState);
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
        this.renderBody(card, true, emailState);
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
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
