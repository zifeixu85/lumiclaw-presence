import enMessages from '../../messages/en.json';
import zhMessages from '../../messages/zh-CN.json';

export type ManualPublishVisibleState = 'USER_ACTION_REQUIRED' | 'HANDOFF_OPENED' | 'AWAITING_RECONCILIATION' | 'UNKNOWN_RECONCILIATION_REQUIRED' | 'PLANNED_CANDIDATE';

export type ManualPublishEvidenceItem = {
  platformCode: 'X' | 'BLUESKY' | 'LINKEDIN' | 'XIAOHONGSHU' | 'INSTAGRAM' | 'THREADS';
  platformLabel: string;
  expectedAccount: string;
  revisionDigest: string;
  mediaCount: number;
  state: ManualPublishVisibleState;
  limitation: {readonly 'zh-CN': string; readonly en: string};
};

export type SafetyBlockEvidence = {
  code: 'CAPABILITY_EXPIRED' | 'ACCOUNT_MISMATCH' | 'CAPABILITY_ID_MISMATCH';
  label: {readonly 'zh-CN': string; readonly en: string};
};

export type ActivationEvidenceCopy = typeof zhMessages.ActivationEvidence;

export const manualPublishEvidenceItems: readonly ManualPublishEvidenceItem[] = [
  {platformCode: 'X', platformLabel: 'X', expectedAccount: '@lumiclaw-public-safe', revisionDigest: '41ad8d0f1a2b…', mediaCount: 2, state: 'USER_ACTION_REQUIRED', limitation: {'zh-CN': '正文、链接和图片都由你手工带入；网页不会预填。', en: 'You carry the copy, link, and images manually; the page is never prefilled.'}},
  {platformCode: 'BLUESKY', platformLabel: 'Bluesky', expectedAccount: '@lumiclaw-demo.bsky.social', revisionDigest: '70fa2ca904d1…', mediaCount: 2, state: 'HANDOFF_OPENED', limitation: {'zh-CN': '当前只走桌面手工助手；其他路径仍在规划。', en: 'The current desktop assistant remains manual; other paths remain planned.'}},
  {platformCode: 'LINKEDIN', platformLabel: 'LinkedIn', expectedAccount: 'LumiClaw Presence · 公司主页', revisionDigest: 'e9ec1db30cc4…', mediaCount: 1, state: 'AWAITING_RECONCILIATION', limitation: {'zh-CN': '打开官方页面但不预填正文或链接；无需额外提交发布地址。', en: 'The official page opens without copy or link prefill; no manual result address is requested.'}},
  {platformCode: 'XIAOHONGSHU', platformLabel: '小红书', expectedAccount: 'LumiClaw 公开安全演示账号', revisionDigest: 'b61d770608ef…', mediaCount: 4, state: 'UNKNOWN_RECONCILIATION_REQUIRED', limitation: {'zh-CN': '只复制正文并按顺序下载图片；状态不明时先核对，不重新发布。', en: 'Copy text and download ordered images only; reconcile an unknown result before any new action.'}},
  {platformCode: 'INSTAGRAM', platformLabel: 'Instagram', expectedAccount: '@lumiclaw-candidate', revisionDigest: '20f724378129…', mediaCount: 3, state: 'PLANNED_CANDIDATE', limitation: {'zh-CN': '候选平台：当前只展示桌面手工边界，ArtifactProfile 仍在规划。', en: 'Candidate platform: only the desktop manual boundary is shown; its ArtifactProfile remains planned.'}},
  {platformCode: 'THREADS', platformLabel: 'Threads', expectedAccount: '@lumiclaw-candidate', revisionDigest: 'f951023b4a64…', mediaCount: 2, state: 'PLANNED_CANDIDATE', limitation: {'zh-CN': '候选平台：即使 intent probe 可用，当前也不做网页预填。', en: 'Candidate platform: even when an intent probe is available, the current UI does not prefill the page.'}}
] as const;

export const safetyBlockEvidence: readonly SafetyBlockEvidence[] = [
  {code: 'CAPABILITY_EXPIRED', label: {'zh-CN': '能力快照已过期，不能生成发布包。', en: 'The capability snapshot expired, so no publish package can be created.'}},
  {code: 'ACCOUNT_MISMATCH', label: {'zh-CN': '确认账号与批准账号不一致，安全阻断。', en: 'The confirmed account differs from the approved account, so the package is blocked.'}},
  {code: 'CAPABILITY_ID_MISMATCH', label: {'zh-CN': '能力身份不匹配，必须重新获取快照。', en: 'The capability identity does not match and must be refreshed.'}}
] as const;

export function activationEvidenceCopy(locale: 'zh-CN' | 'en'): ActivationEvidenceCopy {
  return (locale === 'zh-CN' ? zhMessages : enMessages).ActivationEvidence;
}
