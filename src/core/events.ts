/** Minimal typed event bus used to decouple simulation from presentation (audio, fx, HUD). */
type Handler<T> = (e: T) => void;

export class EventBus<M extends { [K in keyof M]: unknown }> {
  private handlers: { [K in keyof M]?: Handler<M[K]>[] } = {};
  on<K extends keyof M>(type: K, h: Handler<M[K]>): void {
    (this.handlers[type] ??= []).push(h);
  }
  emit<K extends keyof M>(type: K, e: M[K]): void {
    const hs = this.handlers[type];
    if (!hs) return;
    for (let i = 0; i < hs.length; i++) hs[i](e);
  }
}
