import type {AppLocale, RouteId} from '@lumiclaw/i18n';
import {routeIds} from '@lumiclaw/i18n';
import {Link} from '@/i18n/navigation';
import type {ScreenCopy} from '@/lib/shell-copy';
import {CampaignWorkspace, type WorkspaceFixtureState} from './campaign-workspace';

export type ShellLabels = {
  brand: string;
  category: string;
  mode: string;
  milestone: string;
  localeLabel: string;
  localeSwitch: string;
  evidenceLabel: string;
  evidenceValue: string;
  journeyLabel: string;
  statusLabel: string;
  ownerLabel: string;
  technicalDetailsLabel: string;
  technicalStateLabel: string;
  technicalEvidenceLabel: string;
  footer: string;
  nav: Record<RouteId, string>;
};

export type MissionCopy = {
  rail: string;
  composer: string;
  preview: string;
  constraint: string;
  disclaimer: string;
  platforms: {id: string; label: string}[];
};

type ProductShellProps = {
  locale: AppLocale;
  routeId: RouteId;
  labels: ShellLabels;
  screen: ScreenCopy;
  mission?: MissionCopy;
  workspaceState?: WorkspaceFixtureState | undefined;
};

function hrefFor(routeId: RouteId): string {
  return routeId === 'campaigns' ? '/' : `/${routeId}`;
}

export function ProductShell({locale, routeId, labels, screen, workspaceState}: ProductShellProps) {
  const alternateLocale: AppLocale = locale === 'zh-CN' ? 'en' : 'zh-CN';
  const currentHref = hrefFor(routeId);

  return (
    <div className="product-frame">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">L</span>
          <div>
            <strong>{labels.brand}</strong>
            <span>{labels.category}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="mode-stamp" data-testid="not-live-mode">{labels.mode}</span>
          <Link className="locale-switch" href={currentHref} locale={alternateLocale}>
            <span className="sr-only">{labels.localeLabel}: </span>
            {labels.localeSwitch}
          </Link>
        </div>
      </header>

      <aside className="journey-rail" aria-label={labels.journeyLabel}>
        <div className="rail-heading">
          <span>{labels.milestone}</span>
          <small>{labels.journeyLabel}</small>
        </div>
        <nav>
          <ol>
            {routeIds.map((item, index) => (
              <li key={item}>
                <Link
                  href={hrefFor(item)}
                  aria-current={item === routeId ? 'page' : undefined}
                  data-route-id={item}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {labels.nav[item]}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        <div className="evidence-chip">
          <span>{labels.evidenceLabel}</span>
          <strong>{labels.evidenceValue}</strong>
        </div>
      </aside>

      <main className="workspace" id="main-content">
        <section className="screen-intro" aria-labelledby="screen-title">
          <p className="eyebrow">{screen.eyebrow}</p>
          <h1 id="screen-title">{screen.title}</h1>
          <p className="lede">{screen.summary}</p>
        </section>

        <section className="state-ledger" aria-label={screen.status}>
          <div>
            <span className="ledger-index">{labels.statusLabel}</span>
            <strong>{screen.status}</strong>
          </div>
          <p>{screen.basis}</p>
        </section>

        <CampaignWorkspace locale={locale} routeId={routeId} fixtureState={workspaceState} />

        <details className="technical-details">
          <summary>{labels.technicalDetailsLabel}</summary>
          <dl>
            <div>
              <dt>{labels.technicalStateLabel}</dt>
              <dd><code>{screen.technicalStatus}</code></dd>
            </div>
            <div>
              <dt>{labels.technicalEvidenceLabel}</dt>
              <dd>{screen.technicalBasis}</dd>
            </div>
          </dl>
        </details>

        <section className="owner-next" aria-labelledby="owner-next-title">
          <span aria-hidden="true">→</span>
          <div>
            <p id="owner-next-title">{labels.ownerLabel}</p>
            <strong>{screen.next}</strong>
          </div>
        </section>
      </main>

      <footer className="truth-footer">{labels.footer}</footer>
    </div>
  );
}
