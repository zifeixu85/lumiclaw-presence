'use client';

import {useId, useState} from 'react';
import type {ActionCenterCopy} from './action-center-copy';
import {
  actionCenterActionAvailability,
  assertActionCenterModel,
  policyForActionCenterState
} from './action-center-policy';
import type {
  ActionCenterIntent,
  ActionCenterViewModel,
  ActionTimelineEvent
} from './action-center-types';

export type ActionCenterProps = {
  model: ActionCenterViewModel;
  copy: ActionCenterCopy;
  onIntent?: (intent: ActionCenterIntent) => void;
};

export function ActionCenter({model, copy, onIntent}: ActionCenterProps) {
  assertActionCenterModel(model);
  const titleId = useId();
  const confirmationId = useId();
  const disabledReasonId = useId();
  const scopeKey = `${model.state}:${model.review.revisionDigest}`;
  const [confirmedScopeKey, setConfirmedScopeKey] = useState<string>();
  const exactScopeConfirmed = confirmedScopeKey === scopeKey;
  const policy = policyForActionCenterState(model.state);
  const stateCopy = copy.states[model.state];
  const availability = actionCenterActionAvailability(model, {
    hasIntentHandler: onIntent !== undefined,
    exactScopeConfirmed
  });

  const disabledReason = availability.reason === 'UI_INTENT_HANDLER_UNAVAILABLE'
    ? copy.actionUnavailable
    : availability.reason === 'EXACT_SCOPE_CONFIRMATION_REQUIRED'
      ? copy.confirmationRequired
      : availability.reason === 'MODEL_INVARIANT_VIOLATION'
        ? copy.modelInvalid
        : undefined;

  const emitIntent = () => {
    if (!availability.available || onIntent === undefined) return;
    onIntent({
      code: policy.intent,
      state: model.state,
      revisionId: model.review.revisionId,
      revisionDigest: model.review.revisionDigest,
      ...(model.grant === undefined ? {} : {grantId: model.grant.id})
    });
  };

  return (
    <section
      className="action-center"
      data-state={model.state}
      data-tone={policy.tone}
      aria-labelledby={titleId}
    >
      <header className="action-center__boundary">
        <div>
          <p>{copy.boundary}</p>
          <h2 id={titleId}>{stateCopy.title}</h2>
          <span>{copy.subtitle}</span>
        </div>
        <div className="action-center__truth-stamp" aria-label={copy.nonClaim}>
          <strong>{model.environmentLabel}</strong>
          <span>{model.source}</span>
          <small>externalActionAllowed={String(model.externalActionAllowed)}</small>
        </div>
      </header>

      <div className="action-center__state" role="status" aria-live="polite">
        <span className="action-center__state-marker" aria-hidden="true">{stateMarker(model.state)}</span>
        <div>
          <small>{copy.stateCodeLabel}</small>
          <code>{model.state}</code>
          <p>{stateCopy.explanation}</p>
        </div>
        <dl>
          <div><dt>{copy.modeLabel}</dt><dd>{copy.modes[model.mode]}</dd></div>
          <div><dt>{copy.maturityLabel}</dt><dd>{model.claimMaturity} · UI FOUNDATION</dd></div>
          <div><dt>{copy.retryLabel}</dt><dd>{policy.retryAllowed ? copy.retryAllowed : copy.retryDenied}</dd></div>
        </dl>
      </div>

      <section className="action-center__next" aria-labelledby={`${titleId}-next`}>
        <span aria-hidden="true">01</span>
        <div>
          <small id={`${titleId}-next`}>{copy.nextStepLabel}</small>
          <strong>{stateCopy.next}</strong>
        </div>
      </section>

      <div className="action-center__evidence-grid">
        <EvidenceCard index="02" title={copy.sections.exactReview} className="action-center__review">
          <dl className="action-center__facts">
            <Fact label={copy.fields.revision} value={`v${model.review.revisionVersion} · ${model.review.revisionId}`} code />
            <Fact label={copy.fields.revisionDigest} value={model.review.revisionDigest} code />
            <Fact label={copy.fields.account} value={model.review.accountLabel} />
            <Fact label={copy.fields.accountId} value={model.review.accountId} code />
            <Fact label={copy.fields.intendedAction} value={model.review.intendedAction} />
            <Fact label={copy.fields.auditEvidence} value={model.review.auditEvidenceCode} code />
            <Fact label={copy.fields.ownerDecision} value={model.review.ownerDecisionCode} code />
            <Fact label={copy.fields.reviewedAt} value={formatTimestamp(model.review.reviewedAt, model.uiLocale, model.execution.scheduleTimeZone)} />
            <Fact label={copy.fields.authorizationExpiresAt} value={formatTimestamp(model.review.authorizationExpiresAt, model.uiLocale, model.execution.scheduleTimeZone)} />
          </dl>
        </EvidenceCard>

        <EvidenceCard index="03" title={copy.sections.grant} className="action-center__grant">
          {model.grant === undefined
            ? <p className="action-center__empty-evidence"><span aria-hidden="true">∅</span>{copy.noGrant}</p>
            : <dl className="action-center__facts">
                <Fact label={copy.fields.grantId} value={model.grant.id} code />
                <Fact label={copy.fields.grantDigest} value={model.grant.digest} code />
                <Fact label={copy.fields.grantStatus} value={model.grant.status} code />
                <Fact label={copy.fields.issuedAt} value={formatTimestamp(model.grant.issuedAt, model.uiLocale, model.execution.scheduleTimeZone)} />
                <Fact label={copy.fields.expiresAt} value={formatTimestamp(model.grant.expiresAt, model.uiLocale, model.execution.scheduleTimeZone)} />
                {model.grant.revocationReasonCode === undefined ? null : <Fact label={copy.fields.revocationReason} value={model.grant.revocationReasonCode} code />}
              </dl>}
        </EvidenceCard>
      </div>

      <ExecutionCard model={model} copy={copy} />
      <ReceiptTimeline events={model.timeline} model={model} copy={copy} />

      {model.state === 'UNKNOWN' && model.reconciliation !== undefined
        ? <section className="action-center__reconciliation" aria-labelledby={`${titleId}-reconciliation`}>
            <header>
              <span aria-hidden="true">!</span>
              <div>
                <small>06 · RECONCILIATION ONLY</small>
                <h3 id={`${titleId}-reconciliation`}>{copy.sections.reconciliation}</h3>
              </div>
            </header>
            <p className="action-center__unknown-fixed">{copy.unknownFixed}</p>
            <p>{copy.blindRetryBlocked}</p>
            <dl className="action-center__facts">
              <Fact label={copy.fields.reason} value={model.reconciliation.reasonCode} code />
              <Fact label={copy.fields.methods} value={model.reconciliation.methods.join(' · ')} code />
            </dl>
          </section>
        : null}

      <section className="action-center__intent" aria-labelledby={`${titleId}-intent`}>
        <div>
          <small>07 · OWNER CONTROL</small>
          <h3 id={`${titleId}-intent`}>{stateCopy.next}</h3>
          <p>{copy.nonClaim}</p>
        </div>
        <div className="action-center__intent-controls">
          {policy.requiresExactScopeConfirmation
            ? <label className="action-center__confirmation" htmlFor={confirmationId}>
                <input
                  id={confirmationId}
                  type="checkbox"
                  checked={exactScopeConfirmed}
                  onChange={(event) => setConfirmedScopeKey(event.target.checked ? scopeKey : undefined)}
                />
                <span>{copy.confirmation}</span>
              </label>
            : null}
          <button
            className={policy.dangerous ? 'action-center__button is-dangerous' : 'action-center__button'}
            type="button"
            disabled={!availability.available}
            aria-describedby={disabledReason === undefined ? undefined : disabledReasonId}
            onClick={emitIntent}
          >
            {copy.actions[policy.intent]}
          </button>
          {disabledReason === undefined ? null : <small id={disabledReasonId}>{disabledReason}</small>}
        </div>
      </section>
    </section>
  );
}

