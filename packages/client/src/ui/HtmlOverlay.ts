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
    });
    app?.appendChild(this.container);
  }

  createFormContainer(): HTMLDivElement {
    const card = document.createElement("div");
    Object.assign(card.style, {
      backgroundColor: "#2a2a4e",
      borderRadius: "16px",
      padding: "40px",
      width: "360px",
      maxWidth: "90vw",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      pointerEvents: "auto",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
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
      padding: "12px 16px",
      borderRadius: "8px",
      border: "1px solid #3a3a6e",
      backgroundColor: "#1a1a2e",
      color: "#ffffff",
      fontSize: "16px",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
    });
    input.addEventListener("focus", () => {
      input.style.borderColor = "#4a90d9";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "#3a3a6e";
    });
    parent.appendChild(input);
    return input;
  }

  createButton(parent: HTMLElement, text: string, color = "#4a90d9"): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    Object.assign(button.style, {
      padding: "12px 24px",
      borderRadius: "8px",
      border: "none",
      backgroundColor: color,
      color: "#ffffff",
      fontSize: "16px",
      fontWeight: "bold",
      cursor: "pointer",
      marginTop: "8px",
    });
    button.addEventListener("mouseenter", () => {
      button.style.opacity = "0.85";
    });
    button.addEventListener("mouseleave", () => {
      button.style.opacity = "1";
    });
    parent.appendChild(button);
    return button;
  }

  createErrorText(parent: HTMLElement): HTMLParagraphElement {
    const p = document.createElement("p");
    Object.assign(p.style, {
      color: "#ff5252",
      fontSize: "14px",
      margin: "0",
      minHeight: "20px",
    });
    parent.appendChild(p);
    return p;
  }

  destroy(): void {
    this.container.remove();
  }
}
