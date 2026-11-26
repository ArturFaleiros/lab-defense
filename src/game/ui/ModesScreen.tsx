import { useState } from 'react';
import { FlaskConical, Infinity as InfinityIcon, Lock, Play, Skull, Wrench } from 'lucide-react';
import { MAPS } from '../data/maps';
import { STAGES } from '../data/stages';
import { ENDLESS_PREFIX } from '../engine/setup';
import { endlessMaps } from '../progress/profile';
import { session, useSession } from '../session';
import type { MapId } from '../types';
import { StageDetail } from './CampaignScreen';
import { MapPreview } from './common';
import { Button } from '../../components/ui';

const EXTRA = STAGES.filter((s) => s.mode !== 'campaign');

export function ModesScreen() {
  const { profile } = useSession();
  const maps = endlessMaps(profile);
  const endlessOpen = !!profile.stages['1-3']?.cleared;
  const [map, setMap] = useState<MapId>(maps[maps.length - 1] ?? 'placa');
  const [sel, setSel] = useState<string | null>(null);
  const extra = EXTRA.find((s) => s.id === sel);

  return (
    <div className="gd-page">
      <div className="gd-pagehead">
        <div>
          <div className="gd-kicker">Modos de jogo</div>
          <h1 className="gd-h1">Infinito, chefes e desafios técnicos</h1>
        </div>
      </div>

      <div className="gd-modes">
        <section className="gd-card gd-mode">
          <h3 className="gd-h3">
            <InfinityIcon size={18} /> Modo infinito
          </h3>
          <p className="gd-text">
            Ondas procedurais cada vez mais difíceis, com um chefe a cada 10 ondas. Recompensa: 8 EC e 15 XP por onda concluída. A cada 5 ondas: 50% de chance de uma Cápsula Energética (70–140 EC ou a unidade secreta).
            Recorde atual: <strong>{profile.stats.endlessBest || '—'}</strong>
            {profile.stats.endlessBestMap ? ` (${MAPS[profile.stats.endlessBestMap].name})` : ''}.
          </p>
          {endlessOpen ? (
            <>
              <div className="gd-mapsel" role="radiogroup" aria-label="Mapa">
                {maps.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={m === map} className={m === map ? 'is-on' : ''} onClick={() => setMap(m)}>
                    <MapPreview map={m} />
                    <span>{MAPS[m].name}</span>
                  </button>
                ))}
              </div>
              <Button variant="primary" icon={<Play />} onClick={() => session.go({ id: 'loadout', stageId: `${ENDLESS_PREFIX}${map}` })}>
                Preparar equipe — {MAPS[map].name}
              </Button>
            </>
          ) : (
            <span className="gd-locked">
              <Lock size={15} /> Conclua o capítulo 1 (fase 1-3) para liberar.
            </span>
          )}
        </section>

        <section className="gd-card gd-mode">
          <h3 className="gd-h3">
            <Skull size={18} /> Chefes e desafios técnicos
          </h3>
          <div className="gd-modelist">
            {EXTRA.map((s) => {
              const open = !s.requires || !!profile.stages[s.requires]?.cleared;
              const rec = profile.stages[s.id];
              return (
                <button key={s.id} type="button" className={`gd-modeitem${sel === s.id ? ' is-sel' : ''}`} onClick={() => setSel(s.id)}>
                  {s.mode === 'boss' ? <Skull size={18} /> : <Wrench size={18} />}
                  <div>
                    <strong>{s.name}</strong>
                    <span>{s.concept}</span>
                  </div>
                  {open ? <span className="gd-muted mono">{rec?.cleared ? `${rec.stars}★` : 'novo'}</span> : <Lock size={14} />}
                </button>
              );
            })}
            <div className="gd-modeitem is-future" aria-disabled="true">
              <FlaskConical size={18} />
              <div>
                <strong>Laboratórios especiais</strong>
                <span>Conteúdo futuro: fases dedicadas a conceitos específicos (ainda não implementado).</span>
              </div>
              <span className="gd-badge-future">Em breve</span>
            </div>
          </div>
        </section>
      </div>
      {extra && (
        <div style={{ marginTop: '1rem' }}>
          <StageDetail stage={extra} />
        </div>
      )}
    </div>
  );
}