function EvidenceCard({index, title, className, children}: {index: string; title: string; className: string; children: React.ReactNode}) {
  return <section className={`action-center__card ${className}`}>
    <header><span>{index}</span><h3>{title}</h3></header>
    {children}
  </section>;
}

function ExecutionCard({model, copy}: {model: ActionCenterViewModel; copy: ActionCenterCopy}) {
  const titleId = useId();
  return <section className="action-center__execution" aria-labelledby={titleId}>
    <header>
      <div><span>04</span><h3 id={titleId}>{copy.sections.execution}</h3></div>
      <strong>{copy.modes[model.mode]}</strong>
    </header>
    <dl className="action-center__execution-facts">
      <Fact label={copy.fields.platform} value={model.execution.platform} code />
      <Fact label={copy.fields.action} value={model.execution.actionLabel} code />
      <Fact label={copy.fields.uiLocale} value={model.uiLocale} code />
      <Fact label={copy.fields.contentLanguage} value={model.execution.contentLanguage} code />
      <Fact label={copy.fields.targetMarket} value={model.execution.targetMarket} code />
      <Fact label={copy.fields.scheduleTimeZone} value={model.execution.scheduleTimeZone} code />
    </dl>
    {model.execution.handoffSteps === undefined ? null : <div className="action-center__handoff">
      <h4>{copy.sections.handoff}</h4>
      <ol>{model.execution.handoffSteps.map((step) => <li key={step}><code>{step}</code></li>)}</ol>
      {model.nativeEvidence === undefined ? <p>{copy.noNativeEvidence}</p> : null}
    </div>}
  </section>;
}

