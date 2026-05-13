import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="not-found-container">
      <div class="parallax-forest">
        <div class="weather-layer" [class]="weatherType()">
          <div class="particle p1"></div>
          <div class="particle p2"></div>
          <div class="particle p3"></div>
          <div class="particle p4"></div>
          <div class="particle p5"></div>
          <div class="particle p6"></div>
          <div class="particle p7"></div>
          <div class="particle p8"></div>
          <div class="particle p9"></div>
          <div class="particle p10"></div>
          <div class="particle p11"></div>
          <div class="particle p12"></div>
          <div class="particle p13"></div>
          <div class="particle p14"></div>
          <div class="particle p15"></div>
          <div class="particle p16"></div>
          <div class="particle p17"></div>
          <div class="particle p18"></div>
        </div>

        <div class="birds" aria-hidden="true">
          <div class="bird bird-1 type-a"></div>
          <div class="bird bird-2 type-b"></div>
          <div class="bird bird-3 type-a"></div>
          <div class="bird bird-4 type-c"></div>
          <div class="bird bird-5 type-b"></div>
        </div>

        <div class="layer layer-5"></div>
        <!-- Mountains -->
        <div class="layer layer-4"></div>
        <!-- Distant Trees -->
        <div class="layer layer-3"></div>
        <!-- Mid Trees -->
        <div class="layer layer-2"></div>
        <!-- Near Trees -->
        <div class="layer layer-1"></div>
        <!-- Foreground Trees -->

        <div class="error-code">404</div>
      </div>

      <div class="content">
        <h1>Lost in the woods</h1>
        <p>The path you're looking for doesn't exist or has been moved.</p>
        <div class="actions">
          <a routerLink="/inbox" class="btn-primary-action">Return to Inbox</a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--background);
        overflow-x: hidden;
      }

      .not-found-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        box-sizing: border-box;
      }

      .parallax-forest {
        position: relative;
        width: 100%;
        max-width: 1100px;
        height: clamp(280px, 45vh, 550px);
        margin-bottom: 2rem;
        overflow: hidden;
        border-radius: var(--radius);
        background: linear-gradient(
          to bottom,
          var(--surface-container-low),
          var(--surface-container-highest)
        );
        box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);
        flex-shrink: 0;
        isolation: isolate;
      }

      .layer {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 200%;
        height: 100%;
        background-repeat: repeat-x;
        background-position: bottom left;
        background-size: auto 90%;
        animation: slide linear infinite;
        pointer-events: none;
      }

      /* Weather Layer */
      .weather-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10;
        pointer-events: none;
      }

      .particle {
        position: absolute;
        background: white;
        opacity: 0.6;
        top: -20px;
        animation: fall linear infinite;
      }

      .weather-layer.snow .particle {
        border-radius: 50%;
      }

      .weather-layer.rain .particle {
        width: 1px !important;
        height: 20px !important;
        border-radius: 0;
        opacity: 0.3;
        background: var(--on-surface-subtle);
      }

      @keyframes fall {
        to {
          transform: translateY(650px) translateX(var(--drift, 20px));
        }
      }

      .p1 {
        width: 4px;
        height: 4px;
        left: 10%;
        animation-duration: 4s;
        --drift: 30px;
      }
      .p2 {
        width: 3px;
        height: 3px;
        left: 25%;
        animation-duration: 5s;
        --drift: -20px;
      }
      .p3 {
        width: 5px;
        height: 5px;
        left: 40%;
        animation-duration: 3.5s;
        --drift: 40px;
      }
      .p4 {
        width: 4px;
        height: 4px;
        left: 55%;
        animation-duration: 4.5s;
        --drift: -10px;
      }
      .p5 {
        width: 3px;
        height: 3px;
        left: 70%;
        animation-duration: 5.5s;
        --drift: 25px;
      }
      .p6 {
        width: 4px;
        height: 4px;
        left: 85%;
        animation-duration: 4s;
        --drift: -30px;
      }
      .p7 {
        width: 5px;
        height: 5px;
        left: 15%;
        animation-duration: 3.8s;
        --drift: 15px;
      }
      .p8 {
        width: 3px;
        height: 3px;
        left: 35%;
        animation-duration: 5.2s;
        --drift: -25px;
      }
      .p9 {
        width: 4px;
        height: 4px;
        left: 65%;
        animation-duration: 4.8s;
        --drift: 20px;
      }
      .p10 {
        width: 3px;
        height: 3px;
        left: 95%;
        animation-duration: 5s;
        --drift: -15px;
      }
      .p11 {
        width: 5px;
        height: 5px;
        left: 5%;
        animation-duration: 4.2s;
        --drift: 35px;
      }
      .p12 {
        width: 4px;
        height: 4px;
        left: 45%;
        animation-duration: 4.6s;
        --drift: -20px;
      }
      .p13 {
        width: 3px;
        height: 3px;
        left: 20%;
        animation-duration: 5.3s;
        --drift: 10px;
      }
      .p14 {
        width: 4px;
        height: 4px;
        left: 50%;
        animation-duration: 4.1s;
        --drift: -15px;
      }
      .p15 {
        width: 5px;
        height: 5px;
        left: 80%;
        animation-duration: 3.7s;
        --drift: 25px;
      }
      .p16 {
        width: 3px;
        height: 3px;
        left: 12%;
        animation-duration: 5.8s;
        --drift: -5px;
      }
      .p17 {
        width: 4px;
        height: 4px;
        left: 60%;
        animation-duration: 4.4s;
        --drift: 30px;
      }
      .p18 {
        width: 4px;
        height: 4px;
        left: 90%;
        animation-duration: 4.9s;
        --drift: -10px;
      }

      .weather-layer.rain .particle {
        animation-duration: 0.8s !important;
        animation-timing-function: ease-in;
        --drift: 10px !important;
      }

      /* Birds */
      .birds {
        position: absolute;
        inset: 0;
        z-index: 7;
        pointer-events: none;
      }

      .bird {
        position: absolute;
        background-repeat: no-repeat;
        animation:
          fly linear infinite,
          flap 0.8s ease-in-out infinite alternate;
      }

      .type-a {
        width: 40px;
        height: 25px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 40'%3E%3Cpath d='M10 20 C 15 10, 25 10, 30 20 C 35 10, 45 10, 50 20 L 45 22 C 40 18, 35 18, 30 22 C 25 18, 20 18, 15 22 Z' fill='%235d5952'/%3E%3C/svg%3E");
      }
      .type-b {
        width: 50px;
        height: 20px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'%3E%3Cpath d='M0 15 C 10 0, 25 0, 30 15 C 35 0, 50 0, 60 15 L 50 17 C 40 5, 30 5, 30 17 C 30 5, 20 5, 10 17 Z' fill='%23706a60'/%3E%3C/svg%3E");
      }
      .type-c {
        width: 35px;
        height: 18px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 20'%3E%3Cpath d='M5 10 C 10 2, 18 2, 20 10 C 22 2, 30 2, 35 10 L 30 12 C 25 6, 20 6, 20 12 C 20 6, 15 6, 10 12 Z' fill='%235d5952'/%3E%3C/svg%3E");
      }

      .bird-1 {
        top: 12%;
        left: -10%;
        animation-duration: 22s, 0.4s;
      }
      .bird-2 {
        top: 28%;
        left: -15%;
        animation-duration: 28s, 0.5s;
        animation-delay: 3s;
      }
      .bird-3 {
        top: 8%;
        left: -20%;
        animation-duration: 20s, 0.35s;
        animation-delay: 7s;
      }
      .bird-4 {
        top: 38%;
        left: -10%;
        animation-duration: 16s, 0.25s;
        animation-delay: 2s;
      }
      .bird-5 {
        top: 22%;
        right: -15%;
        animation-duration: 25s, 0.45s;
        animation-name: fly-reverse, flap;
      }

      @keyframes flap {
        from {
          transform: scaleY(1) rotate(0deg);
        }
        to {
          transform: scaleY(0.2) rotate(-5deg);
        }
      }

      @keyframes fly {
        from {
          left: -12%;
        }
        to {
          left: 112%;
        }
      }

      @keyframes fly-reverse {
        from {
          right: -12%;
        }
        to {
          right: 112%;
        }
      }

      /* Parallax Layers */
      .layer-5 {
        z-index: 2;
        background-size: auto 65%;
        opacity: 0.2;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 400'%3E%3Cpath d='M0 400 L 200 150 L 350 280 L 550 100 L 800 320 L 1000 200 V 400 Z' fill='%2379a08d'/%3E%3C/svg%3E");
        animation-duration: 140s;
      }

      .layer-4 {
        z-index: 3;
        opacity: 0.35;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 300'%3E%3Cpath d='M50 250 L 70 180 L 90 250 Z M 150 250 L 175 160 L 200 250 Z M 300 250 L 330 150 L 360 250 Z M 500 250 L 540 140 L 580 250 Z M 720 250 L 750 160 L 780 250 Z' fill='%235aa37d'/%3E%3C/svg%3E");
        animation-duration: 90s;
      }

      .layer-3 {
        z-index: 4;
        opacity: 0.5;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 300'%3E%3Cpath d='M100 260 L 145 110 L 190 260 Z M 400 260 L 460 100 L 520 260 Z M 750 260 L 820 110 L 890 260 Z M 250 260 Q 280 180, 310 260 Z M 600 260 Q 640 160, 680 260 Z' fill='%233e7b63'/%3E%3C/svg%3E");
        animation-duration: 60s;
      }

      .layer-2 {
        z-index: 5;
        opacity: 0.75;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 300'%3E%3Cpath d='M150 270 L 210 100 L 270 270 Z M 500 270 L 580 80 L 660 270 Z M 800 270 L 880 100 L 960 270 Z M 350 270 Q 400 150, 450 270 Z' fill='%2324473c'/%3E%3C/svg%3E");
        animation-duration: 38s;
      }

      .layer-1 {
        z-index: 6;
        opacity: 1;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 300'%3E%3Cpath d='M0 280 L 120 40 L 240 280 Z M 400 280 L 530 20 L 660 280 Z M 800 280 Q 900 120, 1000 280 Z' fill='%23172e26'/%3E%3C/svg%3E");
        animation-duration: 22s;
      }

      .error-code {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -55%);
        font-size: clamp(8rem, 20vw, 16rem);
        font-weight: 900;
        color: var(--primary-solid);
        opacity: 0.08;
        letter-spacing: -0.06em;
        user-select: none;
        z-index: 0;
      }

      .content {
        z-index: 20;
        text-align: center;
        width: 100%;
        max-width: 600px;
      }

      h1 {
        font-size: clamp(2rem, 5vw, 3.5rem);
        letter-spacing: -0.05em;
        margin: 0 0 0.75rem;
        color: var(--on-surface);
        font-weight: 800;
      }

      p {
        font-size: clamp(1rem, 2vw, 1.2rem);
        color: var(--on-surface-muted);
        margin: 0 auto 2.5rem;
        line-height: 1.6;
      }

      .btn-primary-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 1rem 2.8rem;
        border-radius: 999px;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: var(--primary-action-gradient);
        color: white;
        font-size: 1.15rem;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15);
      }

      .btn-primary-action:hover {
        transform: translateY(-3px);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.2);
        filter: brightness(1.08);
      }

      @keyframes slide {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(-50%);
        }
      }

      /* Theme Adjustments */
      :host-context(.theme-dark-forest) .parallax-forest {
        background: linear-gradient(
          to bottom,
          var(--surface-container-lowest),
          var(--surface-container-high)
        );
        box-shadow: 0 40px 100px rgba(0, 0, 0, 0.4);
      }
      :host-context(.theme-dark-forest) .bird {
        filter: brightness(1.6);
      }
      :host-context(.theme-dark-forest) .particle {
        opacity: 0.35;
      }

      @media (max-width: 640px) {
        .not-found-container {
          padding: 1rem;
        }
        .parallax-forest {
          height: 300px;
          margin-bottom: 1.5rem;
        }
        h1 {
          font-size: 2.2rem;
        }
      }
    `,
  ],
})
export class NotFoundComponent {
  protected readonly weatherType = signal<'snow' | 'rain'>(Math.random() > 0.5 ? 'snow' : 'rain');
}
