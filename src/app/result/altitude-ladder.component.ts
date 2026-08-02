import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import type { ZoneMatch } from '../core/geo/query';

const W = 336;
const H = 186;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const AXIS_X = 40;
const COL_GAP = 8;

interface Band {
  id: string;
  x: number;
  width: number;
  y: number;
  height: number;
  fill: string;
  label: string;
  /** Set when the zone's ceiling is above the top of the scale, or absent altogether. */
  clippedLabel: string | null;
  upper: number | null;
  lower: number;
}

/**
 * The vertical profile at the queried point, drawn the way a chart states vertical limits:
 * upper figure over lower figure. Overlapping zones sit side by side so a stack of limits
 * stays readable, and any height with no band over it is airspace the pilot is free in.
 */
@Component({
  selector: 'dz-altitude-ladder',
  template: `
    <figure>
      <figcaption class="compartment-label">{{ i18n.t('ladder.title') }}</figcaption>
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        role="img"
        [attr.aria-label]="ariaLabel()"
        preserveAspectRatio="xMidYMid meet"
      >
        @for (tick of ticks(); track tick.value) {
          <line
            [attr.x1]="AXIS_X"
            [attr.x2]="W - 4"
            [attr.y1]="tick.y"
            [attr.y2]="tick.y"
            class="grid"
            [class.ground]="tick.value === 0"
          />
          <text [attr.x]="AXIS_X - 6" [attr.y]="tick.y + 3.5" class="tick data">
            {{ tick.label }}
          </text>
        }

        @for (band of bands(); track band.id) {
          <rect
            [attr.x]="band.x"
            [attr.y]="band.y"
            [attr.width]="band.width"
            [attr.height]="band.height"
            [attr.fill]="band.fill"
            fill-opacity="0.22"
            [attr.stroke]="band.fill"
            stroke-width="1.5"
          />
          <text
            [attr.x]="band.x + band.width / 2"
            [attr.y]="H - PAD_BOTTOM + 13"
            class="col-label data"
          >
            {{ band.label }}
          </text>
          @if (band.clippedLabel) {
            <text
              [attr.x]="band.x + band.width / 2"
              [attr.y]="band.y - 4"
              class="clipped data"
              [attr.fill]="band.fill"
            >
              {{ band.clippedLabel }}
            </text>
          }
        }

        <line
          [attr.x1]="AXIS_X"
          [attr.x2]="W - 4"
          [attr.y1]="flightY()"
          [attr.y2]="flightY()"
          class="flight"
        />
        <text [attr.x]="W - 4" [attr.y]="flightY() - 5" class="flight-label data">
          {{ i18n.t('ladder.you') }} {{ heightM() }}
        </text>
      </svg>
    </figure>
  `,
  styles: `
    figure {
      margin: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      margin-top: 0.35rem;
    }
    .grid {
      stroke: var(--rule);
      stroke-width: 1;
      stroke-dasharray: 2 3;
    }
    .grid.ground {
      stroke: var(--ink);
      stroke-width: 1.5;
      stroke-dasharray: none;
    }
    .tick {
      fill: var(--ink-3);
      font-size: 9px;
      text-anchor: end;
    }
    .col-label {
      fill: var(--ink-2);
      font-size: 10px;
      font-weight: 600;
      text-anchor: middle;
    }
    .clipped {
      font-size: 8.5px;
      font-weight: 600;
      text-anchor: middle;
    }
    .flight {
      stroke: var(--ink);
      stroke-width: 1.5;
      stroke-dasharray: 6 3;
    }
    .flight-label {
      fill: var(--ink);
      font-size: 9px;
      font-weight: 600;
      text-anchor: end;
    }
  `,
})
export class AltitudeLadderComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly W = W;
  protected readonly H = H;
  protected readonly AXIS_X = AXIS_X;
  protected readonly PAD_BOTTOM = PAD_BOTTOM;

  readonly matches = input<ZoneMatch[]>([]);
  readonly heightM = input(120);

  /**
   * A single 3500 m military zone would flatten every 120 m band to a sliver, so the scale
   * stays near the heights a pilot actually flies and taller bands are clipped and labelled
   * with their real ceiling.
   */
  private readonly top = computed(() => {
    // An unbounded ceiling must not drive the scale — it has no height to scale to.
    const ceilings = this.matches()
      .map((m) => m.zone.altitude.upper)
      .filter((u): u is number => u !== null);
    const relevant = Math.max(150, this.heightM() + 20);
    return Math.min(Math.max(relevant, ...ceilings), Math.max(relevant, 300));
  });

  private y(value: number): number {
    const usable = H - PAD_TOP - PAD_BOTTOM;
    const clamped = Math.min(value, this.top());
    return H - PAD_BOTTOM - (clamped / this.top()) * usable;
  }

  protected readonly ticks = computed(() => {
    const top = this.top();
    const values = new Set<number>([0, top]);
    for (const m of this.matches()) {
      for (const v of [m.zone.altitude.lower, m.zone.altitude.upper]) {
        if (v !== null && v <= top) values.add(v);
      }
    }
    const sorted = [...values].sort((a, b) => a - b);
    // Drop labels that would collide; the ground line and the top of scale always stay.
    const kept: number[] = [];
    for (const value of sorted) {
      const last = kept[kept.length - 1];
      const collides = last !== undefined && Math.abs(this.y(value) - this.y(last)) < 11;
      if (collides && value !== top) continue;
      if (collides && value === top) kept.pop();
      kept.push(value);
    }
    return kept.map((value) => ({
      value,
      y: this.y(value),
      label: value === 0 ? this.i18n.t('strip.ground') : String(value),
    }));
  });

  protected readonly bands = computed<Band[]>(() => {
    const matches = this.matches();
    if (matches.length === 0) return [];
    const available = W - AXIS_X - 12;
    const width = Math.min(40, available / matches.length - COL_GAP);
    return matches.map((m, i) => {
      const { lower, upper } = m.zone.altitude;
      // A zone with no ceiling is drawn to the top of the scale and labelled as open-ended,
      // which is the same treatment as a clipped band because that is what it is.
      const yTop = this.y(upper ?? this.top());
      return {
        id: m.zone.id,
        x: AXIS_X + 10 + i * (width + COL_GAP),
        width,
        y: yTop,
        height: Math.max(2, this.y(lower) - yTop),
        fill: `var(--${FILL[m.zone.restriction]})`,
        // Bands carry the strip's rank, so a stack of limits maps onto the list below it.
        label: String(i + 1),
        clippedLabel:
          upper === null
            ? `↑${this.i18n.t('strip.noCeiling')}`
            : upper > this.top()
              ? `↑${upper}`
              : null,
        lower,
        upper,
      };
    });
  });

  protected readonly flightY = computed(() => this.y(this.heightM()));

  protected readonly ariaLabel = computed(() =>
    this.matches().length === 0
      ? this.i18n.t('ladder.free')
      : this.matches()
          .map(
            (m) =>
              `${m.zone.name}: ${m.zone.altitude.lower}–${
                m.zone.altitude.upper ?? this.i18n.t('strip.noCeiling')
              } m`,
          )
          .join('; '),
  );
}

const FILL = {
  PROHIBITED: 'prohibited',
  REQ_AUTHORISATION: 'authorisation',
  CONDITIONAL: 'conditional',
} as const;
