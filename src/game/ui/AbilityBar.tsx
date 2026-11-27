import { Sparkles } from 'lucide-react';
import type { GameEngine, UnitInst } from '../engine/GameEngine';
import { UnitIcon } from './common';

/**
 * §8 — Barra de habilidades, no canto inferior esquerdo.
 *
 * Acessibilidade inspirada no Bloons TD 6: cada habilidade tem ícone, nome, descrição,
 * indicador de recarga com o tempo restante e estado disponível/indisponível. Clicar ativa;
 * as teclas 1–9 (com Alt, para não colidir com a seleção de unidades) também ativam. Durante
 * a recarga, uma máscara circular cobre o ícone e o botão fica desabilitado, então não há
 * ativação inválida. Quando fica pronta, o ícone pulsa.
 *
 * A barra é compacta e fica fora da área do mapa; em telas pequenas ela rola na horizontal
 * em vez de cobrir a pista ou os controles.
 */
export function AbilityBar({ eng, onFocus }: { eng: GameEngine; onFocus: (uid: number) => void }) {
  const comHabilidade = eng.units.filter((u) => u.def.ability && u.stats.ability);
  if (!comHabilidade.length) return null;
  return (
    <div className="gd-abar" role="toolbar" aria-label="Habilidades disponíveis">
      {comHabilidade.map((u, i) => (
        <AbilityButton key={u.uid} eng={eng} u={u} index={i} onFocus={() => onFocus(u.uid)} />
      ))}
    </div>
  );
}

function AbilityButton({ eng, u, index, onFocus }: { eng: GameEngine; u: UnitInst; index: number; onFocus: () => void }) {
  const ab = u.def.ability!;
  const block = eng.abilityBlock(u);
  const pronta = !block;
  const ativa = eng.time < u.abilityUntil;
  const frac = ab.cooldown > 0 ? Math.max(0, Math.min(1, u.abilityCd / ab.cooldown)) : 0;
  const restante = Math.ceil(u.abilityCd);

  return (
    <div className={`gd-ab${pronta ? ' is-ready' : ''}${ativa ? ' is-active' : ''}`}>
      <button
        type="button"
        className="gd-ab__btn"
        disabled={!pronta}
        onClick={() => eng.useAbility(u.uid)}
        onContextMenu={(e) => {
          e.preventDefault();
          onFocus();
        }}
        aria-label={`${ab.name} — ${u.def.short}${pronta ? ' (pronta)' : ` (${block})`}`}
        title={`${ab.name} (${u.def.short})\n${ab.desc}\n${pronta ? 'Pronta — Alt+' + (index + 1) : block}`}
      >
        <UnitIcon id={u.def.id} tier={u.entry.tier} size={34} />
        {/* máscara de recarga: setor que diminui conforme a habilidade volta */}
        {frac > 0 && (
          <span
            className="gd-ab__mask"
            aria-hidden="true"
            style={{ ['--frac' as string]: String(frac) }}
          />
        )}
        {frac > 0 && <span className="gd-ab__t mono">{restante}</span>}
        {pronta && (
          <span className="gd-ab__spark" aria-hidden="true">
            <Sparkles size={11} />
          </span>
        )}
        {index < 9 && <span className="gd-ab__key">{index + 1}</span>}
      </button>
      <span className="gd-ab__name">{ab.name}</span>
    </div>
  );
}
