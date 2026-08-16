import { skiaCanvasFactory } from './dist/canvas/index.js';
import { installPretextMeasurement, prepareText, breakNextLine } from './dist/pretext/index.js';
const FONT_FILE = '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
skiaCanvasFactory.registerFont(FONT_FILE, 'Noto Sans');
const canvas = skiaCanvasFactory.create(1, 1);
installPretextMeasurement(canvas);
function lines(prepared, maxWidth, label) {
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let i = 0;
  console.log(`=== ${label} (max ${maxWidth}) ===`);
  while (true) {
    const line = breakNextLine(prepared, cursor, maxWidth);
    if (!line) break;
    console.log(`  L${i}: ${JSON.stringify(line.text)} w=${line.width.toFixed(2)}`);
    cursor = line.end;
    i++;
  }
}
// space-run hung-space union test
lines(prepareText("aaa   bbb bbb bbb", `16px 'Noto Sans'`, { whiteSpace: 'pre-wrap' }), 100, 'pre-wrap space-run');
lines(prepareText("aaa   bbb", `16px 'Noto Sans'`, { whiteSpace: 'pre-wrap' }), 100, 'pre-wrap space-run fits');
// trailing newline
lines(prepareText("line one\nline two\n", `16px 'Noto Sans'`, { whiteSpace: 'pre-wrap' }), 100, 'pre-wrap trailing newline');
// blank segment interior
lines(prepareText("one\n\ntwo", `16px 'Noto Sans'`, { whiteSpace: 'pre-wrap' }), 100, 'pre-wrap blank interior');
// normal mode leading/trailing spaces
lines(prepareText("   lead trail   ", `16px 'Noto Sans'`), 100, 'normal lead/trail');
