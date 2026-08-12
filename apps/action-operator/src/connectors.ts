import type {ActionGrant, Platform, PlatformArtifact} from '@lumiclaw/domain';

export type ConnectorResult =
  | {ok: true; mode: 'DIRECT'; platformUri: string; platformCid: string}
  | {ok: true; mode: 'NATIVE_HANDOFF'; handoffSteps: string[]}
  | {ok: false; reason: 'UNKNOWN'; message: string};

export interface PublishConnector {
  readonly platform: Platform;
  readonly executionMode: 'DIRECT' | 'NATIVE_HANDOFF';
  /** Execute the publish action. Never throws — errors are returned as {ok: false}. */
  execute(grant: ActionGrant, artifact: PlatformArtifact): Promise<ConnectorResult>;
}

// ---------------------------------------------------------------------------
// Bluesky — Direct (mock for M3-03)
// ---------------------------------------------------------------------------

export const blueskyDirectConnector: PublishConnector = {
  platform: 'BLUESKY',
  executionMode: 'DIRECT',

  async execute(grant: ActionGrant, _artifact: PlatformArtifact): Promise<ConnectorResult> {
    const handle = 'demo-account.bsky.social';
    const rkey = `mock-${grant.id.slice(0, 8)}`;
    return {
      ok: true,
      mode: 'DIRECT',
      platformUri: `https://bsky.app/profile/${handle}/post/${rkey}`,
      platformCid: `bafyrei-mock-${grant.id.slice(0, 16)}`,
    };
  },
};

// ---------------------------------------------------------------------------
// LinkedIn — Native Handoff (mock for M3-04)
// ---------------------------------------------------------------------------

export const linkedInHandoffConnector: PublishConnector = {
  platform: 'LINKEDIN',
  executionMode: 'NATIVE_HANDOFF',

  async execute(grant: ActionGrant, artifact: PlatformArtifact): Promise<ConnectorResult> {
    if (artifact.kind !== 'LINKEDIN') {
      return {ok: false, reason: 'UNKNOWN', message: `Artifact kind ${artifact.kind} does not match LinkedIn.`};
    }
    return {
      ok: true,
      mode: 'NATIVE_HANDOFF',
      handoffSteps: [
        '1. 打开 LinkedIn 并登录您的账号',
        '2. 点击“发布动态”',
        `3. 粘贴以下内容：\n\n${artifact.commentary}`,
        artifact.linkUrl ? `4. 附上链接：${artifact.linkUrl}` : '',
        '5. 确认发布后，将发布后的 URL 粘贴回 LumiClaw 以完成对账',
      ].filter(Boolean),
    };
  },
};

// ---------------------------------------------------------------------------
// Xiaohongshu — Native Handoff (mock for M3-05)
// ---------------------------------------------------------------------------

export const xiaohongshuHandoffConnector: PublishConnector = {
  platform: 'XIAOHONGSHU',
  executionMode: 'NATIVE_HANDOFF',

  async execute(grant: ActionGrant, artifact: PlatformArtifact): Promise<ConnectorResult> {
    if (artifact.kind !== 'XIAOHONGSHU') {
      return {ok: false, reason: 'UNKNOWN', message: `Artifact kind ${artifact.kind} does not match Xiaohongshu.`};
    }
    return {
      ok: true,
      mode: 'NATIVE_HANDOFF',
      handoffSteps: [
        '1. 打开小红书 App',
        '2. 点击“+”创建新笔记',
        `3. 标题：${artifact.title}`,
        `4. 正文：${artifact.body}`,
        artifact.topics.length > 0 ? `5. 话题标签：${artifact.topics.join('、')}` : '',
        '6. 发布后，将笔记链接粘贴回 LumiClaw 以完成对账',
      ].filter(Boolean),
    };
  },
};

/** Lookup table for selecting a connector by platform. */
export const connectorByPlatform: Record<
  Platform,
  PublishConnector | undefined
> = {
  BLUESKY: blueskyDirectConnector,
  LINKEDIN: linkedInHandoffConnector,
  XIAOHONGSHU: xiaohongshuHandoffConnector,
  X: undefined, // M3-06 X Canary deferred
};
