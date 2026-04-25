import { Application, Container, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS } from "../constants";
import { HtmlOverlay } from "../ui/HtmlOverlay";
import { authState } from "../managers/AuthStateManager";
import { ApiError } from "../network/rest";
import { game } from "../core/Game";

type AuthView = "chooser" | "signin" | "signup";

export class AuthScene extends Container implements IScene {
  private app: Application;
  private overlay: HtmlOverlay | null = null;
  private title: Text | null = null;
  private view: AuthView = "chooser";

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
      text: "Find the Difference",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 48,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    this.title.anchor.set(0.5);
    this.title.position.set(this.app.screen.width / 2, this.app.screen.height * 0.15);
    this.addChild(this.title);
  }

  private resetOverlay(): HTMLDivElement | null {
    this.overlay?.destroy();
    this.overlay = new HtmlOverlay();
    return this.overlay.createFormContainer();
  }

  private render(): void {
    if (this.view === "chooser") this.renderChooser();
    else this.renderCredentialsForm();
  }

  private renderChooser(): void {
    const card = this.resetOverlay();
    if (!card || !this.overlay) return;

    const heading = document.createElement("h2");
    heading.textContent = "Welcome";
    Object.assign(heading.style, {
      color: "#ffffff",
      margin: "0 0 12px 0",
      fontSize: "24px",
      textAlign: "center",
    });
    card.appendChild(heading);

    const signInBtn = this.overlay.createButton(card, "Sign In");
    const signUpBtn = this.overlay.createButton(card, "Create Account");
    const guestBtn = this.overlay.createButton(card, "Continue as Guest");
    guestBtn.style.background = "#3a3a5e";

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
      color: "#ffffff",
      margin: "0 0 8px 0",
      fontSize: "24px",
      textAlign: "center",
    });
    card.appendChild(heading);

    const usernameInput = this.overlay.createInput(card, {
      type: "text",
      placeholder: "Username",
      name: "username",
    });
    const passwordInput = this.overlay.createInput(card, {
      type: "password",
      placeholder: "Password",
      name: "password",
    });

    const errorText = this.overlay.createErrorText(card);
    const submitBtn = this.overlay.createButton(card, isSignUp ? "Create" : "Sign In");
    const backBtn = this.overlay.createButton(card, "Back");
    backBtn.style.background = "#3a3a5e";

    backBtn.addEventListener("click", () => {
      this.view = "chooser";
      this.render();
    });

    const submit = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorText.textContent = "Username and password are required.";
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Loading...";
      errorText.textContent = "";
      try {
        if (isSignUp) {
          // Signup = create a guest account, then upgrade it with credentials.
          if (!authState.getToken()) {
            await authState.createGuest();
          }
          await authState.upgrade(username, password);
        } else {
          await authState.login(username, password);
        }
        game.showMainMenu();
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
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUp ? "Create" : "Sign In";
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

  update(): void {
    /* no-op */
  }

  resize(width: number, height: number): void {
    if (this.title) this.title.position.set(width / 2, height * 0.15);
  }

  destroy(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
