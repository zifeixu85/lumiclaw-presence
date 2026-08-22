// @vitest-environment jsdom
import axe from 'axe-core';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {NextIntlClientProvider} from 'next-intl';
import {createElement, useState, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import messages from '../../messages/en.json';
import type * as ProductionApi from '@/lib/production-api';
import type {SkillListResponse, TeamResponse, WorkspaceSnapshot} from '@/lib/production-types';
import {Drawer} from './ui/dialog';
import {OnboardingFlow} from './onboarding/onboarding-flow';
import {ProductionWorkspace} from './production-workspace';

const productionApiMocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  loadReadiness: vi.fn(),
  loadTeam: vi.fn(),
  loadSkills: vi.fn()
}));

vi.mock('@/lib/production-api', async () => ({
  ...await vi.importActual<typeof ProductionApi>('@/lib/production-api'),
  ...productionApiMocks
}));
vi.mock('@/i18n/navigation', () => ({Link: () => null, redirect: vi.fn(), usePathname: () => '/en', useRouter: () => ({push: vi.fn(), replace: vi.fn()}), getPathname: () => '/en'}));
vi.mock('next/navigation', () => ({usePathname: () => '/en', useRouter: () => ({push: vi.fn(), replace: vi.fn()}), useSearchParams: () => new URLSearchParams()}));

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {configurable: true, value: () => null});

const firstOpen: WorkspaceSnapshot = {code: 'LOCAL_FIRST_OPEN', profile: null, session: null, materials: [], handoffs: [], campaign: null, publishAuthorization: {state: 'BLOCKED', reasonCode: 'MANUAL_PUBLISH_AUDIT_OWNER_DECISION_REQUIRED', auditState: 'MISSING', ownerDecisionState: 'MISSING', requiredAuthorities: ['INDEPENDENT_AUDIT_PASS', 'EXACT_EXTERNAL_ACTION_OWNER_DECISION'], remediationCodes: ['SDD_007_REQUIRED', 'CONNECTOR_SDD_REQUIRED'], reviewExportAllowed: true, externalActionAllowed: false, handoffCreationAllowed: false}};
const initializedOnboarding: WorkspaceSnapshot = {...firstOpen, code: 'LOCAL_WORKSPACE_REOPENED', profile: {schemaVersion: 1, id: '018f0000-0000-7000-8000-000000000001', displayName: 'Local Owner', state: 'PROFILE_READY', createdAt: '2026-08-22T00:00:00.000Z', updatedAt: '2026-08-22T00:00:00.000Z'}};
const approvedWithoutCampaign = {...initializedOnboarding, knowledge: {session: {ownerId: initializedOnboarding.profile!.id, state: 'KNOWLEDGE_APPROVED_NEEDS_GOAL', currentStep: 'REVIEW', rowVersion: 8, targetMarket: 'US', contentLocale: 'en-US', timeZone: 'America/Los_Angeles', currentSnapshotId: 'snapshot-approved', currentSnapshotDigest: 'a'.repeat(64), updatedAt: '2026-08-22T00:00:00.000Z'}, sources: [], profiles: {persona: null, organization: null, product: null, accounts: {}}, draft: null, approvedHistory: []}} as WorkspaceSnapshot;
const unapprovedWithoutCampaign = {...approvedWithoutCampaign, knowledge: {...approvedWithoutCampaign.knowledge!, session: {...approvedWithoutCampaign.knowledge!.session, state: 'READY_FOR_APPROVAL'}}} as WorkspaceSnapshot;
const sixMemberTeam: TeamResponse = {code: 'RUNTIME_TEAM_PROJECTION', metricSource: 'POSTGRESQL_RUNTIME_OBSERVATION', readiness: 'UNREACHABLE', reasonCode: 'MISSION_WORKER_HEARTBEAT_MISSING', agents: Array.from({length: 6}, (_, index) => ({code: `A${index}` as `A${0 | 1 | 2 | 3 | 4 | 5}`, roleId: ['presence-mission-leader', 'evidence-claim-steward', 'campaign-planner', 'founder-identity-producer', 'product-account-producer', 'independent-auditor'][index]!, name: `Role ${index}`, responsibility: `Responsibility ${index}`, skillIds: [], status: 'NOT_CONFIGURED', metrics: {tokens: null, tokenSource: 'NO_RUNTIME_OBSERVATION', dailyCompleted: 0, completionSource: 'POSTGRESQL_RUNTIME_OBSERVATION'}}))};
const emptySkills: SkillListResponse = {code: 'REPOSITORY_SKILL_LIST', source: 'REPOSITORY_OWNED', skills: []};
const availableReadiness = {code: 'ENVIRONMENT_READINESS', secretCollectionAllowed: false as const, items: []};
const noop = async () => {};
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function Provider({children}: {children: ReactNode}) {
  const providerProps = {locale: 'en' as const, messages, children};
  return createElement(NextIntlClientProvider, providerProps);
}

