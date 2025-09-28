import { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';

export default function BackgroundRemover() {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('bodypix');
  const [refinement, setRefinement] = useState(true);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);

  const models = {
    bodypix: { name: 'BodyPix (Fast)', accuracy: 'Medium' },
    // We'll add more model options
  };

  useEffect(() => {
    loadModel();
  }, [selectedModel]);

  const loadModel = async () => {
    setModelLoading(true);
    try {
      console.log(`Loading ${selectedModel} model...`);
      
      let loadedModel;
      if (selectedModel === 'bodypix') {
        loadedModel = await bodyPix.load({
          architecture: 'ResNet50', // More accurate than MobileNet
          outputStride: 32,
          quantBytes: 4,
          multiplier: 1.0 // Higher multiplier for better accuracy
        });
      }
      
      setModel(loadedModel);
      console.log('✅ Model loaded successfully');
    } catch (error) {
      console.error('❌ Error loading model:', error);
    }
    setModelLoading(false);
  };

  // Enhanced background removal with better edge detection
  const removeBackground = async () => {
    if (!model || !originalImage) return;

    setLoading(true);
    try {
      const img = new Image();
      img.src = originalImage;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = canvasRef.current;
      const originalCanvas = originalCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const originalCtx = originalCanvas.getContext('2d');
      
      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      originalCanvas.width = img.width;
      originalCanvas.height = img.height;

      // Draw original image
      originalCtx.drawImage(img, 0, 0);
      ctx.drawImage(img, 0, 0);

      // Get segmentation with better settings
      const segmentation = await model.segmentPerson(originalCanvas, {
        internalResolution: 'high', // Higher resolution for better edges
        segmentationThreshold: 0.8, // Higher threshold for more confidence
        maxDetections: 1,
        scoreThreshold: 0.5,
        nmsRadius: 20
      });

      // Create enhanced mask with edge smoothing
      const mask = await createEnhancedMask(segmentation, img.width, img.height);
      
      // Apply the mask to create transparent background
      applyMaskWithSmoothing(ctx, mask, img.width, img.height);

      // Get final result
      const resultUrl = canvas.toDataURL('image/png');
      setProcessedImage(resultUrl);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try another image.');
    }
    setLoading(false);
  };

  // Create enhanced mask with better edge detection
  const createEnhancedMask = async (segmentation, width, height) => {
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    maskCanvas.width = width;
    maskCanvas.height = height;

    // Create basic mask
    const mask = bodyPix.toMask(segmentation);
    maskCtx.putImageData(mask, 0, 0);

    if (refinement) {
      // Apply edge smoothing
      await applyEdgeSmoothing(maskCtx, width, height);
    }

    return maskCanvas;
  };

  // Apply edge smoothing to reduce jagged edges
  const applyEdgeSmoothing = (ctx, width, height) => {
    return new Promise((resolve) => {
      // Apply blur to smooth edges
      ctx.filter = 'blur(1px)';
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.filter = 'none';
      
      // Increase contrast to maintain edge definition
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // Make pixels more black or white (reduce gray areas)
        if (data[i] > 128) {
          data[i] = data[i + 1] = data[i + 2] = 255; // White
        } else {
          data[i] = data[i + 1] = data[i + 2] = 0; // Black
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve();
    });
  };

  // Apply mask with edge smoothing
  const applyMaskWithSmoothing = (ctx, maskCanvas, width, height) => {
    // Save original image data
    const originalImageData = ctx.getImageData(0, 0, width, height);
    
    // Apply mask
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // Get the masked result
    const maskedData = ctx.getImageData(0, 0, width, height);
    
    // Apply edge refinement
    const refinedData = refineEdges(originalImageData, maskedData, width, height);
    ctx.putImageData(refinedData, 0, 0);
  };

  // Refine edges to keep more of the subject
  const refineEdges = (originalData, maskedData, width, height) => {
    const original = originalData.data;
    const masked = maskedData.data;
    const result = new Uint8ClampedArray(masked);
    
    // Look for edge pixels that might have been incorrectly removed
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        
        // If this pixel is transparent but surrounded by opaque pixels
        if (masked[i + 3] === 0) {
          // Check surrounding pixels
          let opaqueNeighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ni = ((y + dy) * width + (x + dx)) * 4;
              if (masked[ni + 3] > 128) {
                opaqueNeighbors++;
              }
            }
          }
          
          // If most neighbors are opaque, this might be an incorrectly removed edge pixel
          if (opaqueNeighbors >= 5) {
            // Restore this pixel with original color
            result[i] = original[i];
            result[i + 1] = original[i + 1];
            result[i + 2] = original[i + 2];
            result[i + 3] = 255; // Make it opaque
          }
        }
      }
    }
    
    return new ImageData(result, width, height);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Please select an image smaller than 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target.result);
        setProcessedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = () => {
    if (processedImage) {
      const link = document.createElement('a');
      link.download = 'background-removed.png';
      link.href = processedImage;
      link.click();
    }
  };

  return (
    <div style={styles.container}>
      <h1>🎨 Enhanced Background Remover</h1>
      <p>Better Edge Detection • Improved Accuracy • 100% Free</p>
      
      {/* Model Selection */}
      <div style={styles.section}>
        <div style={styles.optionGroup}>
          <label style={styles.label}>
            <input
              type="checkbox"
              checked={refinement}
              onChange={(e) => setRefinement(e.target.checked)}
              style={styles.checkbox}
            />
            Enable Edge Refinement
          </label>
        </div>
      </div>

      {/* Model Loader */}
      <div style={styles.section}>
        <button 
          onClick={loadModel} 
          disabled={modelLoading}
          style={{
            ...styles.button,
            ...(model ? styles.buttonSuccess : styles.buttonPrimary)
          }}
        >
          {modelLoading ? 'Loading AI Model...' : model ? '✅ Model Loaded' : 'Load AI Model'}
        </button>
      </div>

      {/* File Upload */}
      <div style={styles.section}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <button 
          onClick={() => fileInputRef.current.click()}
          disabled={!model}
          style={styles.button}
        >
          📁 Upload Image
        </button>
        <div style={styles.tip}>For best results, use images with clear contrast between subject and background</div>
      </div>

      {/* Processing */}
      {originalImage && (
        <div style={styles.section}>
          <button 
            onClick={removeBackground} 
            disabled={loading || !model}
            style={styles.button}
          >
            {loading ? '🔄 Processing...' : '✨ Remove Background'}
          </button>
        </div>
      )}

      {/* Results */}
      <div style={styles.results}>
        {originalImage && (
          <div style={styles.imageComparison}>
            <div style={styles.imageBox}>
              <h3>Original Image</h3>
              <img src={originalImage} alt="Original" style={styles.previewImage} />
            </div>
            {processedImage && (
              <div style={styles.imageBox}>
                <h3>Background Removed</h3>
                <img src={processedImage} alt="Processed" style={styles.previewImage} />
                <div style={styles.downloadSection}>
                  <button onClick={downloadImage} style={{...styles.button, ...styles.downloadButton}}>
                    💾 Download PNG
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tips Section */}
      <div style={styles.tips}>
        <h3>💡 Tips for Best Results:</h3>
        <ul style={styles.tipsList}>
          <li>Use images with good lighting</li>
          <li>Ensure clear contrast between subject and background</li>
          <li>Avoid busy or complex backgrounds</li>
          <li>Use high-quality images</li>
          <li>Enable edge refinement for better borders</li>
        </ul>
      </div>

      {/* Hidden canvases */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={originalCanvasRef} style={{ display: 'none' }} />
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    textAlign: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
  },
  section: {
    margin: '1.5rem 0'
  },
  optionGroup: {
    display: 'flex',
    gap: '2rem',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#555'
  },
  checkbox: {
    cursor: 'pointer'
  },
  button: {
    background: '#0070f3',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    margin: '0.5rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'all 0.3s ease'
  },
  buttonPrimary: {
    background: '#0070f3'
  },
  buttonSuccess: {
    background: '#10b981'
  },
  downloadButton: {
    background: '#10b981'
  },
  tip: {
    fontSize: '14px',
    color: '#666',
    marginTop: '0.5rem',
    fontStyle: 'italic'
  },
  results: {
    marginTop: '2rem'
  },
  imageComparison: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
    alignItems: 'start'
  },
  imageBox: {
    background: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '400px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  },
  downloadSection: {
    marginTop: '1rem'
  },
  tips: {
    marginTop: '3rem',
    padding: '1.5rem',
    background: '#f8f9fa',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
  },
  tipsList: {
    textAlign: 'left',
    maxWidth: '400px',
    margin: '1rem auto',
    color: '#555'
  }
};
