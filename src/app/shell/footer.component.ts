import { Component, computed, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { ZonesService } from '../core/zones.service';

/**
 * Provenance and the disclaimer. This used to sit under the header, where on a phone it grew to
 * 178px of ribbon and pushed the results off the bottom of the screen. Attribution belongs at
 * the end of the page; the staleness and error banners stay at the top, because those are
 * warnings rather than credits.
 */
@Component({
  selector: 'dz-footer',
  template: `
    <footer>
      @for (entry of published(); track entry.id) {
        <a
          class="source"
          [href]="entry.sourceUrl"
          target="_blank"
          rel="noopener"
          [attr.aria-label]="entry.name + ' — ' + i18n.t('source.official')"
        >
          <img class="flag" [src]="'flags/' + entry.id + '.svg'" alt="" width="18" height="12" />
          <!-- The authority and its licence: Opendata BY and CC-BY style terms require the
               source to be named, and the whole line is the link to its publication. -->
          <span class="who">{{ entry.attribution }}</span>
          <span class="when data">{{ i18n.formatDate(entry.publishedAt) }}</span>
          <span class="out" aria-hidden="true">↗</span>
        </a>
      }
      <span class="disclaimer">{{ i18n.t('disclaimer') }}</span>
    </footer>
  `,
  styles: `
    footer {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.15rem 1.1rem;
      padding: 0.4rem 1.1rem 0.45rem;
      border-top: 1px solid var(--rule);
      background: var(--paper-2);
      font-size: 0.7rem;
      color: var(--ink-3);
      overflow-wrap: anywhere;
    }
    .source {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--ink-2);
      text-decoration: none;
    }
    .source:hover .who,
    .source:focus-visible .who {
      text-decoration: underline;
    }
    .when {
      color: var(--ink-3);
      white-space: nowrap;
    }
    .when::before {
      content: '·';
      margin-right: 0.35rem;
    }
    .out {
      color: var(--ink-3);
    }
    .flag {
      display: block;
      width: 0.95rem;
      height: auto;
      box-shadow: 0 0 0 1px var(--rule);
    }
    .disclaimer {
      margin-left: auto;
    }
    @media (max-width: 720px) {
      footer {
        padding: 0.35rem 0.8rem 0.4rem;
        gap: 0.2rem 0.7rem;
      }
      .disclaimer {
        margin-left: 0;
        flex: 1 1 100%;
      }
      /* A phone has no room for three authority names; the flag identifies the source and the
         link still reaches the publication. */
      .who,
      .out {
        display: none;
      }
      .when::before {
        content: none;
      }
    }
  `,
})
export class FooterComponent {
  protected readonly i18n = inject(I18nService);
  private readonly zones = inject(ZonesService);

  protected readonly published = computed(() => {
    const metas = this.zones.metas();
    return this.zones
      .activeIds()
      .filter((id) => metas[id])
      .map((id) => {
        const manifest = this.zones.manifest(id);
        return {
          id,
          name: manifest ? this.i18n.pick(manifest.names) : id,
          attribution: manifest?.attribution ?? id,
          publishedAt: metas[id].publishedAt,
          sourceUrl: metas[id].sourceUrl,
        };
      });
  });
}
