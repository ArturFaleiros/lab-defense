import './security/hardening';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/game.css';
import './styles/overdrive.css';
import { GameShell } from './game/ui/GameShell';

/** Lab Defense: somente o tower defense, sem o restante do EMLab. */
function LabDefense() {
  return (
    <div className="ld-app">
      <GameShell brand="Lab Defense" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LabDefense />
  </StrictMode>,
);
