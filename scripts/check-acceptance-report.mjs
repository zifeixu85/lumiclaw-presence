import {readFile} from 'node:fs/promises';
import path from 'node:path';

const requiredHeadings = [
  '## 一、交付结果',
  '## 二、交付范围',
  '## 三、实现证据',
  '## 四、自动化验证',
  '## 五、验收标准结果',
  '## 六、Owner 参与验收',
  '## 七、ChatGPT Pro 双代理记录',
  '## 八、失败、限制与非声明',
  '## 九、回滚与恢复',
  '## 十、执行任务状态交接',
  '## 十一、Coordinator 验收决定'
];

export function checkAcceptanceReport(markdown, criteriaCount = 18) {
  const missingHeadings = requiredHeadings.filter((heading) => !markdown.includes(heading));
  const missingCriteria = Array.from({length: criteriaCount}, (_, index) => `AC-${String(index + 1).padStart(2, '0')}`)
    .filter((criterion) => !markdown.includes(`| ${criterion} |`));
  const requiredTerms = ['Worktree', 'Rollback', 'PENDING', 'ChatGPT Pro', 'SHA-256', 'Known limitations'];
  const missingTerms = requiredTerms.filter((term) => !markdown.includes(term));
  return {missingHeadings, missingCriteria, missingTerms};
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  if (process.argv[2] === undefined) {
    console.error('Usage: node scripts/check-acceptance-report.mjs <report.md>');
    process.exit(2);
  }

  const target = path.resolve(process.argv[2]);
  const criteriaCount = Number.parseInt(process.argv[3] ?? '18', 10);
  if (!Number.isInteger(criteriaCount) || criteriaCount < 1) throw new Error('Acceptance criteria count must be a positive integer.');
  const result = checkAcceptanceReport(await readFile(target, 'utf8'), criteriaCount);
  if (Object.values(result).some((items) => items.length > 0)) {
    console.error(JSON.stringify({code: 'ACCEPTANCE_REPORT_INCOMPLETE', ...result}, null, 2));
    process.exit(1);
  }
  console.info(JSON.stringify({status: 'PASS', report: path.relative(process.cwd(), target), criteria: criteriaCount}));
}
