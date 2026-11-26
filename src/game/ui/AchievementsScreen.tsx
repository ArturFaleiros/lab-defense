import { Award, Lock } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { useSession } from '../session';

export function AchievementsScreen() {
  const { profile } = useSession();
  const got = ACHIEVEMENTS.filter((a) => profile.achievements[a.id]).length;
  return (
    <div className="gd-page">
      <div className="gd-pagehead">
        <div>
          <div className="gd-kicker">Conquistas</div>
          <h1 className="gd-h1">
            {got}/{ACHIEVEMENTS.length} obtidas
          </h1>
          <p className="gd-text">Objetivos opcionais. Cada conquista concede Energia concatenada (EC) uma única vez.</p>
        </div>
      </div>
      <div className="gd-achs">
        {ACHIEVEMENTS.map((a) => {
          const at = profile.achievements[a.id];
          return (
            <div key={a.id} className={`gd-ach${at ? ' is-got' : ''}`}>
              {at ? <Award size={26} /> : <Lock size={22} />}
              <div>
                <strong>{a.name}</strong>
                <span>{a.desc}</span>
                <span className="gd-muted">
                  +{a.ec} EC{at ? ` · obtida em ${new Date(at).toLocaleDateString('pt-BR')}` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
