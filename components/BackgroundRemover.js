import { useState, useRef, useEffect } from 'react';

export default function BackgroundRemover() {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Load TensorFlow.js and BodyPix dynamically
  const loadModel = async () => {
    setModelLoading(true);
    setError(null);
    
    try {
      console.log('Loading TensorFlow.js...');
      
      // Dynamically import TensorFlow.js
      const tf = await import('@tensorflow/tfjs');
      const bodyPix = await import('@tensorflow-models/body-pix');
      
      console.log('TensorFlow.js loaded, now loading BodyPix model...');
      
      // Load BodyPix model with simpler configuration
      const loadedModel = await bodyPix.load({
        architecture: 'MobileNetV1', // More reliable than ResNet
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
      
      console.log('✅ BodyPix model loaded successfully');
      setModel(loadedModel);
      
    } catch (error) {
      console.error('❌ Error loading model:', error);
      setError(`Failed to load AI model: ${error.message}. Please refresh and try again.`);
    }
    
    setModelLoading(false);
  };

  // Simple background removal without complex edge detection
  const removeBackground = async () => {
    if (!model || !originalImage) return;

    setLoading(true);
    setError(null);
    
    try {
      const img = new Image();
      img.src = originalImage;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Simple segmentation
      const segmentation = await model.segmentPerson(canvas, {
        internalResolution: 'medium', // Balanced between speed and quality
        segmentationThreshold: 0.7,
        maxDetections: 5,
        scoreThreshold: 0.3
      });

      // Create mask
      const mask = await model.toMask(segmentation);
      const maskCanvas = document.createElement('canvas');
      const maskCtx = maskCanvas.getContext('2d');
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      maskCtx.putImageData(mask, 0, 0);

      // Apply mask to create transparency
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      // Get result
      const resultUrl = canvas.toDataURL('image/png');
      setProcessedImage(resultUrl);
      
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Error processing image. Please try a different image.');
    }
    
    setLoading(false);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size
      if (file.size > 5 * 1024 * 1024) {
        setError('Please select an image smaller than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target.result);
        setProcessedImage(null);
      };
      reader.onerror = () => setError('Error reading file');
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

  const resetApp = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={styles.container}>
      <h1>🎨 Free Background Remover</h1>
      <p>100% Free • Unlimited Usage • Privacy First</p>

      {/* Error Display */}
      {error && (
        <div style={styles.error}>
          ⚠️ {error}
          <button onClick={resetApp} style={styles.resetButton}>
            Try Again
          </button>
        </div>
      )}

      {/* Model Loading Section */}
      <div style={styles.section}>
        {!model && !modelLoading && (
          <div style={styles.welcome}>
            <h3>🚀 Get Started</h3>
            <p>Click below to load the AI model (first load may take 20-30 seconds)</p>
          </div>
        )}
        
        <button 
          onClick={loadModel} 
          disabled={modelLoading || model}
          style={{
            ...styles.button,
            ...(model ? styles.buttonSuccess : styles.buttonPrimary),
            ...(modelLoading ? styles.buttonLoading : {})
          }}
        >
          {modelLoading ? (
            <>
              <div style={styles.spinner}></div>
              Loading AI Model...
            </>
          ) : model ? (
            '✅ AI Model Loaded!'
          ) : (
            '🤖 Load AI Model'
          )}
        </button>

        {modelLoading && (
          <div style={styles.loadingInfo}>
            <p>⏳ Downloading AI model (~20MB)...</p>
            <p style={styles.smallText}>This may take 20-30 seconds on first load</p>
          </div>
        )}
      </div>

      {/* File Upload */}
      {model && (
        <div style={styles.section}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            style={styles.button}
          >
            📁 Choose Image
          </button>
          <div style={styles.tip}>Supported: JPG, PNG, WebP (max 5MB)</div>
        </div>
      )}

      {/* Image Preview and Processing */}
      {originalImage && (
        <div style={styles.section}>
          <div style={styles.previewSection}>
            <h3>Image Preview</h3>
            <img src={originalImage} alt="Preview" style={styles.previewImage} />
            
            <button 
              onClick={removeBackground} 
              disabled={loading}
              style={styles.button}
            >
              {loading ? (
                <>
                  <div style={styles.smallSpinner}></div>
                  Removing Background...
                </>
              ) : (
                '✨ Remove Background'
              )}
            </button>
            
            <button onClick={resetApp} style={styles.secondaryButton}>
              ↻ Choose Different Image
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {processedImage && (
        <div style={styles.section}>
          <div style={styles.results}>
            <h3>✅ Background Removed Successfully!</h3>
            <div style={styles.imageComparison}>
              <div style={styles.imageBox}>
                <h4>Original</h4>
                <img src={originalImage} alt="Original" style={styles.resultImage} />
              </div>
              <div style={styles.imageBox}>
                <h4>Result</h4>
                <img src={processedImage} alt="Processed" style={styles.resultImage} />
                <button onClick={downloadImage} style={{...styles.button, ...styles.downloadButton}}>
                  💾 Download PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={styles.tips}>
        <h3>💡 Tips for Best Results:</h3>
        <ul style={styles.tipsList}>
          <li>Use images with clear contrast between subject and background</li>
          <li>Well-lit photos work better</li>
          <li>Avoid very busy backgrounds</li>
          <li>For people: clear full-body or upper-body shots work best</li>
        </ul>
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '1rem',
    textAlign: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    minHeight: '100vh'
  },
  section: {
    margin: '2rem 0'
  },
  welcome: {
    background: '#f0f9ff',
    padding: '1.5rem',
    borderRadius: '12px',
    marginBottom: '1rem',
    border: '1px solid #bae6fd'
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
    transition: 'all 0.3s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  buttonPrimary: {
    background: '#0070f3'
  },
  buttonSuccess: {
    background: '#10b981'
  },
  buttonLoading: {
    background: '#6b7280'
  },
  downloadButton: {
    background: '#10b981'
  },
  secondaryButton: {
    background: 'transparent',
    color: '#6b7280',
    border: '1px solid #d1d5db'
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  smallSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid transparent',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '1rem',
    borderRadius: '8px',
    margin: '1rem 0',
    border: '1px solid #fecaca'
  },
  resetButton: {
    background: '#dc2626',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '1rem',
    fontSize: '14px'
  },
  loadingInfo: {
    marginTop: '1rem',
    color: '#6b7280'
  },
  smallText: {
    fontSize: '14px',
    opacity: 0.8
  },
  tip: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '0.5rem'
  },
  previewSection: {
    background: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: '8px',
    margin: '1rem 0'
  },
  results: {
    background: '#f0fdf4',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #bbf7d0'
  },
  imageComparison: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginTop: '1rem'
  },
  imageBox: {
    padding: '1rem'
  },
  resultImage: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
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
    maxWidth: '500px',
    margin: '1rem auto',
    color: '#6b7280',
    lineHeight: '1.6'
  }
};
