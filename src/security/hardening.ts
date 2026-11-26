/**
 * Endurecimento do lado do navegador (defesa em profundidade). Nada disto substitui a
 * validação no servidor — que é o que realmente impede trapaças —, mas tira os atalhos
 * mais fáceis: editar o estado do React pela extensão DevTools e golpes de "cole este
 * código no console".
 *
 * Importado ANTES do React em cada ponto de entrada.
 */
if (import.meta.env.PROD && typeof window !== 'undefined') {
  // 1) Desliga a integração do React DevTools (o React verifica `isDisabled` ao iniciar)
  const w = window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown> };
  const hook = w.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && typeof hook === 'object') {
    try {
      hook.isDisabled = true;
      for (const k of Object.keys(hook)) if (typeof hook[k] === 'function') hook[k] = () => undefined;
    } catch {
      /* extensão pode congelar o objeto */
    }
  } else {
    try {
      Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: { isDisabled: true }, configurable: false, writable: false });
    } catch {
      /* ignora */
    }
  }

  // 2) Aviso contra golpes de auto-XSS no console
  const c = (globalThis as unknown as Record<string, Console>)['con' + 'sole'];
  c?.log(
    '%cPARE!%c\nEste console é para desenvolvedores. Se alguém pediu para você colar algo aqui para "ganhar EC" ou "liberar unidades", é golpe.\nO progresso é calculado e verificado pelo servidor: códigos colados aqui não dão vantagem e podem roubar sua conta.',
    'color:#ff5f5f;font-size:28px;font-weight:800',
    'color:#e4ebf3;font-size:14px',
  );
}
export {};
