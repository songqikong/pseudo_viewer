import React, { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

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
    parseInt(result[1], 16) / 255.0,
    parseInt(result[2], 16) / 255.0,
    parseInt(result[3], 16) / 255.0
  ] : [0.5, 0.5, 0.5];
}

// Input point cloud: [x, y, z, label] in world coords (KITTI: x forward, y left, z up) -> Three.js (y up)
function InputPointCloud({ points, pointSize }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const gray = [0.45, 0.45, 0.5];
    points.forEach((p, i) => {
      const x = p[0], y = p[1], z = p[2];
      positions[i * 3] = x;
      positions[i * 3 + 1] = z;
      positions[i * 3 + 2] = -y;
      colors[i * 3] = gray[0];
      colors[i * 3 + 1] = gray[1];
      colors[i * 3 + 2] = gray[2];
    });
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [points]);

  const size = pointSize ?? 0.35;
  return (
    <points geometry={geometry}>
      <pointsMaterial size={size} vertexColors sizeAttenuation={false} transparent opacity={0.85} />
    </points>
  );
}

// Pseudo (dense) point cloud: voxel indices [x_idx, y_idx, z_idx, label]
function PseudoPointCloud({ points, config, pointSize }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const vs = config.voxel_size || 0.25;
    const nx = config.coords_norm[0] || 160;
    const ny = config.coords_norm[1] || 160;
    const nz = config.coords_norm[2] || 8;
    points.forEach((p, i) => {
      const ox = (p[0] - nx) * vs;
      const oy = (p[1] - ny) * vs;
      const oz = (p[2] - nz) * vs;
      positions[i * 3] = ox;
      positions[i * 3 + 1] = oz;
      positions[i * 3 + 2] = -oy;
      const label = p[3];
      const rgb = label in COLORMAP ? hexToRgb(COLORMAP[label]) : [0.5, 0.5, 0.5];
      colors[i * 3] = rgb[0];
      colors[i * 3 + 1] = rgb[1];
      colors[i * 3 + 2] = rgb[2];
    });
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [points, config]);

  const size = pointSize ?? (config.voxel_size * 2) ?? 0.5;
  return (
    <points geometry={geometry}>
      <pointsMaterial size={size} vertexColors sizeAttenuation={false} transparent opacity={0.95} />
    </points>
  );
}

const POINT_SIZE_MIN = 0.5;
const POINT_SIZE_MAX = 30;
const POINT_SIZE_DEFAULT = 2;

function PointCloudViewer({ inputPointCloud, pointCloud, config }) {
  const [pointSizeScale, setPointSizeScale] = useState(POINT_SIZE_DEFAULT);
  const [showInput, setShowInput] = useState(true);
  const [showPseudo, setShowPseudo] = useState(true);
  const hasPseudo = pointCloud && Array.isArray(pointCloud) && pointCloud.length > 0;
  const hasInput = inputPointCloud && Array.isArray(inputPointCloud) && inputPointCloud.length > 0;
  if (!hasPseudo && !hasInput) return null;

  const vs = config?.voxel_size ?? 0.25;
  const basePseudo = Math.max(vs * 2.5, 0.5);
  const baseInput = 0.3;
  const pseudoSize = basePseudo * (pointSizeScale / POINT_SIZE_DEFAULT);
  const inputSize = baseInput * (pointSizeScale / POINT_SIZE_DEFAULT);

  return (
    <div className="point-cloud-viewer-wrap">
      <div className="point-cloud-viewer-controls">
        <div className="point-cloud-viewer-control-group">
          <label className="point-cloud-viewer-control-label">
            点大小
            <span className="point-cloud-viewer-control-value">{pointSizeScale.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={POINT_SIZE_MIN}
            max={POINT_SIZE_MAX}
            step={0.1}
            value={pointSizeScale}
            onChange={(e) => setPointSizeScale(Number(e.target.value))}
            className="point-cloud-viewer-slider"
          />
        </div>
        <div className="point-cloud-viewer-visibility">
          <label className="point-cloud-viewer-checkbox-label">
            <input
              type="checkbox"
              checked={showInput}
              onChange={(e) => setShowInput(e.target.checked)}
              disabled={!hasInput}
            />
            <span>输入(灰)</span>
          </label>
          <label className="point-cloud-viewer-checkbox-label">
            <input
              type="checkbox"
              checked={showPseudo}
              onChange={(e) => setShowPseudo(e.target.checked)}
              disabled={!hasPseudo}
            />
            <span>伪标签(彩)</span>
          </label>
        </div>
      </div>
      <div className="point-cloud-viewer-canvas">
      <Canvas
        camera={{ position: [0, 30, 40], fov: 50 }}
        dpr={[1, 2]}
        gl={{ alpha: false, antialias: true }}
        onCreated={({ gl, scene }) => {
          scene.background = new THREE.Color(0xf8f8f8);
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[20, 20, 10]} intensity={1} />
        {hasInput && showInput && (
          <InputPointCloud points={inputPointCloud} pointSize={inputSize} />
        )}
        {hasPseudo && showPseudo && (
          <PseudoPointCloud points={pointCloud} config={config} pointSize={pseudoSize} />
        )}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 + 0.1} />
        <Grid
          infiniteGrid
          fadeDistance={80}
          sectionColor="#c0c0c0"
          cellColor="#e0e0e0"
          position={[0, -8, 0]}
        />
      </Canvas>
      <div className="point-cloud-viewer-hud">
        {hasInput && showInput && <span>输入: {inputPointCloud.length.toLocaleString()}</span>}
        {hasInput && hasPseudo && showInput && showPseudo && <span> · </span>}
        {hasPseudo && showPseudo && <span>伪标签: {pointCloud.length.toLocaleString()}</span>}
      </div>
      </div>
    </div>
  );
}

export default PointCloudViewer;
