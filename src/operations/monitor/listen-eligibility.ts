/** Listen is offered only on a live voice call: channel `Voice`, state active or on hold. */
export function canListenTo(channel: string, state: string): boolean {
  return channel.toLowerCase() === 'voice' && (state === 'active' || state === 'on_hold');
}
