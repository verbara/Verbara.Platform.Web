// Compile-time check of the SDK's published types: `tsc -b` compiles this file, and it compiles neither `src/webchat`
// nor any test on their own. A site compiled with TypeScript `strict` signs in, signs out and says nothing with these.
import type { WebChatApi } from '@/webchat/sdk/api';

export function initIdentityTokenStates(api: WebChatApi): void {
  api.init({ tenantId: 't-demo-0001', identityToken: 'a.b.c' });
  api.init({ tenantId: 't-demo-0001', identityToken: null });
  api.init({ tenantId: 't-demo-0001' });
  // @ts-expect-error A token is a string, or null to sign out.
  api.init({ tenantId: 't-demo-0001', identityToken: 42 });
}

export function setVisitorIdentityTokenStates(api: WebChatApi): void {
  api.setVisitor({ identityToken: 'a.b.c' });
  api.setVisitor({ identityToken: null });
  api.setVisitor({ name: 'Ana' });
  // @ts-expect-error A token is a string, or null to sign out.
  api.setVisitor({ identityToken: 42 });
}
