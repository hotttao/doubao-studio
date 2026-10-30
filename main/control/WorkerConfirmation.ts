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
    // 使用页面权威发送按钮，Enter 事件并不证明 composer 已发送。
    const button = await target.executeJavaScript(`(async () => {
      for (let i=0; i<12; i++) {
        const b = document.querySelector('#flow-end-msg-send');
        if (b && b.offsetParent !== null && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.getAttribute('data-disabled') !== 'true') {
          const r = b.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return { x: r.left+r.width/2, y: r.top+r.height/2 };
        }
        await new Promise(resolve => setTimeout(resolve,250));
      }
      return null;
    })()`) as {x: number; y: number} | null;
    if (!button || !Number.isFinite(button.x) || !Number.isFinite(button.y)) throw new Error('CONFIRMATION_SEND_CONTROL_UNAVAILABLE');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: button.x, y: button.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: button.x, y: button.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: button.x, y: button.y, button: 'left', buttons: 0, clickCount: 1 });
    const consumed = await target.executeJavaScript(`(async () => {
      for (let i=0; i<12; i++) {
        const e=document.querySelector('.tiptap.ProseMirror,[contenteditable="true"]');
        if (e && !(e.innerText || '').trim()) return true;
        await new Promise(resolve => setTimeout(resolve,250));
      }
      return false;
    })()`);
    if (consumed !== true) throw new Error('CONFIRMATION_SEND_UNCONFIRMED');

  } finally { if (attachedHere && target.debugger.isAttached()) target.debugger.detach(); }
}
