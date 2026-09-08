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
          [attr.aria-label]="
            entry.name +
            ' — ' +
            i18n.t('source.published', { date: i18n.formatDate(entry.publishedAt) }) +
            ' — ' +
            i18n.t('source.official')
          "
        >
          <img class="flag" [src]="'flags/' + entry.id + '.svg'" alt="" width="18" height="12" />
          <!-- The authority and its licence: Opendata BY and CC-BY style terms require the
               source to be named, and the whole line is the link to its publication. -->
          <span class="who">{{ entry.attribution }}</span>
          <span class="when data">{{ i18n.formatDate(entry.publishedAt) }}</span>
          <span class="out" aria-hidden="true">↗</span>
        </a>
      }
      <!-- AGPL-3.0 expects anyone using this over the network to be told where the source is,
           and nothing else on the page says who made it. -->
      <a class="repo" href="https://github.com/AlexMihov/avio" target="_blank" rel="noopener">
        <svg class="mark" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
        Avio by Alex Mihov
      </a>
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
    .repo {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--ink-2);
      text-decoration: none;
      white-space: nowrap;
    }
    .repo:hover,
    .repo:focus-visible {
      text-decoration: underline;
    }
    .mark {
      display: block;
      flex: none;
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
