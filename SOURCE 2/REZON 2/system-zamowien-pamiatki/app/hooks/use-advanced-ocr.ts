// Zaawansowany hook OCR z segmentacją kolorów i preprocessing

import { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { ocrProcessor, OCRResult, OCRPreprocessOptions } from '@/lib/ocr-utils';

export function useAdvancedOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const processImage = useCallback(
    async (
      imageUrl: string,
      options: {
        useColorSegmentation?: boolean;
        preprocessImage?: boolean;
        tesseractPSM?: string;
        characterWhitelist?: string;
        expectedMax?: number; // maksymalny spodziewany numer projektu (np. 72)
        forceBinary?: boolean; // pozostawione na przyszłość; aktualnie preprocessing i tak binarzuje
        preprocessOptions?: OCRPreprocessOptions;
      } = {}
    ): Promise<OCRResult> => {
      const {
        useColorSegmentation = true,
        preprocessImage = true,
        tesseractPSM = '11', // domyślnie Sparse Text
        characterWhitelist = '0123456789',
        expectedMax,
        forceBinary,
        preprocessOptions,
      } = options;

      setIsProcessing(true);
      setProgress('Ładowanie obrazu...');

      const startTime = Date.now();

      try {
        // Załaduj obraz
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });

        let targetElement = img;
        let grayAreasFound = 0;
        let preprocessPreview: string | undefined;

        // Analiza kolorów i preprocessing
        if (useColorSegmentation) {
          setProgress('Analizuję kolory obrazu...');

          const colorAnalysis = await ocrProcessor.analyzeColors(img);
          console.log('🎨 Analiza kolorów:', colorAnalysis);

          if (colorAnalysis.isGrayArea) {
            grayAreasFound = 1;

            if (preprocessImage) {
              setProgress('Preprocessing - fokus na szare obszary...');

              const preprocessConfig: OCRPreprocessOptions = {
                capturePreview: true,
                ...preprocessOptions,
              };

              const processed = ocrProcessor.preprocessForOCR(img, preprocessConfig);
              preprocessPreview = processed.previewDataUrl;

              const processedDataUrl = processed.canvas.toDataURL('image/png');
              targetElement = new Image();
              await new Promise(resolve => {
                targetElement.onload = resolve;
                (targetElement as HTMLImageElement).src = processedDataUrl;
              });
            }
          }
        }

        const passes: Array<{ label: string; element: HTMLImageElement | HTMLCanvasElement; psm: string }>
          = [
            { label: 'psm11-main', element: targetElement, psm: tesseractPSM },
          ];

        if (preprocessImage) {
          passes.push({ label: 'psm6-secondary', element: targetElement, psm: '6' });
        }

        const aggregatedNumbers: number[] = [];
        const aggregatedOriginals: number[][] = [];
        const aggregatedOutliers: number[][] = [];
        let bestConfidence = 0;

        for (const pass of passes) {
          setProgress(`OCR (${pass.label})...`);

          const tesseractOptions = {
            logger: (m: any) => {
              if (m.status === 'recognizing text') {
                setProgress(`OCR (${pass.label}): ${Math.round(m.progress * 100)}%`);
              }
            },
          };

          const ocrConfig = {
            tessedit_pageseg_mode: pass.psm,
            tessedit_char_whitelist: characterWhitelist,
            preserve_interword_spaces: '0',
            user_defined_dpi: '350',
            classify_bln_numeric_mode: '1',
            load_system_dawg: '0',
            load_freq_dawg: '0',
          } as Record<string, string>;

          const { data } = await Tesseract.recognize(pass.element, 'eng', {
            ...tesseractOptions,
            // @ts-ignore - Tesseract config
            config: ocrConfig,
          });

          const rawNumbers = data.text.match(/\d+/g) || [];
          const parsedNumbers = rawNumbers.map(num => parseInt(num)).filter(num => num >= 1);
          const { clean: cleanNumbers, outliers } = ocrProcessor.removeOutliers(parsedNumbers);

          aggregatedNumbers.push(...cleanNumbers);
          aggregatedOriginals.push(cleanNumbers);
          aggregatedOutliers.push(outliers);

          bestConfidence = Math.max(bestConfidence, data.confidence);
        }

        setProgress('Analiza połączonych wyników...');

        const uniqueNumbers = Array.from(new Set(aggregatedNumbers)).sort((a, b) => a - b);

        let gapTolerance = 2;
        const minCoverage = Math.max(3, Math.floor(uniqueNumbers.length * 0.7));
        let bestCluster = ocrProcessor.extractLargestCluster(uniqueNumbers, gapTolerance);

        while (gapTolerance < 6 && bestCluster.cluster.length < minCoverage) {
          gapTolerance += 1;
          const candidate = ocrProcessor.extractLargestCluster(uniqueNumbers, gapTolerance);

          if (candidate.cluster.length > bestCluster.cluster.length) {
            bestCluster = candidate;
          } else if (
            candidate.cluster.length === bestCluster.cluster.length &&
            candidate.cluster[0] < bestCluster.cluster[0]
          ) {
            bestCluster = candidate;
          }
        }

        const clusterSet = new Set(bestCluster.cluster);
        const clusterMin = bestCluster.cluster.length > 0 ? bestCluster.cluster[0] : 0;
        const clusterMax = bestCluster.cluster.length > 0 ? bestCluster.cluster[bestCluster.cluster.length - 1] : 0;

        for (const candidate of bestCluster.outside) {
          if (candidate >= clusterMin - gapTolerance && candidate <= clusterMax + gapTolerance) {
            clusterSet.add(candidate);
          }
        }

        const extendedCluster = Array.from(clusterSet).sort((a, b) => a - b);

        const rawOutliers = [
          ...aggregatedOutliers.flat(),
          ...bestCluster.outside.filter(n => !clusterSet.has(n)),
        ];
        const finalOutliers = Array.from(new Set(rawOutliers)).sort((a, b) => a - b);

        const filteredCluster = expectedMax
          ? extendedCluster.filter(n => n >= 1 && n <= Math.min(84, expectedMax + Math.max(6, Math.round(expectedMax * 0.35))))
          : extendedCluster;

        let targetMax = filteredCluster.length > 0 ? filteredCluster[filteredCluster.length - 1] : 0;

        if (expectedMax) {
          const softCap = Math.min(84, expectedMax + Math.max(6, Math.round(expectedMax * 0.35)));
          const minRequired = Math.max(5, Math.round(expectedMax * 0.5));
          if (filteredCluster.length >= minRequired && (filteredCluster[0] ?? 1) <= 2) {
            targetMax = Math.max(targetMax, softCap);
          }
        }

        const sequenceSeed = [...filteredCluster];
        const currentMax = filteredCluster[filteredCluster.length - 1] ?? 0;
        if (targetMax > currentMax) {
          sequenceSeed.push(targetMax);
        }

        const projectNumbers = ocrProcessor.generateProjectSequence(sequenceSeed);

        const processingTime = Date.now() - startTime;

        console.log('🎯 Zaawansowany OCR - wyniki:', {
          combined: uniqueNumbers,
          cluster: bestCluster.cluster,
          passes: aggregatedOriginals,
          outliers: finalOutliers,
          final: projectNumbers,
          confidence: bestConfidence,
          time: processingTime,
        });

        return {
          projectNumbers,
          confidence: bestConfidence,
          processingTime,
          grayAreasFound,
          originalNumbers: filteredCluster,
          outliers: finalOutliers,
          processedPreviewDataUrl: preprocessPreview,
        };
      } catch (error: any) {
        console.error('❌ Błąd zaawansowanego OCR:', error);
        throw new Error(`OCR Error: ${error.message}`);
      } finally {
        setIsProcessing(false);
        setProgress('');
      }
    },
    []
  );

  return {
    processImage,
    isProcessing,
    progress,
  };
}
