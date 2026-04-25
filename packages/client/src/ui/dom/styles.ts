export const FONT_FAMILY = "Arial, sans-serif";

export const CSS = {
  background: "#1a1a2e",
  panel: "#2a2a4e",
  primary: "#4a90d9",
  primaryHover: "#6ba3e0",
  text: "#ffffff",
  textSecondary: "#cccccc",
  success: "#4caf50",
  error: "#ff5252",
  gold: "#ffd700",
  disabled: "#888888",
};

export function createButton(label: string, color: string = CSS.primary): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  Object.assign(btn.style, {
    width: "200px",
    padding: "12px 24px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: color,
    color: CSS.text,
    fontFamily: FONT_FAMILY,
    fontSize: "20px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "opacity 0.15s ease",
  });
  btn.addEventListener("mouseenter", () => {
    if (btn.disabled) return;
    btn.style.opacity = "0.85";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = "1";
  });
  return btn;
}

export function createCard(): HTMLDivElement {
  const card = document.createElement("div");
  Object.assign(card.style, {
    backgroundColor: CSS.panel,
    borderRadius: "20px",
    padding: "40px",
    minWidth: "320px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    fontFamily: FONT_FAMILY,
    color: CSS.text,
  });
  return card;
}
