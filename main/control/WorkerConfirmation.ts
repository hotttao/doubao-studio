import type { WebContents } from 'electron';
export type ConfirmationTarget = Pick<WebContents, 'debugger' | 'executeJavaScript' | 'getURL'>;
// 单次、精确会话的可信确认；任何焦点/输入回读不确定都保持原持久意图，禁止重发。
export async function dispatchWorkerConfirmation(
  target: ConfirmationTarget, expectedUrl: string, position: { x: number; y: number }, claim: () => boolean,
): Promise<void> {
  if (target.getURL() !== expectedUrl) throw new Error('CONVERSATION_CHANGED');
  if (!claim()) return;
  const attachedHere = !target.debugger.isAttached();
  try {
    if (attachedHere) target.debugger.attach('1.3');
    const send = async (method: string, params: Record<string, unknown>): Promise<void> => {
      if (target.getURL() !== expectedUrl) throw new Error('CONVERSATION_CHANGED');
      await target.debugger.sendCommand(method, params);
    };
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: position.x, y: position.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: position.x, y: position.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: position.x, y: position.y, button: 'left', buttons: 0, clickCount: 1 });
    const focused = await target.executeJavaScript(`(() => { const e = document.querySelector('.tiptap.ProseMirror,[contenteditable="true"]'); return !!e && (e === document.activeElement || e.contains(document.activeElement)) && !(e.innerText || '').trim(); })()`);
    if (focused !== true) throw new Error('CONFIRMATION_EDITOR_NOT_FOCUSED');
    await send('Input.insertText', { text: '确认' });
    const readback = await target.executeJavaScript(`(() => { const e = document.querySelector('.tiptap.ProseMirror,[contenteditable="true"]'); return (e?.innerText || '').trim() === '确认'; })()`);
    if (readback !== true) throw new Error('CONFIRMATION_INPUT_UNCONFIRMED');
    // Chromium composer listens for native keydown, not a synthesized keyDown.
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  } finally { if (attachedHere && target.debugger.isAttached()) target.debugger.detach(); }
}
