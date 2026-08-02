import { Component, computed, input } from '@angular/core';
import { markUp } from '../core/highlight';

/**
 * Authority text with the operative terms pulled forward: the prohibition in the prohibited
 * colour, the weights and heights the rule turns on in the ink. Nothing is reworded — the
 * marks sit on the authority's own sentence, which stays readable end to end.
 */
@Component({
  selector: 'dz-marked-text',
  template: `@for (mark of marks(); track $index) {
    @switch (mark.kind) {
      @case ('prohibition') {
        <mark class="prohibition">{{ mark.text }}</mark>
      }
      @case ('measure') {
        <mark class="measure">{{ mark.text }}</mark>
      }
      @default {
        <span>{{ mark.text }}</span>
      }
    }
  }`,
  styles: `
    mark {
      background: none;
      font-weight: 600;
    }
    .prohibition {
      color: var(--prohibited);
      text-transform: uppercase;
      font-size: 0.92em;
      letter-spacing: 0.03em;
    }
    .measure {
      color: var(--ink);
      font-variant-numeric: tabular-nums;
      box-shadow: inset 0 -0.4em 0 color-mix(in srgb, var(--conditional) 22%, transparent);
    }
  `,
})
export class MarkedTextComponent {
  readonly text = input.required<string>();
  protected readonly marks = computed(() => markUp(this.text()));
}
