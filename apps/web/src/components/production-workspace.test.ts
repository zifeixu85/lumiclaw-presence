// @vitest-environment jsdom
import axe from 'axe-core';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {NextIntlClientProvider} from 'next-intl';
import {createElement, useState, type ReactNode} from 'react';
import {afterEach, describe, expect, it} from 'vitest';
import messages from '../../messages/en.json';
import type {WorkspaceSnapshot} from '@/lib/production-types';
import {Drawer} from './ui/dialog';
import {OnboardingFlow} from './onboarding/onboarding-flow';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {configurable: true, value: () => null});

const firstOpen: WorkspaceSnapshot = {code: 'LOCAL_FIRST_OPEN', profile: null, session: null, materials: [], handoffs: [], campaign: null};
const noop = async () => {};
afterEach(cleanup);

function Provider({children}: {children: ReactNode}) {
  const providerProps = {locale: 'en' as const, messages, children};
  return createElement(NextIntlClientProvider, providerProps);
}

describe('Production UX accessibility contracts', () => {
  it('asks only for a local display name and has no browser secret or remote identity field', async () => {
    const flow = createElement(OnboardingFlow, {snapshot: firstOpen, busy: false, error: null, onCreateProfile: noop, onUseExample: noop, onSelectLocal: noop, onUpload: noop, onDelete: noop, onFinishLocal: noop});
    const {container} = render(createElement(Provider, null, flow));
    expect(screen.getByLabelText('Local display name')).toBeInstanceOf(HTMLInputElement);
    expect(screen.queryByLabelText(/email/iu)).toBeNull();
    expect(screen.queryByLabelText(/password/iu)).toBeNull();
    expect(screen.queryByLabelText(/api key/iu)).toBeNull();
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