function ReceiptTimeline({events, model, copy}: {events: ActionTimelineEvent[]; model: ActionCenterViewModel; copy: ActionCenterCopy}) {
  const titleId = useId();
  return <section className="action-center__timeline" aria-labelledby={titleId}>
    <header><span>05</span><h3 id={titleId}>{copy.sections.timeline}</h3></header>
    {events.length === 0
      ? <p>{copy.timelineEmpty}</p>
      : <ol>{events.map((event, index) => <li key={event.id}>
          <span className="action-center__timeline-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <strong>{copy.timelineKinds[event.kind]}</strong>
            <time dateTime={event.occurredAt}>{formatTimestamp(event.occurredAt, model.uiLocale, model.execution.scheduleTimeZone)}</time>
          </div>
          <code>{event.evidenceCode}</code>
        </li>)}</ol>}
    {model.nativeEvidence === undefined ? null : <dl className="action-center__native-evidence">
      <Fact label={copy.fields.receiptId} value={model.nativeEvidence.receiptId} code />
      <Fact label={copy.fields.nativeReference} value={model.nativeEvidence.publicReference} code />
      <Fact label={copy.fields.evidenceKind} value={copy.evidenceKinds[model.nativeEvidence.evidenceKind]} />
    </dl>}
  </section>;
}

function Fact({label, value, code = false}: {label: string; value: string; code?: boolean}) {
  return <div><dt>{label}</dt><dd>{code ? <code>{value}</code> : value}</dd></div>;
}

function formatTimestamp(value: string, locale: ActionCenterViewModel['uiLocale'], timeZone: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone
    }).format(date);
  } catch {
    return value;
  }
}

function stateMarker(state: ActionCenterViewModel['state']): string {
  switch (state) {
    case 'GRANT_READY': return 'R';
    case 'GRANT_ISSUED': return 'G';
    case 'OWNER_ACTION_REQUIRED': return 'O';
    case 'PUBLISHED': return '✓';
    case 'UNKNOWN': return '?';
    case 'FAILED': return '×';
    case 'EXPIRED': return '⌛';
    case 'REVOKED': return '—';
  }
}
