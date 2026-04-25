import { CSS, FONT_FAMILY, createButton, createCard } from "./styles";

export class PauseModal {
  private root: HTMLDivElement;
  private onResume: (() => void) | null = null;
  private onMainMenu: (() => void) | null = null;

  constructor() {
    const app = document.getElementById("app");

    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "absolute",
      inset: "0",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      display: "none",
      justifyContent: "center",
      alignItems: "center",
      zIndex: "20",
      fontFamily: FONT_FAMILY,
    });

    const card = createCard();
    card.style.gap = "20px";

    const title = document.createElement("h2");
    title.textContent = "Paused";
    Object.assign(title.style, {
      margin: "0 0 8px 0",
      fontSize: "32px",
      fontWeight: "bold",
      color: CSS.text,
    });
    card.appendChild(title);

    const resumeBtn = createButton("Resume");
    resumeBtn.addEventListener("click", () => this.onResume?.());
    card.appendChild(resumeBtn);

    const mainBtn = createButton("Main Menu");
    mainBtn.addEventListener("click", () => this.onMainMenu?.());
    card.appendChild(mainBtn);

    this.root.appendChild(card);
    app?.appendChild(this.root);
  }

  setCallbacks(onResume: () => void, onMainMenu: () => void): void {
    this.onResume = onResume;
    this.onMainMenu = onMainMenu;
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }

  destroy(): void {
    this.root.remove();
  }
}
