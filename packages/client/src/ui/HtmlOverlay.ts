// Mirrors a subset of CSS tokens from src/ui/styles.ts. Kept inline so this
// module stays a plain DOM helper with no React dependency.
const TOKENS = {
  surface: "#FFFFFF",
  surfaceSunken: "#F1F3F4",
  border: "#DADCE0",
  borderStrong: "#BDC1C6",
  text: "#202124",
  textSecondary: "#5F6368",
  primary: "#1A73E8",
  primaryOn: "#FFFFFF",
  error: "#D93025",
} as const;

const FONT_FAMILY =
  '"Google Sans", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export class HtmlOverlay {
  private container: HTMLDivElement;

  constructor() {
    const app = document.getElementById("app");
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      pointerEvents: "none",
      zIndex: "10",
      fontFamily: FONT_FAMILY,
    });
    app?.appendChild(this.container);
  }

  createFormContainer(): HTMLDivElement {
    const card = document.createElement("div");
    Object.assign(card.style, {
      backgroundColor: TOKENS.surface,
      border: `1px solid ${TOKENS.border}`,
      borderRadius: "12px",
      padding: "32px",
      width: "360px",
      maxWidth: "90vw",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      pointerEvents: "auto",
      boxShadow: "0 2px 6px 2px rgba(60,64,67,.10), 0 1px 2px 0 rgba(60,64,67,.06)",
      color: TOKENS.text,
      fontFamily: FONT_FAMILY,
    });
    this.container.appendChild(card);
    return card;
  }

  createInput(
    parent: HTMLElement,
    options: { type: string; placeholder: string; name: string },
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = options.type;
    input.placeholder = options.placeholder;
    input.name = options.name;
    Object.assign(input.style, {
      padding: "10px 12px",
      height: "40px",
      borderRadius: "4px",
      border: `1px solid ${TOKENS.border}`,
      backgroundColor: TOKENS.surface,
      color: TOKENS.text,
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
      transition: "border-color 80ms ease-out, box-shadow 80ms ease-out",
    });
    input.addEventListener("focus", () => {
      input.style.borderColor = TOKENS.primary;
      input.style.boxShadow = `0 0 0 2px ${TOKENS.primary}33`;
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = TOKENS.border;
      input.style.boxShadow = "none";
    });
    parent.appendChild(input);
    return input;
  }

  createButton(
    parent: HTMLElement,
    text: string,
    color: string = TOKENS.primary,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    Object.assign(button.style, {
      padding: "10px 24px",
      height: "40px",
      borderRadius: "4px",
      border: "none",
      backgroundColor: color,
      color: TOKENS.primaryOn,
      fontFamily: FONT_FAMILY,
      fontSize: "14px",
      fontWeight: "500",
      letterSpacing: "0.25px",
      cursor: "pointer",
      transition: "box-shadow 80ms ease-out",
      boxShadow: "none",
    });
    // State-layer hover/press: a translucent dark inset ring darkens the
    // button uniformly without needing a per-color hover token.
    button.addEventListener("mouseenter", () => {
      if (button.disabled) return;
      button.style.boxShadow = "inset 0 0 0 9999px rgba(0,0,0,0.08)";
    });
    button.addEventListener("mouseleave", () => {
      button.style.boxShadow = "none";
    });
    button.addEventListener("mousedown", () => {
      if (button.disabled) return;
      button.style.boxShadow = "inset 0 0 0 9999px rgba(0,0,0,0.16)";
    });
    button.addEventListener("mouseup", () => {
      if (button.disabled) return;
      button.style.boxShadow = "inset 0 0 0 9999px rgba(0,0,0,0.08)";
    });
    parent.appendChild(button);
    return button;
  }

  // Outlined / "secondary" button variant — used for Back / Cancel actions.
  // Callers previously achieved this by setting button.style.background to a
  // muted color; expose it explicitly so styling stays in one place.
  createSecondaryButton(parent: HTMLElement, text: string): HTMLButtonElement {
    const button = this.createButton(parent, text, TOKENS.surface);
    button.style.color = TOKENS.text;
    button.style.border = `1px solid ${TOKENS.border}`;
    return button;
  }

  // A small inline progress spinner. Used in waiting/loading cards so users
  // can tell the UI is alive even when nothing else changes.
  createSpinner(parent: HTMLElement, size: number = 20): HTMLDivElement {
    HtmlOverlay.ensureSpinnerKeyframes();
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "4px",
    });
    const spinner = document.createElement("div");
    Object.assign(spinner.style, {
      width: `${size}px`,
      height: `${size}px`,
      border: `2px solid ${TOKENS.border}`,
      borderTopColor: TOKENS.primary,
      borderRadius: "50%",
      animation: "differSpin 0.8s linear infinite",
    });
    wrapper.appendChild(spinner);
    parent.appendChild(wrapper);
    return wrapper;
  }

  private static spinnerKeyframesInjected = false;
  private static ensureSpinnerKeyframes(): void {
    if (HtmlOverlay.spinnerKeyframesInjected) return;
    const style = document.createElement("style");
    style.textContent = `@keyframes differSpin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    HtmlOverlay.spinnerKeyframesInjected = true;
  }

  createErrorText(parent: HTMLElement): HTMLParagraphElement {
    const p = document.createElement("p");
    Object.assign(p.style, {
      color: TOKENS.error,
      fontFamily: FONT_FAMILY,
      fontSize: "13px",
      margin: "0",
      minHeight: "18px",
    });
    parent.appendChild(p);
    return p;
  }

  destroy(): void {
    this.container.remove();
  }
}
