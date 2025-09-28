import { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';

export default function BackgroundRemover() {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadModel();
  }, []);

  const loadModel = async () => {
    setModelLoading(true);
    try {
      console.log('Loading TensorFlow.js model...');
      const loadedModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
      setModel(loadedModel);
      console.log('✅ Model loaded successfully');
    } catch (error) {
      console.error('❌ Error loading model:', error);
    }
    setModelLoading(false);
  };

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
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const segmentation = await model.segmentPerson(canvas, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < segmentation.data.length; i++) {
        if (segmentation.data[i] === 0) {
          data[i * 4 + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const resultUrl = canvas.toDataURL('image/png');
      setProcessedImage(resultUrl);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try another image.');
    }
    setLoading(false);
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
      <h1>🎨 Free Background Remover</h1>
      <p>100% Free • Unlimited Usage • Privacy First</p>
      
      <div style={styles.section}>
        <button 
          onClick={loadModel} 
          disabled={model || modelLoading}
          style={{
            ...styles.button,
            ...(model ? styles.buttonSuccess : {}),
            ...((!model && !modelLoading) ? styles.buttonPrimary : {})
          }}
        >
          {modelLoading ? 'Loading AI Model...' : model ? '✅ Model Loaded' : 'Load AI Model'}
        </button>
      </div>

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
      </div>

      {originalImage && (
        <div style={styles.section}>
          <button 
            onClick={removeBackground} 
            disabled={loading || !model}
            style={styles.button}
          >
            {loading ? '🔄 Removing Background...' : '✨ Remove Background'}
          </button>
        </div>
      )}

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
                <button onClick={downloadImage} style={{...styles.button, ...styles.downloadButton}}>
                  💾 Download PNG
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
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
    margin: '2rem 0'
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
  }
};
