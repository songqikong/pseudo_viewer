import React, { useEffect, useRef } from 'react';

// Maps SemanticKITTI labels (0-19) to RGB hex
const COLORMAP = {
  0: '#FFFFFF', 1: '#FF0000', 2: '#00FF00', 3: '#0000FF',
  4: '#FFFF00', 5: '#FF00FF', 6: '#00FFFF', 7: '#800000',
  8: '#008000', 9: '#000080', 10: '#808000', 11: '#800080',
  12: '#008080', 13: '#808080', 14: '#FF8000', 15: '#80FF00',
  16: '#FF0080', 17: '#00FF80', 18: '#8000FF', 19: '#FF8080'
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [128, 128, 128];
}

function renderBEVToCanvas(bevData, canvas) {
  if (!bevData || !canvas || bevData.length === 0) return;
  
  const ctx = canvas.getContext('2d');
  const height = bevData.length;
  const width = bevData[0].length;
  
  canvas.width = width;
  canvas.height = height;
  
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = bevData[y][x];
      const rgb = label in COLORMAP ? hexToRgb(COLORMAP[label]) : [128, 128, 128];
      
      const idx = (y * width + x) * 4;
      data[idx] = rgb[0];
      data[idx + 1] = rgb[1];
      data[idx + 2] = rgb[2];
      data[idx + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

function BEVViewer({ results }) {
  const pseudoRef = useRef(null);
  const voronoiRef = useRef(null);
  const convRef = useRef(null);

  useEffect(() => {
    if (results) {
      renderBEVToCanvas(results.pseudo_bev, pseudoRef.current);
      renderBEVToCanvas(results.bev_after_voronoi, voronoiRef.current);
      renderBEVToCanvas(results.bev_after_conv, convRef.current);
    }
  }, [results]);

  if (!results) return null;

  return (
    <>
      <div className="bev-item fade-in">
        <h3 style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Original BEV (Highest Z)</h3>
        <div className="bev-image-wrapper">
          <canvas ref={pseudoRef} style={{width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated'}} />
        </div>
      </div>
      
      <div className="bev-item fade-in" style={{animationDelay: '0.1s'}}>
        <h3 style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>After Voronoi Fill</h3>
        <div className="bev-image-wrapper">
          <canvas ref={voronoiRef} style={{width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated'}} />
        </div>
      </div>
      
      <div className="bev-item fade-in" style={{animationDelay: '0.2s'}}>
        <h3 style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>After Mode Convolution (GT)</h3>
        <div className="bev-image-wrapper">
          <canvas ref={convRef} style={{width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated'}} />
        </div>
      </div>
    </>
  );
}

export default BEVViewer;
