import { useState } from 'react';
import { HelpCircle, Lock, Zap } from 'lucide-react';
import { DIFFICULTIES, DIFFICULTY_ORDER, MODIFIERS, type ModifierId } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { SYNERGIES } from '../data/synergies';
import { GLOSSARY } from '../data/knowledge';
import { STAGE_BY_ID } from '../data/stages';
import { CLASS_LABEL, DAMAGE_LABEL, RARITIES, UNITS, UNIT_ORDER } from '../data/units';
import { useSession } from '../session';
import type { DamageType, EnemyId } from '../types';
import { EnemyIcon, UnitIcon } from './common';
import { TechInfo } from './UnitPanel';
import { Callout, Formula, Segmented, Tex } from '../../components/ui';

type Tab = 'unidades' | 'inimigos' | 'modificadores' | 'sinergias' | 'glossario' | 'formulas';

const ENEMY_ORDER = Object.keys(ENEMIES) as EnemyId[];

function resistText(r: Partial<Record<DamageType, number>>): string {
  const parts = (Object.entries(r) as [DamageType, number][]).map(([k, v]) => `${DAMAGE_LABEL[k]} ×${v.toLocaleString('pt-BR')}`);
  return parts.length ? parts.join(' · ') : 'Nenhuma';
}

export function KnowledgeScreen({ initial }: { initial?: Tab }) {
  const { profile } = useSession();
  const [tab, setTab] = useState<Tab>(initial ?? 'unidades');
  const [unit, setUnit] = useState(UNIT_ORDER[0]);
  const isOpen = (stage: string | null) => stage === null || !!profile.stages[stage]?.cleared;
  const openTerms = GLOSSARY.filter((g) => isOpen(g.unlock)).length;

  return (
    <div className="gd-page">
      <div className="gd-pagehead">
        <div>
          <div className="gd-kicker">Base técnica</div>
          <h1 className="gd-h1">Informações técnicas</h1>
          <p className="gd-text">Conteúdo de apoio ligado ao EMLab. Fenômenos reais e adaptações lúdicas são indicados separadamente.</p>
        </div>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          ariaLabel="Seção"
          options={[
            { id: 'unidades', label: 'Componentes' },
            { id: 'inimigos', label: 'Falhas' },
            { id: 'modificadores', label: 'Dificuldades' },
            { id: 'sinergias', label: 'Sinergias' },
            { id: 'glossario', label: `Glossário (${openTerms}/${GLOSSARY.length})` },
            { id: 'formulas', label: 'Fórmulas' },
          ]}
        />
      </div>

      {tab === 'unidades' && (
        <div className="gd-units">
          <div className="gd-unitlist">
            {UNIT_ORDER.map((id) => {
              const hide = !!UNITS[id].secret && !profile.units.includes(id);
              return (
                <button key={id} type="button" className={`gd-unititem${unit === id ? ' is-sel' : ''}`} onClick={() => setUnit(id)}>
                  {hide ? (
                    <span className="gd-secreticon">
                      <HelpCircle size={20} />
                    </span>
                  ) : (
                    <UnitIcon id={id} size={38} />
                  )}
                  <div>
                    <strong>{hide ? '???' : UNITS[id].name}</strong>
                    <span className="gd-muted">
                      <span style={{ color: RARITIES[UNITS[id].rarity].color }}>{RARITIES[UNITS[id].rarity].name}</span>
                      {hide ? '' : ` · ${UNITS[id].classes.map((c) => CLASS_LABEL[c]).join(' / ')}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="gd-card">
            {UNITS[unit].secret && !profile.units.includes(unit) ? (
              <>
                <h2 className="gd-h2">Unidade secreta</h2>
                <p className="gd-text">A ficha técnica é revelada quando a unidade é descoberta em uma Cápsula Energética do modo infinito.</p>
              </>
            ) : (
              <>
                <h2 className="gd-h2">{UNITS[unit].name}</h2>
                <TechInfo id={unit} />
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'inimigos' && (
        <div className="gd-enemygrid">
          {ENEMY_ORDER.map((id) => {
            const e = ENEMIES[id];
            return (
              <div key={id} className={`gd-card gd-enemycard${e.boss ? ' is-boss' : ''}`}>
                <div className="gd-enemycard__head">
                  <EnemyIcon id={id} size={46} />
                  <div>
                    <strong>{e.name}</strong>
                    <span className="gd-muted">{e.traits.join(' · ')}</span>
                  </div>
                </div>
                <p className="gd-text">{e.tech}</p>
                <dl className="gd-kv gd-kv--tight">
                  <div>
                    <dt>Vida base</dt>
                    <dd>{e.hp}</dd>
                  </div>
                  <div>
                    <dt>Velocidade</dt>
                    <dd>{e.speed}</dd>
                  </div>
                  <div>
                    <dt>Blindagem</dt>
                    <dd>{e.armor || '—'}</dd>
                  </div>
                  <div>
                    <dt>Multiplicadores de dano</dt>
                    <dd>{resistText(e.resist)}</dd>
                  </div>
                  <div>
                    <dt>Recompensa / vidas</dt>
                    <dd>
                      {e.reward} / {e.leak >= 99 ? 'todas' : e.leak}
                    </dd>
                  </div>
                </dl>
                {e.weakTo && (
                  <p className="gd-note">
                    Fraquezas específicas:{' '}
                    {Object.entries(e.weakTo)
                      .map(([u, m]) => `${UNITS[u as keyof typeof UNITS].short} ×${String(m).replace('.', ',')}`)
                      .join(' · ')}
                  </p>
                )}
                <p className="gd-counter">Resposta: {e.counter}</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'modificadores' && (
        <div className="gd-formulas">
          <Callout kind="info" title="Como as dificuldades funcionam">
            Normal, Difícil e Impossível têm 12, 15 e 25 ondas. Vida e velocidade de todos os inimigos (inclusive chefes e inimigos gerados
            durante a partida) são multiplicadas sobre os valores-base: +15%, +25% e +45%. Difícil e Impossível somam escoltas de elite e
            modificadores — cada um com uma resposta possível.
          </Callout>
          <div className="gd-diffgrid">
            {DIFFICULTY_ORDER.map((d) => (
              <div key={d} className="gd-card" style={{ borderTop: `3px solid ${DIFFICULTIES[d].color}` }}>
                <strong>{DIFFICULTIES[d].name}</strong>
                <p className="gd-text">{DIFFICULTIES[d].desc}</p>
                <span className="gd-muted">Recompensa da 1ª vitória: ×{String(DIFFICULTIES[d].reward).replace('.', ',')}</span>
              </div>
            ))}
          </div>
          <div className="gd-modgrid">
            {(Object.keys(MODIFIERS) as ModifierId[]).map((m) => {
              const def = MODIFIERS[m];
              return (
                <div key={m} className="gd-card gd-modcard" style={{ borderLeft: `3px solid ${def.color}` }}>
                  <strong style={{ color: def.color }}>
                    <Zap size={13} /> {def.name}
                  </strong>
                  <span className="gd-muted">{def.level === 'dificil' ? 'Difícil' : 'Impossível'}</span>
                  <p className="gd-text">{def.desc}</p>
                  <p className="gd-note">Base técnica: {def.tech}</p>
                  <p className="gd-counter">Contrajogo: {def.counter}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'sinergias' && (
        <div className="gd-modgrid">
          {SYNERGIES.map((x) => (
            <div key={x.id} className="gd-card gd-modcard">
              <strong>{x.name}</strong>
              <div className="gd-synunits">
                {[...new Set([...x.source, ...x.target])].slice(0, 6).map((u) => (
                  <UnitIcon key={u} id={u} size={28} />
                ))}
              </div>
              <p className="gd-text">{x.effect}</p>
              <p className="gd-note">Base técnica: {x.why}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'glossario' && (
        <div className="gd-glossary">
          {GLOSSARY.map((g) => {
            const open = isOpen(g.unlock);
            return (
              <div key={g.id} className={`gd-card gd-term${open ? '' : ' is-locked'}`}>
                <strong>{open ? g.term : '???'}</strong>
                {open ? (
                  <>
                    <p className="gd-text">{g.text}</p>
                    {g.tex && (
                      <div className="gd-term__tex">
                        <Tex display>{g.tex}</Tex>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="gd-muted">
                    <Lock size={13} /> Conclua a fase {g.unlock} ({STAGE_BY_ID[g.unlock!]?.name}) para desbloquear.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'formulas' && (
        <div className="gd-formulas">
          <Callout kind="info" title="Fenômeno físico × mecânica de jogo">
            As relações abaixo são usadas de forma fiel nas mecânicas indicadas (formas das curvas, dependência de L, R, C e V). As
            grandezas do jogo estão em escala própria: os números do mapa não são volts, ampères ou segundos de um circuito real.
          </Callout>
          <Formula
            tex="v_L = L\,\dfrac{di}{dt}"
            label="Tensão no indutor (convenção passiva)"
            vars={[
              ['v_L', 'tensão no indutor (V)'],
              ['L', 'indutância (H)'],
              ['di/dt', 'taxa de variação da corrente (A/s)'],
            ]}
          >
            <p className="gd-note">No jogo: o dano do Indutor não muda instantaneamente; cresce com a corrente.</p>
          </Formula>
          <Formula
            tex="i(t) = \dfrac{V}{R}\left(1 - e^{-t/\tau}\right), \quad \tau = \dfrac{L}{R}"
            label="Circuito RL série ligado a uma fonte DC (modelo ideal de 1ª ordem)"
            vars={[
              ['V/R', 'corrente de regime permanente (A)'],
              ['\\tau', 'constante de tempo (s); após ≈5τ a corrente está a ≈99,3% do final'],
            ]}
          >
            <p className="gd-note">No jogo: rampa do Indutor e dano progressivo do Circuito RL (τ = L/R e dano ∝ V/R).</p>
          </Formula>
          <Formula
            tex="E = \tfrac{1}{2} L I^2"
            label="Energia armazenada no campo magnético do indutor"
            vars={[
              ['E', 'energia (J)'],
              ['I', 'corrente (A)'],
            ]}
          >
            <p className="gd-note">No jogo: a liberação ao interromper a corrente do Indutor é proporcional a (I/Imax)².</p>
          </Formula>
          <Formula
            tex="v(t) = V\left(1 - e^{-t/RC}\right), \qquad E = \tfrac{1}{2} C V^2"
            label="Carga do capacitor e energia no campo elétrico"
            vars={[
              ['C', 'capacitância (F)'],
              ['RC', 'constante de tempo da carga (s)'],
            ]}
          >
            <p className="gd-note">No jogo: o Capacitor recarrega pela curva RC e dispara quando a energia (∝ v²) passa de 80%.</p>
          </Formula>
          <Formula
            tex="B = \dfrac{\mu N I}{l}"
            label="Campo no interior de um solenoide longo (aproximação)"
            vars={[
              ['\\mu', 'permeabilidade do núcleo (H/m)'],
              ['N', 'número de espiras'],
              ['l', 'comprimento (m)'],
            ]}
          >
            <p className="gd-note">Válida longe das extremidades, para solenoide longo e sem saturação do núcleo.</p>
          </Formula>
          <Formula tex="\varepsilon = -N\,\dfrac{d\Phi_B}{dt}" label="Lei de Faraday (o sinal negativo expressa a lei de Lenz)" />
          <Formula tex="X_L = 2\pi f L" label="Reatância indutiva em regime senoidal" />
          <Formula tex="\dfrac{V_2}{V_1} = \dfrac{N_2}{N_1}" label="Transformador ideal (requer fluxo variável)" />
        </div>
      )}
    </div>
  );
}
