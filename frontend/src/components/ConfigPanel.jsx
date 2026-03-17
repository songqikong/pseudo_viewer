import React from 'react';

// Point Cloud Range bounds: X/Y in [-80, 80], Z in [-20, 20]; min must be < max per axis
const PCR_X_Y_MIN = -80;
const PCR_X_Y_MAX = 80;
const PCR_Z_MIN = -20;
const PCR_Z_MAX = 20;

function clampPointCloudRange(prev, index, rawValue) {
  const v = parseFloat(rawValue);
  if (Number.isNaN(v)) return prev;
  const newArray = [...prev.point_cloud_range];
  const axis = index % 3; // 0:x, 1:y, 2:z
  const isMax = index >= 3;
  const lo = axis === 2 ? PCR_Z_MIN : PCR_X_Y_MIN;
  const hi = axis === 2 ? PCR_Z_MAX : PCR_X_Y_MAX;
  newArray[index] = Math.max(lo, Math.min(hi, v));
  // Keep min < max for this axis
  const minIdx = axis;
  const maxIdx = axis + 3;
  if (newArray[minIdx] >= newArray[maxIdx]) {
    if (isMax) newArray[minIdx] = newArray[maxIdx] - 0.5;
    else newArray[maxIdx] = newArray[minIdx] + 0.5;
    newArray[minIdx] = Math.max(lo, Math.min(hi, newArray[minIdx]));
    newArray[maxIdx] = Math.max(lo, Math.min(hi, newArray[maxIdx]));
  }
  return { ...prev, point_cloud_range: newArray };
}

function ConfigPanel({ config, setConfig }) {
  const handleChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayChange = (field, index, value) => {
    if (field === 'point_cloud_range') {
      setConfig(prev => clampPointCloudRange(prev, index, value));
      return;
    }
    setConfig(prev => {
      const newArray = [...prev[field]];
      newArray[index] = parseFloat(value) || 0;
      return { ...prev, [field]: newArray };
    });
  };

  return (
    <div className="control-group">
      <h3>Generator Configuration</h3>
      
      <div className="control-item">
        <label className="control-label">
          Voxel Size {config.voxel_size}
          <input 
            type="range" 
            min="0.1" 
            max="1.0" 
            step="0.05" 
            value={config.voxel_size} 
            onChange={(e) => handleChange('voxel_size', parseFloat(e.target.value))}
          />
        </label>
      </div>

      <div className="control-item">
        <label className="control-label" style={{marginBottom: '4px'}}>Point Cloud Range (X/Y: {PCR_X_Y_MIN}~{PCR_X_Y_MAX}, Z: {PCR_Z_MIN}~{PCR_Z_MAX})</label>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px'}}>
          <input type="number" min={PCR_X_Y_MIN} max={PCR_X_Y_MAX} value={config.point_cloud_range[0]} onChange={(e) => handleArrayChange('point_cloud_range', 0, e.target.value)} title="X min" />
          <input type="number" min={PCR_X_Y_MIN} max={PCR_X_Y_MAX} value={config.point_cloud_range[1]} onChange={(e) => handleArrayChange('point_cloud_range', 1, e.target.value)} title="Y min" />
          <input type="number" min={PCR_Z_MIN} max={PCR_Z_MAX} value={config.point_cloud_range[2]} onChange={(e) => handleArrayChange('point_cloud_range', 2, e.target.value)} title="Z min" />
          <input type="number" min={PCR_X_Y_MIN} max={PCR_X_Y_MAX} value={config.point_cloud_range[3]} onChange={(e) => handleArrayChange('point_cloud_range', 3, e.target.value)} title="X max" />
          <input type="number" min={PCR_X_Y_MIN} max={PCR_X_Y_MAX} value={config.point_cloud_range[4]} onChange={(e) => handleArrayChange('point_cloud_range', 4, e.target.value)} title="Y max" />
          <input type="number" min={PCR_Z_MIN} max={PCR_Z_MAX} value={config.point_cloud_range[5]} onChange={(e) => handleArrayChange('point_cloud_range', 5, e.target.value)} title="Z max" />
        </div>
      </div>

      <div className="control-item">
        <label className="control-label">
          Voronoi Max Distance
          <input 
            type="number" 
            value={config.voronoi_max_distance} 
            onChange={(e) => handleChange('voronoi_max_distance', parseInt(e.target.value))}
            style={{width: '80px', textAlign: 'right'}}
          />
        </label>
      </div>
      
      <div className="control-item">
        <label className="control-label">
          Distance Metric
        </label>
        <select value={config.distance_metric} onChange={(e) => handleChange('distance_metric', e.target.value)}>
            <option value="euclidean">Euclidean</option>
            <option value="manhattan">Manhattan</option>
            <option value="chebyshev">Chebyshev</option>
        </select>
      </div>
      
      <div className="control-item">
        <label className="control-label">
          Label Weighting
        </label>
        <select value={config.label_weighting || ""} onChange={(e) => handleChange('label_weighting', e.target.value || null)}>
            <option value="">None (Unweighted)</option>
            <option value="inverse_count">Inverse Count</option>
            <option value="inverse_sqrt">Inverse Sqrt</option>
            <option value="log_inverse">Log Inverse</option>
        </select>
      </div>

      <div className="control-item">
        <label className="control-label">
          Conv Kernel Size
          <input 
            type="number" 
            value={config.conv_kernel_size} 
            onChange={(e) => handleChange('conv_kernel_size', parseInt(e.target.value))}
            style={{width: '80px', textAlign: 'right'}}
          />
        </label>
      </div>

      <div className="control-item">
        <label className="control-label">
          Semantic Height Filter %
          <input 
            type="number" 
            step="0.01"
            max="0.5"
            min="0"
            value={config.filter_percentage} 
            onChange={(e) => handleChange('filter_percentage', parseFloat(e.target.value))}
            style={{width: '80px', textAlign: 'right'}}
          />
        </label>
      </div>
      
      <div className="control-item" style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <label className="control-label" style={{margin: 0}}>Use CUDA Filter</label>
        <input 
          type="checkbox" 
          checked={config.use_cuda} 
          onChange={(e) => handleChange('use_cuda', e.target.checked)}
          style={{width: '18px', height: '18px', cursor: 'pointer'}}
        />
      </div>
    </div>
  );
}

export default ConfigPanel;
