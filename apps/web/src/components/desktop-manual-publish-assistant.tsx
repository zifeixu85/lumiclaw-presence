import type {ActivationEvidenceCopy, ManualPublishEvidenceItem, SafetyBlockEvidence} from './activation-evidence-fixture';

export function DesktopManualPublishAssistant({
  locale,
  copy,
  items,
  blocks
}: {
  locale: 'zh-CN' | 'en';
  copy: ActivationEvidenceCopy;
  items: readonly ManualPublishEvidenceItem[];
  blocks: readonly SafetyBlockEvidence[];
}) {
  return (
    <main className="manual-publish-evidence" data-current-path="MANUAL_DESKTOP_ASSISTANT" aria-labelledby="manual-publish-title">
      <header className="manual-publish-header">
        <p className="manual-publish-eyebrow">{copy.eyebrow}</p>
        <h1 id="manual-publish-title">{copy.title}</h1>
        <p>{copy.summary}</p>
        <p className="manual-publish-safety" role="status">{copy.safety}</p>
      </header>

      <section aria-labelledby="platform-publish-list">
        <h2 id="platform-publish-list">{copy.platformList}</h2>
        <div className="manual-publish-grid">
          {items.map((item) => (
            <details className="manual-publish-card" data-platform={item.platformCode} key={item.platformCode} open={item.platformCode === 'X'}>
              <summary>
                <span>{item.platformLabel}</span>
                <strong>{copy.goPublish}</strong>
              </summary>
              <dl>
                <div><dt>{copy.expectedAccount}</dt><dd>{item.expectedAccount}</dd></div>
                <div><dt>{copy.exactRevision}</dt><dd><code>{item.revisionDigest}</code></dd></div>
                <div><dt>{copy.currentState}</dt><dd>{stateLabel(item.state, copy)}</dd></div>
              </dl>
              <ol className="manual-action-list" aria-label={copy.actionList}>
                <li><span>01</span><div><strong>{copy.actions.copyText}</strong><small>{copy.actions.copyTextNote}</small></div></li>
                <li><span>02</span><div><strong>{copy.actions.copyMedia}</strong><small>{copy.actions.copyMediaNote.replace('{count}', String(item.mediaCount))}</small></div></li>
                <li><span>03</span><div><strong>{copy.actions.openPage}</strong><small>{copy.actions.openPageNote}</small></div></li>
                <li><span>04</span><div><strong>{copy.actions.manualComplete}</strong><small>{copy.actions.manualCompleteNote}</small></div></li>
              </ol>
              <p className="manual-publish-limit"><strong>{copy.manualLimit}</strong> {item.limitation[locale]}</p>
              <p className="manual-publish-awaiting">{item.state === 'UNKNOWN_RECONCILIATION_REQUIRED' ? copy.unknown : copy.awaiting}</p>
            </details>
          ))}
        </div>
      </section>

      <aside className="manual-safety-examples" aria-labelledby="blocked-examples">
        <h2 id="blocked-examples">{copy.blockedExamples}</h2>
        <ul>{blocks.map((block) => <li key={block.code}><span>{block.label[locale]}</span><code>{block.code}</code></li>)}</ul>
      </aside>

      <details className="manual-technical-details">
        <summary>{copy.technicalDetails}</summary>
        <p><code>MANUAL_DESKTOP_ASSISTANT</code> · <code>externalActionAllowed=false</code> · <code>navigationPerformed=false</code></p>
        <p>{copy.plannedReconciliation}</p>
      </details>
      <footer>{copy.fixtureNote}</footer>
    </main>
  );
}

function stateLabel(state: ManualPublishEvidenceItem['state'], copy: ActivationEvidenceCopy): string {
  switch (state) {
    case 'USER_ACTION_REQUIRED': return copy.states.userAction;
    case 'HANDOFF_OPENED': return copy.states.opened;
    case 'AWAITING_RECONCILIATION': return copy.states.awaiting;
    case 'UNKNOWN_RECONCILIATION_REQUIRED': return copy.states.unknown;
    case 'PLANNED_CANDIDATE': return copy.states.planned;
  }
}