describe('Production UX accessibility contracts', () => {
  it('does not request the protected live team projection before a local profile exists', async () => {
    productionApiMocks.loadWorkspace.mockResolvedValue(firstOpen);
    productionApiMocks.loadReadiness.mockResolvedValue({code: 'ENVIRONMENT_READINESS', secretCollectionAllowed: false, items: []});
    productionApiMocks.loadSkills.mockResolvedValue({code: 'SKILL_LIST', source: 'REPOSITORY_OWNED', skills: []});
    productionApiMocks.loadTeam.mockRejectedValue(new Error('LOCAL_PROFILE_REQUIRED'));

    render(createElement(Provider, null, createElement(ProductionWorkspace, {locale: 'en'})));

    await waitFor(() => expect(screen.getByLabelText('Local display name')).toBeInstanceOf(HTMLInputElement));
    expect(productionApiMocks.loadWorkspace).toHaveBeenCalledTimes(1);
    expect(productionApiMocks.loadReadiness).toHaveBeenCalledTimes(1);
    expect(productionApiMocks.loadSkills).toHaveBeenCalledTimes(1);
    expect(productionApiMocks.loadTeam).not.toHaveBeenCalled();
    expect(screen.queryByText('LOCAL_PROFILE_REQUIRED')).toBeNull();
  });

  it('still loads the protected team authority after the local profile exists', async () => {
    productionApiMocks.loadWorkspace.mockResolvedValue(initializedOnboarding);
    productionApiMocks.loadReadiness.mockResolvedValue({code: 'ENVIRONMENT_READINESS', secretCollectionAllowed: false, items: []});
    productionApiMocks.loadSkills.mockResolvedValue({code: 'SKILL_LIST', source: 'REPOSITORY_OWNED', skills: []});
    productionApiMocks.loadTeam.mockResolvedValue({code: 'AI_TEAM_ROSTER', metricSource: 'NO_RUNTIME_OBSERVATION', agents: []});

    render(createElement(Provider, null, createElement(ProductionWorkspace, {locale: 'en'})));

    await waitFor(() => expect(productionApiMocks.loadTeam).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('TEAM_AUTHORITY_UNREACHABLE')).toBeNull();
  });

  it('fails closed when the initialized workspace team authority is unavailable', async () => {
    productionApiMocks.loadWorkspace.mockResolvedValue(initializedOnboarding);
    productionApiMocks.loadReadiness.mockResolvedValue({code: 'ENVIRONMENT_READINESS', secretCollectionAllowed: false, items: []});
    productionApiMocks.loadSkills.mockResolvedValue({code: 'SKILL_LIST', source: 'REPOSITORY_OWNED', skills: []});
    productionApiMocks.loadTeam.mockRejectedValue(new Error('TEAM_AUTHORITY_UNREACHABLE'));

    render(createElement(Provider, null, createElement(ProductionWorkspace, {locale: 'en'})));

    await waitFor(() => expect(screen.getByText('TEAM_AUTHORITY_UNREACHABLE')).toBeTruthy());
    expect(productionApiMocks.loadTeam).toHaveBeenCalledTimes(1);
  });

  it('renders the real AI Team route after knowledge approval even when no legacy campaign exists', () => {
    render(createElement(Provider, null, createElement(ProductionWorkspace, {locale: 'en', initialSection: 'ai-team', initialSnapshot: approvedWithoutCampaign, initialReadiness: availableReadiness, initialTeam: sixMemberTeam, initialSkills: emptySkills})));

    expect(screen.getByRole('heading', {name: 'AI Team'})).toBeTruthy();
    expect(screen.getByText('Runtime unreachable')).toBeTruthy();
    expect(screen.queryByText('Runtime ready')).toBeNull();
    for (let index = 0; index < 6; index += 1) expect(screen.getByText(new RegExp(`^A${index} ·`, 'u'))).toBeTruthy();
  });

  it('does not expose AI Team before knowledge approval', () => {
    render(createElement(Provider, null, createElement(ProductionWorkspace, {locale: 'en', initialSection: 'ai-team', initialSnapshot: unapprovedWithoutCampaign, initialReadiness: availableReadiness, initialTeam: sixMemberTeam, initialSkills: emptySkills})));

    expect(screen.queryByRole('heading', {name: 'AI Team'})).toBeNull();
    expect(screen.queryByText(/^A0 ·/u)).toBeNull();
  });

  it('fails closed on the approved AI Team route when team authority cannot load', async () => {
    productionApiMocks.loadWorkspace.mockResolvedValue(approvedWithoutCampaign);
    productionApiMocks.loadReadiness.mockResolvedValue(availableReadiness);
    productionApiMocks.loadSkills.mockResolvedValue(emptySkills);
    productionApiMocks.loadTeam.mockRejectedValue(new Error('TEAM_AUTHORITY_UNREACHABLE'));

    render(createElement(Provider, null, createElement(ProductionWorkspace, {locale: 'en', initialSection: 'ai-team'})));

    await waitFor(() => expect(screen.getByText('TEAM_AUTHORITY_UNREACHABLE')).toBeTruthy());
    expect(screen.queryByRole('heading', {name: 'AI Team'})).toBeNull();
    expect(screen.queryByText(/^A0 ·/u)).toBeNull();
  });

  it('asks only for a local display name and has no browser secret or remote identity field', async () => {
    const flow = createElement(OnboardingFlow, {locale: 'en', snapshot: firstOpen, busy: false, error: null, onStartExample: noop, onStartLocal: noop, onSelectLocal: noop, onMoveStep: noop, onSaveProfile: noop, onSaveOrganizationProduct: noop, onSaveAccount: noop, onUpload: noop, onAddText: noop, onDeleteSource: noop, onConfirmLegacy: noop, onSaveContext: noop, onResolve: noop, onApprove: noop});
    const {container} = render(createElement(Provider, null, flow));
    expect(screen.getByLabelText('Local display name')).toBeInstanceOf(HTMLInputElement);
    expect(screen.queryByLabelText(/email/iu)).toBeNull();
    expect(screen.queryByLabelText(/password/iu)).toBeNull();
    expect(screen.queryByLabelText(/api key/iu)).toBeNull();
    expect((screen.getByRole('button', {name: 'Continue'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Explore public-safe example'}) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Local display name'), 'Local Owner');
    expect((screen.getByRole('button', {name: 'Continue'}) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', {name: 'Explore public-safe example'}) as HTMLButtonElement).disabled).toBe(false);
    const result = await axe.run(container);
    expect(result.violations).toEqual([]);
  });

  it('traps keyboard focus in a modal drawer, closes on Escape, and restores the opener', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      const drawerProps = {open, onOpenChange: setOpen, title: 'Full content', description: 'Review exact revision', children: createElement('div', null, createElement('button', null, 'First drawer action'), createElement('button', null, 'Second drawer action'))};
      return createElement('div', null,
        createElement('button', {onClick: () => setOpen(true)}, createElement('span', null, 'Open review')),
        createElement(Drawer, drawerProps)
      );
    }
    render(createElement(Harness));
    const opener = screen.getByRole('button', {name: 'Open review'});
    await user.click(opener);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await user.tab(); await user.tab(); await user.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
