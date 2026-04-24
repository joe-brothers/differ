import { Container, Graphics } from "pixi.js";
import { COLORS } from "../constants";

export class CelebrationEffect extends Container {
  constructor() {
    super();
  }

  play(centerX: number, centerY: number): Promise<void> {
    return new Promise((resolve) => {
      // Create expanding circle
      const circle = new Graphics();
      circle.circle(0, 0, 10);
      circle.fill({ color: COLORS.success, alpha: 0.6 });
      circle.position.set(centerX, centerY);
      this.addChild(circle);

      // Animation parameters
      const duration = 500; // ms
      const maxRadius = 150;
      const startTime = Date.now();

      const animate = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentRadius = 10 + (maxRadius - 10) * eased;
        const currentAlpha = 0.6 * (1 - eased);

        circle.clear();
        circle.circle(0, 0, currentRadius);
        circle.fill({ color: COLORS.success, alpha: currentAlpha });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.removeChild(circle);
          circle.destroy();
          resolve();
        }
      };

      requestAnimationFrame(animate);

      // Also create some smaller particles
      this.createParticles(centerX, centerY);
    });
  }

  private createParticles(centerX: number, centerY: number): void {
    const particleCount = 8;
    const duration = 600;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const particle = new Graphics();
      particle.circle(0, 0, 8);
      particle.fill(COLORS.success);
      particle.position.set(centerX, centerY);
      this.addChild(particle);

      const startTime = Date.now();
      const targetX = centerX + Math.cos(angle) * 100;
      const targetY = centerY + Math.sin(angle) * 100;

      const animateParticle = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out
        const eased = 1 - Math.pow(1 - progress, 2);

        particle.position.set(
          centerX + (targetX - centerX) * eased,
          centerY + (targetY - centerY) * eased,
        );
        particle.alpha = 1 - eased;
        particle.scale.set(1 - eased * 0.5);

        if (progress < 1) {
          requestAnimationFrame(animateParticle);
        } else {
          this.removeChild(particle);
          particle.destroy();
        }
      };

      requestAnimationFrame(animateParticle);
    }
  }
}
