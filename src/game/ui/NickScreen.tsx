import { useState, type FormEvent } from 'react';
import { KeyRound, LogIn, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { session, useSession } from '../session';
import { ApiError } from '../net/api';
import { Button } from '../../components/ui';
import { GameLogo } from './GameLogo';

/** Tela de entrada: o jogo só começa depois de escolher um nick. */
export function NickScreen() {
  const { auth, netError } = useSession();
  const [nick, setNick] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (auth === 'loading') {
    return (
      <div className="gd-login">
        <div className="gd-login__card gd-login__card--center">
          <GameLogo />
          <p className="gd-muted">Conectando ao servidor…</p>
        </div>
      </div>
    );
  }

  if (auth === 'offline') {
    return (
      <div className="gd-login">
        <div className="gd-login__card gd-login__card--center">
          <WifiOff size={28} />
          <h2 className="gd-h2">Servidor indisponível</h2>
          <p className="gd-muted">{netError ?? 'Não foi possível falar com o servidor do jogo.'} O progresso é salvo no servidor, por isso é preciso estar online.</p>
          <Button icon={<RefreshCw />} onClick={() => void session.refresh()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await session.enter(nick, needCode ? code : undefined);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'nick_taken') setNeedCode(true);
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="gd-login">
      <form className="gd-login__card" onSubmit={submit}>
        <div className="gd-login__brand">
          <GameLogo />
          <div>
            <strong>Lab Defense</strong>
            <span>Operação Circuito</span>
          </div>
        </div>
        <h2 className="gd-h2">Escolha seu nick para começar</h2>
        <label className="gd-login__field">
          <span>Nick</span>
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            minLength={3}
            maxLength={16}
            required
            autoFocus
            autoComplete="nickname"
            spellCheck={false}
            placeholder="ex.: Engenheiro_42"
          />
          <small>3 a 16 caracteres: letras, números, espaço, ponto, hífen ou sublinhado.</small>
        </label>
        {needCode && (
          <label className="gd-login__field">
            <span>
              <KeyRound size={14} /> Código de acesso
            </span>
            <input value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" spellCheck={false} placeholder="código recebido ao criar o nick" />
            <small>Se o nick é seu, use o código mostrado quando você o criou (ou em Ajustes, no outro navegador).</small>
          </label>
        )}
        {error && <p className="gd-login__error" role="alert">{error}</p>}
        <Button variant="primary" size="lg" icon={<LogIn />} type="submit" disabled={sending || nick.trim().length < 3}>
          {sending ? 'Entrando…' : needCode ? 'Entrar com código' : 'Jogar'}
        </Button>
        <p className="gd-login__privacy">
          <ShieldCheck size={14} />
          <span>
            Ao entrar, o servidor registra o seu <strong>nick</strong> e o <strong>endereço IP</strong> da conexão, usados apenas para
            segurança, prevenção de trapaças e limite de abusos. Registros de IP são apagados após 180 dias. O progresso fica salvo no
            servidor e é validado por ele.
          </span>
        </p>
      </form>
    </div>
  );
}

/** Aviso único com o código de acesso recém-gerado. */
export function AccessCodeNotice() {
  const { accessCode, nick } = useSession();
  const [copied, setCopied] = useState(false);
  if (!accessCode) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal gd-code" role="dialog" aria-modal="true" aria-label="Código de acesso">
        <div className="panel__head">
          <h3 className="panel__title">
            <KeyRound size={16} /> Guarde seu código de acesso
          </h3>
        </div>
        <div className="gd-code__body">
          <p>
            Bem-vindo, <strong>{nick}</strong>! Para jogar com este nick em outro navegador ou dispositivo, use o código abaixo. Ele aparece{' '}
            <strong>só agora</strong> — o servidor guarda apenas uma versão criptografada (hash).
          </p>
          <code className="gd-code__value">{accessCode}</code>
          <div className="row">
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(accessCode).then(() => setCopied(true));
              }}
            >
              {copied ? 'Copiado!' : 'Copiar código'}
            </Button>
            <Button variant="primary" onClick={() => session.dismissCode()}>
              Já anotei
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
