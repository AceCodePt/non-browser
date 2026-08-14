import { measureTextWidth } from '../dist/layout/measure.js';
import { skiaCanvasFactory } from '../dist/canvas/skia.js';
import { setActiveBrowserConfig } from '../dist/config/browser-config.js';
import { installPretextMeasurement } from '../dist/pretext/index.js';
import { initMeasurement } from '../dist/layout/measure.js';

setActiveBrowserConfig({
  browser: 'chrome',
  fonts: [{ family: 'Noto Sans', filePath: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf' }],
  fallback: {},
  defaultFamily: 'Noto Sans',
  defaultFile: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf',
});
const canvas = initMeasurement({ family: 'Noto Sans', filePath: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf' }, skiaCanvasFactory);
installPretextMeasurement(canvas);
for (const t of ['A', 'B', 'C', 'BBBB', 'CCCCCCCCCC', 'Header', 'Cell one', 'long', 'longer', 'text', 'here', 'longer text here longer text here', 'Alfa', 'Beta', 'Gamma', 'longer text here', 'more words here too', 'stray block', 'more', 'words', 'too', 'block']) {
  console.log(JSON.stringify(t), measureTextWidth(t, 16, 'Noto Sans'));
}
