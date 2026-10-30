import { it, expect } from 'vitest';
import { classifyGenerationConfirmationMessages } from '../../src/utils/generationConfirmation';

it('recognizes the platform acceptance promise after a historical confirmation card', (): void => {
  const card='视频生成参数确认 时长：5秒 比例：9:16 回复确认后开始生成视频';
  const receipt='本次使用 Seedance 2.0 Fast 生成，预计等待 10 分钟。视频生成好后，我会主动发送给你。';
  expect(classifyGenerationConfirmationMessages([card,'确认',receipt]).state).toBe('absent');
  expect(classifyGenerationConfirmationMessages([`${card} 确认 ${receipt}`]).state).toBe('absent');
  expect(classifyGenerationConfirmationMessages([receipt,card]).state).toBe('present');
  expect(classifyGenerationConfirmationMessages([card,'确认']).state).toBe('present');
});
