import type { MirrorWebMcpPrivacyContext } from "./runtime.js";

export interface WebMcpContextController {
  get(): MirrorWebMcpPrivacyContext;
  update(patch: Partial<MirrorWebMcpPrivacyContext>): MirrorWebMcpPrivacyContext;
  replace(next: MirrorWebMcpPrivacyContext): MirrorWebMcpPrivacyContext;
  rotateSession(prefix?: string): MirrorWebMcpPrivacyContext;
}

export function createWebMcpContext(initial: MirrorWebMcpPrivacyContext): WebMcpContextController;
