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
    options: { type: string; placeholder: string; name: string; autocomplete?: string },
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = options.type;
    input.placeholder = options.placeholder;
    input.name = options.name;
    if (options.autocomplete !== undefined)
      input.setAttribute("autocomplete", options.autocomplete);
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

  // Variant of createInput with a hover/focus-revealed info bubble next to
  // it. Used to surface password rules without permanently consuming a row
  // of helper text under the field.
  createInputWithHint(
    parent: HTMLElement,
    options: { type: string; placeholder: string; name: string; autocomplete?: string },
    hint: { title: string; items: string[] },
  ): HTMLInputElement {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { position: "relative", width: "100%" });
    parent.appendChild(wrap);

    const input = this.createInput(wrap, options);
    // Reserve space for the icon so cursor / placeholder don't overlap it.
    input.style.paddingRight = "36px";

    const icon = document.createElement("button");
    icon.type = "button";
    icon.tabIndex = 0;
    icon.setAttribute("aria-label", hint.title);
    icon.textContent = "i";
    Object.assign(icon.style, {
      position: "absolute",
      right: "8px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      border: `1px solid ${TOKENS.borderStrong}`,
      background: TOKENS.surface,
      color: TOKENS.textSecondary,
      fontFamily: "Georgia, serif",
      fontStyle: "italic",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "help",
      padding: "0",
      lineHeight: "1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    wrap.appendChild(icon);

    const tip = document.createElement("div");
    Object.assign(tip.style, {
      position: "absolute",
      right: "0",
      top: "calc(100% + 6px)",
      zIndex: "20",
      minWidth: "260px",
      maxWidth: "320px",
      padding: "10px 12px",
      background: TOKENS.surface,
      border: `1px solid ${TOKENS.border}`,
      borderRadius: "6px",
      boxShadow: "0 2px 6px 2px rgba(60,64,67,.10), 0 1px 2px 0 rgba(60,64,67,.06)",
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: TOKENS.text,
      display: "none",
    });
    const heading = document.createElement("strong");
    heading.textContent = hint.title;
    Object.assign(heading.style, { display: "block", marginBottom: "6px", fontWeight: "500" });
    tip.appendChild(heading);
    const ul = document.createElement("ul");
    Object.assign(ul.style, {
      margin: "0",
      paddingLeft: "16px",
      color: TOKENS.textSecondary,
    });
    for (const item of hint.items) {
      const li = document.createElement("li");
      li.textContent = item;
      li.style.marginTop = "2px";
      ul.appendChild(li);
    }
    tip.appendChild(ul);
    wrap.appendChild(tip);

    const show = () => {
      tip.style.display = "block";
    };
    const hide = () => {
      tip.style.display = "none";
    };
    icon.addEventListener("mouseenter", show);
    icon.addEventListener("mouseleave", hide);
    icon.addEventListener("focus", show);
    icon.addEventListener("blur", hide);
    // Tap (touch / keyboard) toggles for devices without hover.
    icon.addEventListener("click", (e) => {
      e.preventDefault();
      tip.style.display = tip.style.display === "block" ? "none" : "block";
    });

    return input;
  }

  // Wraps a password input with a show/hide toggle button at its right edge.
  // Coexists with createInputWithHint by shifting any existing right-pinned
  // sibling icon further left to make room.
  addPasswordToggle(input: HTMLInputElement): HTMLButtonElement {
    let wrap = input.parentElement as HTMLElement | null;
    if (!wrap || wrap.style.position !== "relative") {
      const newWrap = document.createElement("div");
      Object.assign(newWrap.style, { position: "relative", width: "100%" });
      const grandParent = input.parentElement;
      if (grandParent) {
        grandParent.insertBefore(newWrap, input);
        newWrap.appendChild(input);
      }
      wrap = newWrap;
    }

    let hasNeighbor = false;
    for (const child of Array.from(wrap.children)) {
      if (child === input) continue;
      const el = child as HTMLElement;
      if (el.style.position === "absolute" && el.style.right === "8px") {
        el.style.right = "40px";
        hasNeighbor = true;
      }
    }
    input.style.paddingRight = hasNeighbor ? "68px" : "36px";

    const EYE_OPEN =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    const btn = document.createElement("button");
    btn.type = "button";
    btn.tabIndex = 0;
    btn.setAttribute("aria-label", "Show password");
    btn.innerHTML = EYE_OPEN;
    Object.assign(btn.style, {
      position: "absolute",
      right: "8px",
      top: "50%",
      transform: "translateY(-50%)",
      width: "28px",
      height: "28px",
      border: "none",
      background: "transparent",
      color: TOKENS.textSecondary,
      cursor: "pointer",
      padding: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.color = TOKENS.text;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.color = TOKENS.textSecondary;
    });
    wrap.appendChild(btn);

    let visible = false;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      visible = !visible;
      input.type = visible ? "text" : "password";
      btn.innerHTML = visible ? EYE_OFF : EYE_OPEN;
      btn.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      input.focus();
    });

    return btn;
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

  // Toggles a button between enabled and disabled with visible affordance.
  // Inline styles only, so the visual state survives any later style writes
  // the caller might do (e.g. swapping text to "Loading…").
  setButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
    button.disabled = !enabled;
    button.style.opacity = enabled ? "1" : "0.5";
    button.style.cursor = enabled ? "pointer" : "not-allowed";
    if (!enabled) button.style.boxShadow = "none";
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

  createHelperText(parent: HTMLElement): HTMLParagraphElement {
    const p = document.createElement("p");
    Object.assign(p.style, {
      color: TOKENS.textSecondary,
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      margin: "-4px 0 0 0",
      minHeight: "16px",
    });
    parent.appendChild(p);
    return p;
  }

  // Password strength meter — a 4-segment bar plus a label.
  // Returns an `update(score, label)` API so callers can drive it from a
  // zxcvbn result without touching DOM directly.
  createStrengthMeter(parent: HTMLElement): {
    update: (score: number, label: string) => void;
    element: HTMLDivElement;
  } {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      marginTop: "-4px",
    });
    const bar = document.createElement("div");
    Object.assign(bar.style, {
      display: "flex",
      gap: "4px",
      width: "100%",
    });
    const segments: HTMLDivElement[] = [];
    for (let i = 0; i < 4; i++) {
      const seg = document.createElement("div");
      Object.assign(seg.style, {
        flex: "1",
        height: "4px",
        backgroundColor: TOKENS.border,
        borderRadius: "2px",
        transition: "background-color 120ms ease-out",
      });
      bar.appendChild(seg);
      segments.push(seg);
    }
    const label = document.createElement("span");
    Object.assign(label.style, {
      fontFamily: FONT_FAMILY,
      fontSize: "12px",
      color: TOKENS.textSecondary,
      minHeight: "16px",
    });
    wrap.appendChild(bar);
    wrap.appendChild(label);
    parent.appendChild(wrap);

    // 0/1 fail (red), 2 passes but is still weak (amber), 3/4 are clearly
    // good (green). Mirrors the submit gate (passes at ≥ 2).
    const COLORS_BY_SCORE: Record<number, string> = {
      0: TOKENS.error,
      1: TOKENS.error,
      2: "#F9AB00",
      3: "#1E8E3E",
      4: "#188038",
    };
    return {
      element: wrap,
      update: (score, text) => {
        const filled = score === 0 ? 0 : score; // score 1 → 1 segment, 4 → 4
        const color = COLORS_BY_SCORE[score] ?? TOKENS.border;
        segments.forEach((seg, i) => {
          seg.style.backgroundColor = i < filled ? color : TOKENS.border;
        });
        label.textContent = text;
        // Mirrors the submit gate (≥ 2 passes). Fail-state labels go red,
        // passing labels stay neutral so the meter doesn't shout when the
        // user has already reached an acceptable level.
        label.style.color = score >= 2 ? TOKENS.textSecondary : TOKENS.error;
      },
    };
  }

  destroy(): void {
    this.container.remove();
  }
}
