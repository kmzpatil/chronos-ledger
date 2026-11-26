'use client';

import React, { useEffect } from 'react';
import { useChronosStore } from '../store/useChronosStore';
import { ChronosPreloader } from './motion/ChronosPreloader';
import { ChronosCursor } from './motion/ChronosCursor';
import { PageTransitionWrapper } from './motion/PageTransitionWrapper';
import { TopEconomyBar } from './layout/TopEconomyBar';
import { SettingsDrawer } from './settings/SettingsDrawer';
import { IntentionalUnlockDrawer } from './command/IntentionalUnlockDrawer';
import { AuthDialog } from './AuthDialog';
import { AcousticToastPill } from './AcousticToastPill';

export function AppShell({ children }: { children: React.ReactNode }) {
  const initRuntime = useChronosStore((s) => s.initRuntime);

  useEffect(() => {
    const cleanup = initRuntime();
    return cleanup;
  }, [initRuntime]);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none bg-horological-grid z-0" aria-hidden="true" />
      <ChronosPreloader />
      <ChronosCursor />
      <div className="relative z-10 min-h-screen flex flex-col">
        <TopEconomyBar />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <PageTransitionWrapper>{children}</PageTransitionWrapper>
        </main>
      </div>

      <SettingsDrawer />
      <IntentionalUnlockDrawer />
      <AuthDialog />
      <AcousticToastPill />
    </>
  );
}
