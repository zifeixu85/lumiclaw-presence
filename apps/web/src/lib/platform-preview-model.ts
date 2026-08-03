import type {PlatformArtifact} from '@lumiclaw/domain';

export function platformPreviewModel(content: PlatformArtifact): {platform: PlatformArtifact['kind']; className: string; primaryText: string; hasLinkCard: boolean} {
  switch (content.kind) {
    case 'X': return {platform: content.kind, className: 'preview-x', primaryText: content.posts[0] ?? '', hasLinkCard: false};
    case 'BLUESKY': return {platform: content.kind, className: 'preview-bluesky', primaryText: content.posts[0] ?? '', hasLinkCard: true};
    case 'LINKEDIN': return {platform: content.kind, className: 'preview-linkedin', primaryText: content.commentary, hasLinkCard: true};
    case 'XIAOHONGSHU': return {platform: content.kind, className: 'preview-xhs', primaryText: content.body, hasLinkCard: false};
  }
}
