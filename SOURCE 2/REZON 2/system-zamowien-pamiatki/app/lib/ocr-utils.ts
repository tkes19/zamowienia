// Utilities do analizy kolorów i preprocessing obrazów dla OCR

export interface ColorAnalysis {
  isGrayArea: boolean;
  grayPercentage: number;
  dominantHue: number;
  saturation: number;
  brightness: number;
}

export interface OCRResult {
  projectNumbers: number[];
  confidence: number;
  processingTime: number;
  grayAreasFound: number;
  originalNumbers: number[];
  outliers: number[];
  processedPreviewDataUrl?: string;
}

export interface OCRPreprocessOptions {
  blockSize?: number;
  offsetC?: number;
  alternateBlockSize?: number;
  alternateOffsetC?: number;
  targetMaxSize?: number;
  capturePreview?: boolean;
}

export interface OCRPreprocessResult {
  canvas: HTMLCanvasElement;
  previewDataUrl?: string;
}

export class OCRImageProcessor {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  private initCanvas(): void {
    if (typeof document !== 'undefined' && !this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
    }
  }

  // Udział czarnych pikseli (0) w obrazie binarnym (zakładamy R=G=B)
  private blackRatio(img: ImageData): number {
    const d = img.data;
    let black = 0;
    let total = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === 0) black++;
      total++;
    }
    return black / Math.max(1, total);
  }

  // Adaptive Mean Threshold na obrazie w skali szarości
  private adaptiveThresholdMean(src: ImageData, blockSize: number = 25, C: number = 7): ImageData {
    const { width, height, data } = src;
    const w = width, h = height;
    const gray = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        gray[y * w + x] = data[(y * w + x) * 4];
      }
    }

    // integral image do szybkiego średniego w oknie
    const integral = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) {
      let rowSum = 0;
      for (let x = 1; x <= w; x++) {
        rowSum += gray[(y - 1) * w + (x - 1)];
        integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + rowSum;
      }
    }

    const r = Math.max(1, (blockSize | 1) >> 1);
    const dst = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - r), y1 = Math.max(0, y - r);
        const x2 = Math.min(w - 1, x + r), y2 = Math.min(h - 1, y + r);
        const A = integral[y1 * (w + 1) + x1];
        const B = integral[y1 * (w + 1) + (x2 + 1)];
        const Cc = integral[(y2 + 1) * (w + 1) + x1];
        const D = integral[(y2 + 1) * (w + 1) + (x2 + 1)];
        const area = (x2 - x1 + 1) * (y2 - y1 + 1);
        const mean = (D - B - Cc + A) / area;
        const v = gray[y * w + x] > mean - C ? 255 : 0;
        const idx = (y * w + x) * 4;
        dst.data[idx] = dst.data[idx + 1] = dst.data[idx + 2] = v;
        dst.data[idx + 3] = 255;
      }
    }
    return dst;
  }

  // Wyrównanie histogramu dla obrazu grayscale (ImageData)
  private equalizeHistogram(src: ImageData): ImageData {
    const { width, height, data } = src;
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
    const cdf = new Array(256).fill(0);
    cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
    const total = cdf[255] || 1;
    const map = new Uint8Array(256);
    for (let i = 0; i < 256; i++) map[i] = Math.round((cdf[i] - cdf[0]) / Math.max(1, total - cdf[0]) * 255);
    const dst = new ImageData(width, height);
    for (let i = 0; i < data.length; i += 4) {
      const v = map[data[i]];
      dst.data[i] = dst.data[i + 1] = dst.data[i + 2] = v;
      dst.data[i + 3] = 255;
    }
    return dst;
  }

  // Analiza kolorów obrazu - wykrywa szare obszary
  async analyzeColors(imageElement: HTMLImageElement): Promise<ColorAnalysis> {
    this.initCanvas();
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not available');
    }

    this.canvas.width = imageElement.width;
    this.canvas.height = imageElement.height;
    this.ctx.drawImage(imageElement, 0, 0);

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;

    let grayPixels = 0;
    let totalPixels = pixels.length / 4;
    let totalHue = 0;
    let totalSaturation = 0;
    let totalBrightness = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Konwersja RGB to HSV
      const { h, s, v } = this.rgbToHsv(r, g, b);

      totalHue += h;
      totalSaturation += s;
      totalBrightness += v;

      // Sprawdź czy piksel jest szary (niska saturacja)
      if (s < 0.15 && v > 0.2 && v < 0.9) {
        // Szary = niska saturacja, średnia jasność
        grayPixels++;
      }
    }

    const grayPercentage = (grayPixels / totalPixels) * 100;

    return {
      isGrayArea: grayPercentage > 30, // Jeśli >30% pikseli to szare
      grayPercentage,
      dominantHue: totalHue / totalPixels,
      saturation: totalSaturation / totalPixels,
      brightness: totalBrightness / totalPixels,
    };
  }

  // Konwertuj obraz na czarno-biały (grayscale) dla lepszego OCR
  convertToGrayscale(imageElement: HTMLImageElement): HTMLCanvasElement {
    this.initCanvas();
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not available');
    }

    this.canvas.width = imageElement.width;
    this.canvas.height = imageElement.height;
    this.ctx.drawImage(imageElement, 0, 0);

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;

    // Konwersja na grayscale używając standardowego wzoru luminancji
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Wzór luminancji: 0.299*R + 0.587*G + 0.114*B
      const grayscale = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      pixels[i] = grayscale; // R
      pixels[i + 1] = grayscale; // G
      pixels[i + 2] = grayscale; // B
      // pixels[i + 3] alpha pozostaje bez zmian
    }

    this.ctx.putImageData(imageData, 0, 0);
    return this.canvas;
  }

  // Stwórz maskę szarych obszarów
  createGrayMask(imageElement: HTMLImageElement): HTMLCanvasElement {
    this.initCanvas();
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not available');
    }

    this.canvas.width = imageElement.width;
    this.canvas.height = imageElement.height;
    this.ctx.drawImage(imageElement, 0, 0);

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;

    // Stwórz maskę - białe piksele = szare obszary, czarne = kolorowe
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      const { s, v } = this.rgbToHsv(r, g, b);

      // Jeśli piksel jest szary, zostaw go. Jeśli kolorowy, zamień na czarny
      if (s < 0.2 && v > 0.15 && v < 0.95) {
        // Szary - wyostrz kontrast dla lepszego OCR
        const enhancedGray = Math.min(255, v * 1.2 * 255);
        pixels[i] = enhancedGray;
        pixels[i + 1] = enhancedGray;
        pixels[i + 2] = enhancedGray;
      } else {
        // Kolorowy - zamień na czarny (ignoruj)
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
    return this.canvas;
  }

  // Preprocessing obrazu - konwersja na czarno-biały dla lepszego OCR
  preprocessForOCR(
    imageElement: HTMLImageElement,
    options: OCRPreprocessOptions = {}
  ): OCRPreprocessResult {
    if (typeof document === 'undefined') {
      throw new Error('Document not available - client-side only');
    }

    const {
      blockSize = 25,
      offsetC = 7,
      alternateBlockSize = blockSize + 6,
      alternateOffsetC = Math.max(1, offsetC - 2),
      targetMaxSize = 1200,
      capturePreview = false,
    } = options;

    const normalizedBlock = blockSize % 2 === 0 ? blockSize + 1 : blockSize;
    const normalizedAltBlock = alternateBlockSize % 2 === 0 ? alternateBlockSize + 1 : alternateBlockSize;
    const normalizedOffset = Math.max(0, offsetC);
    const normalizedAltOffset = Math.max(0, alternateOffsetC);

    // 1) Grayscale z karą za wysoką saturację (upodobnienie do planszy czarno-białej)
    const grayscaleCanvas = document.createElement('canvas');
    const gctx = grayscaleCanvas.getContext('2d')!;
    grayscaleCanvas.width = imageElement.width;
    grayscaleCanvas.height = imageElement.height;
    gctx.drawImage(imageElement, 0, 0);
    let gImage = gctx.getImageData(0, 0, grayscaleCanvas.width, grayscaleCanvas.height);
    const gd = gImage.data;
    for (let i = 0; i < gd.length; i += 4) {
      const r = gd[i], g = gd[i + 1], b = gd[i + 2];
      const { s } = this.rgbToHsv(r, g, b);
      // standardowa luminancja
      let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      // kara dla mocno nasyconych kolorów (redukcja jasności, aby ograniczyć fałszywe kształty)
      if (s > 0.35) {
        const factor = 1 - 0.5 * ((s - 0.35) / 0.65); // od 1.0 do ~0.5
        gray = Math.max(0, Math.min(255, Math.round(gray * factor)));
      }
      gd[i] = gd[i + 1] = gd[i + 2] = gray;
      gd[i + 3] = 255;
    }
    gctx.putImageData(gImage, 0, 0);

    // 2) Skalowanie do docelowej rozdzielczości (cel ~targetMaxSize najdłuższy bok)
    const targetMax = Math.max(1, targetMaxSize);
    const currentMax = Math.max(grayscaleCanvas.width, grayscaleCanvas.height);
    const scale = Math.min(3, Math.max(1, targetMax / (currentMax || 1)));

    const scaledCanvas = document.createElement('canvas');
    const scaledCtx = scaledCanvas.getContext('2d')!;
    scaledCanvas.width = Math.round(grayscaleCanvas.width * scale);
    scaledCanvas.height = Math.round(grayscaleCanvas.height * scale);
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(grayscaleCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

    // 3) Pobierz dane pikseli (grayscale) i odszum medianą 3x3
    const scaledImageData = scaledCtx.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height);
    const denoised = this.medianBlurGrayscale(scaledImageData, 3);

    // 3.5) Wyrównanie histogramu (rozciągnięcie kontrastu jak w planszy B/W)
    const equalized = this.equalizeHistogram(denoised);

    // 4) Binarizacja – spróbuj kilku wariantów i wybierz najlepszy wg udziału czerni
    const cand1 = this.adaptiveThresholdMean(equalized, normalizedBlock, normalizedOffset);
    const cand2 = this.adaptiveThresholdMean(equalized, normalizedAltBlock, normalizedAltOffset);
    const otsuT = this.otsuThreshold(equalized);
    const meanEq = this.meanGray(equalized);
    const cand3 = this.applyThreshold(equalized, otsuT, meanEq < 127);

    const candidates = [cand1, cand2, cand3];
    const targetBlack = 0.22; // oczekiwany udział czerni dla cyfr na jasnym tle
    let best = candidates[0];
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      const ratio = this.blackRatio(c);
      const diff = Math.abs(ratio - targetBlack);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    }
    const binarized = best;

    // 5) Lekka morfologia: zamknij małe przerwy (dylacja -> erozja) aby scalić cyfry
    const morph = this.morphologyClose(binarized, scaledCanvas.width, scaledCanvas.height);

    // 6) Zapisz wynik na docelowym canvasie i zwróć
    const processedCanvas = document.createElement('canvas');
    const processedCtx = processedCanvas.getContext('2d')!;
    processedCanvas.width = scaledCanvas.width;
    processedCanvas.height = scaledCanvas.height;
    processedCtx.putImageData(morph, 0, 0);

    return {
      canvas: processedCanvas,
      previewDataUrl: capturePreview ? processedCanvas.toDataURL('image/png') : undefined,
    };
  }

  // Średnia jasność obrazu (na kanale szarości)
  private meanGray(imageData: ImageData): number {
    const d = imageData.data;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += d[i];
      count++;
    }
    return sum / Math.max(1, count);
  }

  // Median blur 3x3 dla obrazu w skali szarości (ImageData RGBA, kanały R=G=B)
  private medianBlurGrayscale(src: ImageData, kernelSize: number = 3): ImageData {
    const { width, height, data } = src;
    const dst = new ImageData(width, height);
    const k = Math.max(3, kernelSize) | 1; // wymuś nieparzysty
    const r = (k - 1) >> 1;

    const getGray = (x: number, y: number) => {
      const xi = Math.min(width - 1, Math.max(0, x));
      const yi = Math.min(height - 1, Math.max(0, y));
      const idx = (yi * width + xi) * 4;
      return data[idx];
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const windowVals: number[] = [];
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            windowVals.push(getGray(x + dx, y + dy));
          }
        }
        windowVals.sort((a, b) => a - b);
        const med = windowVals[(windowVals.length >> 1)];
        const idx = (y * width + x) * 4;
        dst.data[idx] = med;
        dst.data[idx + 1] = med;
        dst.data[idx + 2] = med;
        dst.data[idx + 3] = 255;
      }
    }
    return dst;
  }

  // Otsu threshold na obrazie w skali szarości
  private otsuThreshold(imageData: ImageData): number {
    const hist = new Array(256).fill(0);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++;

    const total = (d.length / 4) | 0;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = -1;
    let threshold = 127;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > varMax) {
        varMax = between;
        threshold = t;
      }
    }
    return threshold;
  }

  // Zastosuj próg: < threshold = 0, >= threshold = 255; opcjonalnie odwróć
  private applyThreshold(src: ImageData, threshold: number, invert = false): ImageData {
    const { width, height, data } = src;
    const dst = new ImageData(width, height);
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] >= threshold ? 255 : 0;
      const out = invert ? 255 - v : v;
      dst.data[i] = out;
      dst.data[i + 1] = out;
      dst.data[i + 2] = out;
      dst.data[i + 3] = 255;
    }
    return dst;
  }

  // Prosta morfologia zamknięcia (dylacja->erozja) dla binary image
  private morphologyClose(src: ImageData, width: number, height: number): ImageData {
    const dilated = this.dilate(src, width, height);
    const eroded = this.erode(dilated, width, height);
    return eroded;
  }

  private dilate(src: ImageData, width: number, height: number): ImageData {
    const dst = new ImageData(width, height);
    const s = src.data;
    const d = dst.data;
    const get = (x: number, y: number) => {
      x = Math.min(width - 1, Math.max(0, x));
      y = Math.min(height - 1, Math.max(0, y));
      return s[(y * width + x) * 4];
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            maxVal = Math.max(maxVal, get(x + dx, y + dy));
          }
        }
        const idx = (y * width + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = maxVal;
        d[idx + 3] = 255;
      }
    }
    return dst;
  }

  private erode(src: ImageData, width: number, height: number): ImageData {
    const dst = new ImageData(width, height);
    const s = src.data;
    const d = dst.data;
    const get = (x: number, y: number) => {
      x = Math.min(width - 1, Math.max(0, x));
      y = Math.min(height - 1, Math.max(0, y));
      return s[(y * width + x) * 4];
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 255;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            minVal = Math.min(minVal, get(x + dx, y + dy));
          }
        }
        const idx = (y * width + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = minVal;
        d[idx + 3] = 255;
      }
    }
    return dst;
  }

  // Konwersja RGB to HSV
  private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
      if (max === r) h = ((g - b) / diff) % 6;
      else if (max === g) h = (b - r) / diff + 2;
      else h = (r - g) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : diff / max;
    const v = max;

    return { h: h / 360, s, v };
  }

  // Usuń outliers z wykrytych numerów
  removeOutliers(numbers: number[]): { clean: number[]; outliers: number[] } {
    if (numbers.length <= 2) return { clean: numbers, outliers: [] };

    const sorted = [...numbers].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const maxAllowed = median * 3;

    const clean = sorted.filter(num => num <= maxAllowed);
    const outliers = sorted.filter(num => num > maxAllowed);

    return { clean, outliers };
  }

  extractLargestCluster(numbers: number[], gapTolerance = 2): { cluster: number[]; outside: number[] } {
    if (numbers.length === 0) {
      return { cluster: [], outside: [] };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const clusters: number[][] = [];
    let current: number[] = [];

    for (const num of sorted) {
      if (current.length === 0) {
        current = [num];
        continue;
      }

      const last = current[current.length - 1];
      if (num - last <= gapTolerance) {
        if (num !== last) {
          current.push(num);
        }
      } else {
        clusters.push(current);
        current = [num];
      }
    }

    if (current.length > 0) {
      clusters.push(current);
    }

    if (clusters.length === 0) {
      return { cluster: sorted, outside: [] };
    }

    let bestCluster = clusters[0];
    for (let i = 1; i < clusters.length; i++) {
      const candidate = clusters[i];
      if (candidate.length > bestCluster.length) {
        bestCluster = candidate;
      } else if (candidate.length === bestCluster.length && candidate[0] < bestCluster[0]) {
        bestCluster = candidate;
      }
    }

    const outside = sorted.filter(num => !bestCluster.includes(num));

    return { cluster: bestCluster, outside };
  }

  // Generuj pełną sekwencję projektów 1...max
  generateProjectSequence(detectedNumbers: number[]): number[] {
    if (detectedNumbers.length === 0) return [];

    const maxProject = Math.max(...detectedNumbers);
    return Array.from({ length: maxProject }, (_, i) => i + 1);
  }
}

// Export singleton instance
export const ocrProcessor = new OCRImageProcessor();
