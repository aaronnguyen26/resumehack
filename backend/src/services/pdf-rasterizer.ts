import { createCanvas } from '@napi-rs/canvas';
import { PageVisualSnapshot } from '../types/index.js';

export class PdfRasterizerService {
  /**
   * Rasterizes a PDF binary buffer or Uint8Array into an array of PageVisualSnapshot objects.
   * Each snapshot contains pageNumber, width, height, and dataUrl ('data:image/png;base64,...').
   */
  public async rasterize(
    pdfBuffer: Buffer | Uint8Array,
    scale: number = 1.5
  ): Promise<{ snapshots: PageVisualSnapshot[]; pageCount: number }> {
    try {
      // Dynamically import pdfjs-dist legacy build for Node.js
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true,
        disableFontFace: false,
      });

      const doc = await loadingTask.promise;
      const snapshots: PageVisualSnapshot[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
        const context = canvas.getContext('2d');

        await (page as any).render({
          canvas: canvas as any,
          canvasContext: context as any,
          viewport,
        }).promise;

        const pngBuffer = canvas.toBuffer('image/png');
        const base64 = pngBuffer.toString('base64');
        snapshots.push({
          pageNumber: i,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
          dataUrl: `data:image/png;base64,${base64}`,
        });
      }

      return { snapshots, pageCount: doc.numPages };
    } catch (err: any) {
      console.error('[PdfRasterizerService] Error rasterizing PDF:', err);
      throw new Error(`Failed to rasterize document PDF: ${err.message || err}`);
    }
  }

  /**
   * Creates a synthetic placeholder snapshot for offline/test mode.
   */
  public createMockSnapshot(pageCount: number = 1): { snapshots: PageVisualSnapshot[]; pageCount: number } {
    const canvas = createCanvas(612, 792);
    const ctx = canvas.getContext('2d');

    // Draw clean page background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 612, 792);

    // Draw header simulation
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Alex Chen', 54, 70);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.fillText('alex.chen@example.com | San Francisco, CA | linkedin.com/in/alexchen', 54, 92);

    // Section line
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(54, 105);
    ctx.lineTo(558, 105);
    ctx.stroke();

    // Section Header
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('EXPERIENCE', 54, 128);

    // Bullets simulation
    ctx.fillStyle = '#334155';
    ctx.font = '10.5px sans-serif';
    ctx.fillText('• Architected distributed caching layer with Redis & Dragonfly, reducing P99 latency by 45%.', 64, 152);
    ctx.fillText('• Engineered asynchronous event pipelines in Python & FastAPI processing 50,000 req/sec.', 64, 172);

    const pngBuffer = canvas.toBuffer('image/png');
    const base64 = pngBuffer.toString('base64');

    const snapshots: PageVisualSnapshot[] = [];
    for (let i = 1; i <= pageCount; i++) {
      snapshots.push({
        pageNumber: i,
        width: 612,
        height: 792,
        dataUrl: `data:image/png;base64,${base64}`,
      });
    }

    return { snapshots, pageCount };
  }
}
