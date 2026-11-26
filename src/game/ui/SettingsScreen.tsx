import { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck, Trash2, UserRound, Volume2 } from 'lucide-react';
import { playSfx } from '../audio/sfx';
import { session, useSession } from '../session';
import { Modal } from './common';
import { Button, Toggle } from '../../components/ui';

export function SettingsScreen() {
  const { profile, nick } = useSession();
  const st = profile.settings;
  const [confirm, setConfirm] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);
  return (
    <div className="gd-page">
      <div className="gd-pagehead">
        <div>
          <div className="gd-kicker">Ajustes</div>
          <h1 className="gd-h1">Configurações do jogo</h1>
        </div>
      </div>
      <div className="gd-settings">
        <section className="gd-card">
          <h3 className="gd-h3">Áudio e visual</h3>
          <Toggle checked={st.sound} onChange={(v) => session.updateSettings({ sound: v })} label="Efeitos sonoros" />
          <label className="gd-range">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={st.volume}
              disabled={!st.sound}
              onChange={(e) => session.updateSettings({ volume: Number(e.target.value) })}
            />
            <span className="mono">{Math.round(st.volume * 100)}%</span>
          </label>
          <Button size="sm" variant="ghost" icon={<Volume2 />} disabled={!st.sound} onClick={() => playSfx('upgrade')}>
            Testar som
          </Button>
          <Toggle checked={st.showDamage} onChange={(v) => session.updateSettings({ showDamage: v })} label="Mostrar números de dano (próximas partidas)" />
          <Toggle checked={st.autoStart} onChange={(v) => session.updateSettings({ autoStart: v })} label="Iniciar ondas automaticamente (próximas partidas)" />
        </section>
        <section className="gd-card">
          <h3 className="gd-h3">
            <UserRound size={16} /> Conta
          </h3>
          <p className="gd-text">
            Você está jogando como <strong>{nick}</strong>. O progresso fica salvo no servidor e cada partida é verificada por ele
            (re-simulação dos seus comandos) antes de gerar recompensas.
          </p>
          <div className="row">
            <Button icon={<KeyRound />} onClick={() => setConfirmCode(true)}>
              Gerar novo código de acesso
            </Button>
            <Button variant="ghost" icon={<LogOut />} onClick={() => void session.logout()}>
              Sair deste navegador
            </Button>
          </div>
          <p className="gd-text gd-muted">
            <ShieldCheck size={13} /> Para voltar a este nick depois de sair (ou em outro dispositivo) é preciso o código de acesso. O
            servidor registra nick e endereço IP para segurança e prevenção de trapaças; registros de IP são apagados após 180 dias.
          </p>
          <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirm(true)}>
            Apagar todo o progresso
          </Button>
        </section>
      </div>
      {confirmCode && (
        <Modal
          title="Gerar novo código de acesso?"
          onClose={() => setConfirmCode(false)}
          actions={
            <>
              <Button onClick={() => setConfirmCode(false)}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmCode(false);
                  void session.rotateCode();
                }}
              >
                Gerar código
              </Button>
            </>
          }
        >
          <p>O código antigo deixa de funcionar e outros navegadores conectados com este nick serão desconectados.</p>
        </Modal>
      )}
      {confirm && (
        <Modal
          title="Apagar todo o progresso?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button onClick={() => setConfirm(false)}>Cancelar</Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirm(false);
                  session.resetProgress();
                }}
              >
                Apagar definitivamente
              </Button>
            </>
          }
        >
          <p>Fases, estrelas, evoluções, características, conquistas e estatísticas serão perdidos. Esta ação não pode ser desfeita.</p>
        </Modal>
      )}
    </div>
  );
}
