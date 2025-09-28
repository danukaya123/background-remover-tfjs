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

  // Load MediaPipe Selfie Segmentation
  const loadModel = async () => {
    setModelLoading(true);
    setError(null);
    
    try {
      console.log('Loading MediaPipe Selfie Segmentation...');
      
      // Dynamically import MediaPipe
      const selfieSegmentation = await import('@mediapipe/selfie_segmentation');
      const { SelfieSegmentation } = selfieSegmentation;
      
      // Create and configure the model
      const loadedModel = new SelfieSegmentation({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
      });

      loadedModel.setOptions({
        modelSelection: 1, // 0-general, 1-landscape (better accuracy)
        selfieMode: false,
      });

      loadedModel.onResults((results) => {
        // Model is ready when it can process results
        console.log('✅ MediaPipe model loaded successfully');
        setModel(loadedModel);
        setModelLoading(false);
      });

      // Initialize with a blank image to trigger loading
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 100;
      tempCanvas.height = 100;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.fillRect(0, 0, 100, 100);
      
      await loadedModel.send({ image: tempCanvas });
      
    } catch (error) {
      console.error('❌ Error loading MediaPipe model:', error);
      setError(`Failed to load AI model: ${error.message}. Please refresh and try again.`);
      setModelLoading(false);
    }
  };

  // Process image with MediaPipe (much more accurate)
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

      // Draw original image first
      ctx.drawImage(img, 0, 0);

      // Use MediaPipe for segmentation (much more accurate)
      await new Promise((resolve) => {
        model.onResults((results) => {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw only the person (segmentation mask)
          ctx.save();
          ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
          
          // Only keep the parts of the original image where mask is opaque
          ctx.globalCompositeOperation = 'source-in';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Restore
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();

          resolve();
        });

        // Process the image
        model.send({ image: canvas });
      });

      // Get the final result
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
      <h1>🎨 Enhanced Background Remover</h1>
      <p>Powered by MediaPipe • Better Accuracy • 100% Free</p>

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
            <p>Click below to load the enhanced AI model (faster and more accurate)</p>
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
              Loading Enhanced AI Model...
            </>
          ) : model ? (
            '✅ Enhanced AI Model Loaded!'
          ) : (
            '🤖 Load Enhanced AI Model'
          )}
        </button>

        {modelLoading && (
          <div style={styles.loadingInfo}>
            <p>⏳ Loading MediaPipe Selfie Segmentation...</p>
            <p style={styles.smallText}>This model is faster and more accurate than the previous version</p>
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

      {/* Benefits of MediaPipe */}
      <div style={styles.benefits}>
        <h3>🎯 Why MediaPipe is Better:</h3>
        <ul style={styles.benefitsList}>
          <li>✅ <strong>Better Edge Accuracy</strong> - Cleaner borders around hair and details</li>
          <li>✅ <strong>Faster Processing</strong> - Optimized for real-time performance</li>
          <li>✅ <strong>Smaller Model</strong> - Loads faster in your browser</li>
          <li>✅ <strong>Google Technology</strong> - State-of-the-art segmentation</li>
          <li>✅ <strong>Works Great on Mobile</strong> - Optimized for all devices</li>
        </ul>
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Add CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
  benefits: {
    marginTop: '3rem',
    padding: '1.5rem',
    background: '#f0f9ff',
    borderRadius: '12px',
    border: '1px solid #bae6fd'
  },
  benefitsList: {
    textAlign: 'left',
    maxWidth: '600px',
    margin: '1rem auto',
    color: '#0369a1',
    lineHeight: '1.8'
  }
};
