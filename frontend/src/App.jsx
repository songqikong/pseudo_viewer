import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Settings, Play, Image as ImageIcon, Box, RefreshCw, Folder } from 'lucide-react';
import PointCloudViewer from './components/PointCloudViewer';
import BEVViewer from './components/BEVViewer';
import ConfigPanel from './components/ConfigPanel';
import SettingsPanel from './components/SettingsPanel'; // Import SettingsPanel
import './index.css';

const API_BASE = 'http://localhost:8000/api';

const DATASET_DEFAULTS = {
  semantic_kitti: {
    base_dir: '/mnt/drtraining/user/songqikong/tep/se/seq/processed_data',
    config_path: '/mnt/drtraining/user/songqikong/code_repos/SelfCom/config/semantic-kitti.yaml',
  },
  semanticposs: {
    base_dir: '/mnt/public-data/user/songqikong/temp/OpenDataLab___SemanticPOSS/raw/dataset/sequences',
    config_path: '/mnt/drtraining/user/songqikong/code_repos/SelfCom/config/semantic-poss.yaml',
  },
};

function formatConfigAsLines(config) {
  if (!config || typeof config !== 'object') return [];
  return Object.entries(config).map(([k, v]) => {
    const val = Array.isArray(v) ? `[${v.join(', ')}]` : String(v);
    return `${k}: ${val}`;
  });
}

function App() {
  const [activeTab, setActiveTab] = useState('bev'); // 'bev', '3d', or 'settings'
  const [sequences, setSequences] = useState([]);
  const [selectedSequence, setSelectedSequence] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saveOutput, setSaveOutput] = useState(true); // Checkbox for saving output
  
  // 当前: only this session, empty on load/refresh. 历史: loaded from DB when user clicks 历史.
  const [displayMode, setDisplayMode] = useState('current'); // 'current' | 'history'
  const [currentList, setCurrentList] = useState([]);       // 当前: in-memory, cleared on refresh
  const [historyList, setHistoryList] = useState([]);       // 历史: from GET /api/visualizations
  const [selectedResultIndex, setSelectedResultIndex] = useState(null); // for 3D view

  const [config, setConfig] = useState({
    voxel_size: 0.25,
    point_cloud_range: [-40, -40, -2, 40, 40, 4],
    voxel_shape: [320, 320, 24],
    coords_norm: [160, 160, 8],
    voronoi_max_distance: 100,
    conv_kernel_size: 8,
    use_cuda: true,
    cuda_device: "cuda:0",
    filter_percentage: 0.05,
    label_weighting: "inverse_count",
    distance_metric: "euclidean"
  });

  const [datasetType, setDatasetType] = useState('semantic_kitti');

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings`);
      setDatasetType(res.data.dataset_type || 'semantic_kitti');
      return res.data;
    } catch (err) {
      console.error("Error fetching settings:", err);
      return null;
    }
  };

  const fetchSequences = async () => {
    try {
      const res = await axios.get(`${API_BASE}/sequences`);
      const seqs = res.data.sequences || [];
      setSequences(seqs);
      if (seqs.length > 0) {
        setSelectedSequence(seqs[0]);
        return seqs[0];
      } else {
        setSelectedSequence('');
        return null;
      }
    } catch (err) {
      console.error("Error fetching sequences:", err);
      return null;
    }
  };

  useEffect(() => {
    fetchSettings().then(() => fetchSequences());
  }, []);

  const handleDatasetTypeChange = async (e) => {
    const newType = e.target.value;
    const defaults = DATASET_DEFAULTS[newType];
    if (!defaults) return;
    const prevType = datasetType;
    setDatasetType(newType);
    try {
      const current = await axios.get(`${API_BASE}/settings`);
      await axios.post(`${API_BASE}/settings`, {
        base_dir: defaults.base_dir,
        output_base_dir: current.data.output_base_dir || '',
        config_path: defaults.config_path,
        dataset_type: newType,
      });
      const firstSeq = await fetchSequences();
      if (firstSeq) {
        await fetchFiles(firstSeq);
      } else {
        setFiles([]);
        setSelectedFile('');
      }
    } catch (err) {
      console.error("Error applying dataset defaults:", err);
      setDatasetType(prevType);
    }
  };

  // Load history from DB when user clicks "历史"
  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/visualizations`);
      const items = (res.data.items || []).map((it) => ({ id: it.id, label: it.label, created_at: it.created_at, data: null }));
      setHistoryList(items);
    } catch (err) {
      console.error("Error loading visualizations:", err);
    }
  };

  // Lazy-load full data for history list entries that only have meta (from DB)
  const requestedIdsRef = useRef(new Set());
  useEffect(() => {
    if (displayMode !== 'history') return;
    const needLoad = historyList.filter((e) => e.id != null && e.data == null);
    if (needLoad.length === 0) return;
    let cancelled = false;
    needLoad.forEach((entry) => {
      if (requestedIdsRef.current.has(entry.id)) return;
      requestedIdsRef.current.add(entry.id);
      axios.get(`${API_BASE}/visualizations/${entry.id}`).then((res) => {
        if (cancelled) return;
        const data = {
          pseudo_bev: res.data.pseudo_bev,
          bev_after_voronoi: res.data.bev_after_voronoi,
          bev_after_conv: res.data.bev_after_conv,
          point_cloud: res.data.point_cloud,
          config: res.data.config,
        };
        setHistoryList((prev) => prev.map((e) => (e.id === entry.id ? { ...e, data } : e)));
      }).catch((err) => {
        if (!cancelled) {
          requestedIdsRef.current.delete(entry.id);
          console.error("Error loading visualization", entry.id, err);
        }
      });
    });
    return () => { cancelled = true; };
  }, [displayMode, historyList]);

  useEffect(() => {
    if (selectedSequence) {
      fetchFiles(selectedSequence);
    }
  }, [selectedSequence, datasetType]);

  const fetchFiles = async (seq) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/sequences/${seq}/files`);
      setFiles(res.data.files || []);
      if (res.data.files && res.data.files.length > 0) {
        setSelectedFile(res.data.files[0]);
      } else {
        setSelectedFile('');
      }
    } catch (err) {
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    try {
      const settingsRes = await axios.get(`${API_BASE}/settings`);
      const baseDir = (settingsRes.data.base_dir || '').replace(/\/+$/, '');
      const dt = settingsRes.data.dataset_type || 'semantic_kitti';
      const filePath = dt === "semanticposs"
        ? (baseDir.endsWith("sequences") ? `${baseDir}/${selectedSequence}/velodyne/${selectedFile}` : `${baseDir}/sequences/${selectedSequence}/velodyne/${selectedFile}`)
        : `${baseDir}/${selectedSequence}/${selectedFile}`;
      const res = await axios.post(`${API_BASE}/process`, {
        file_path: filePath,
        config,
        save_output: saveOutput 
      });
      const label = `${selectedSequence}/${selectedFile}`;
      const data = {
        pseudo_bev: res.data.pseudo_bev,
        bev_after_voronoi: res.data.bev_after_voronoi,
        bev_after_conv: res.data.bev_after_conv,
        point_cloud: res.data.point_cloud,
        input_point_cloud: res.data.input_point_cloud || [],
        config, // so title can show params and 3D can use it
      };
      setCurrentList(prev => [...prev, { id: res.data.id, label, created_at: new Date().toISOString(), data }]);
      setSelectedResultIndex(null);
    } catch (err) {
      console.error("Error processing file:", err);
      alert("Error processing file: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleSettingsSaved = () => {
      fetchSequences(); // Refresh sequences if base_dir changed
  };

  return (
    <div className="app-container">
      {/* Sidebar Configuration */}
      <div className="sidebar fade-in">
        <div className="header" style={{ justifyContent: 'center' }}>
          <h1 className="header-title">Pseudo-Gen Planner</h1>
        </div>

        <div className="control-group">
          <h3><Folder size={16} style={{display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom'}}/> File Selection</h3>
          
          <div className="control-item">
            <label className="control-label">Dataset</label>
            <select 
              value={datasetType} 
              onChange={handleDatasetTypeChange}
              style={{ width: '100%' }}
            >
              <option value="semantic_kitti">SemanticKITTI</option>
              <option value="semanticposs">SemanticPOSS</option>
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {datasetType === 'semanticposs' ? '路径: .../sequences' : '路径: .../processed_data'}
            </p>
          </div>

          <div className="control-item">
            <label className="control-label">Sequence</label>
            <select 
              value={selectedSequence} 
              onChange={(e) => setSelectedSequence(e.target.value)}
            >
              <option value="" disabled>Select Sequence</option>
              {sequences.map(seq => (
                <option key={seq} value={seq}>{seq}</option>
              ))}
            </select>
          </div>

          <div className="control-item">
            <label className="control-label">File {loading && <RefreshCw size={12} className="spinner" style={{border: 'none'}} />}</label>
            <div className="file-list">
              {files.length === 0 ? (
                <div style={{padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)'}}>No files found. Check your Input Dataset Path in Settings.</div>
              ) : (
                files.map(file => (
                  <div 
                    key={file} 
                    className={`file-item ${file === selectedFile ? 'selected' : ''}`}
                    onClick={() => setSelectedFile(file)}
                  >
                    {file}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <ConfigPanel config={config} setConfig={setConfig} />
        
        <div className="control-group" style={{ borderBottom: 'none', paddingBottom: 0 }}>
             <div className="control-item" style={{flexDirection: 'row', alignItems: 'center'}}>
                <input 
                  type="checkbox" 
                  checked={saveOutput} 
                  onChange={(e) => setSaveOutput(e.target.checked)}
                  style={{width: '18px', height: '18px', cursor: 'pointer', marginRight: '8px'}}
                />
                <label className="control-label" style={{margin: 0, cursor: 'pointer'}} onClick={() => setSaveOutput(!saveOutput)}>
                  Save generated outputs
                </label>
            </div>
        </div>

        <button 
          className="primary-btn" 
          onClick={handleProcess} 
          disabled={!selectedFile || processing}
        >
          {processing ? (
            <><RefreshCw size={18} className="spinner" style={{border: 'none'}}/> Processing...</>
          ) : (
            <><Play size={18} fill="currentColor" /> Generate Voxel</>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="main-content fade-in" style={{animationDelay: '0.1s'}}>
        {processing && (
          <div className="loading-overlay fade-in">
            <div className="spinner"></div>
            <span>Processing point cloud. This may take a moment...</span>
          </div>
        )}
        
        <div className="view-tabs">
          <button 
            className={`tab-btn ${activeTab === 'bev' ? 'active' : ''}`}
            onClick={() => setActiveTab('bev')}
          >
            <ImageIcon size={16} style={{display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom'}}/>
            BEV Maps
          </button>
          <button 
            className={`tab-btn ${activeTab === '3d' ? 'active' : ''}`}
            onClick={() => setActiveTab('3d')}
          >
            <Box size={16} style={{display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom'}}/>
            3D Voxel Grid
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ marginLeft: 'auto' }}
          >
            <Settings size={16} style={{display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom'}}/>
            Global Settings
          </button>
        </div>

        <div className="viewer-area" style={{ overflowY: activeTab === 'settings' ? 'auto' : (activeTab === 'bev' ? 'auto' : 'hidden') }}>
          {activeTab === 'settings' ? (
             <SettingsPanel onSettingsSaved={handleSettingsSaved} />
          ) : activeTab === 'bev' ? (
            <div className="results-view">
              <div className="results-view-toolbar">
                <button
                  type="button"
                  className={`results-mode-btn ${displayMode === 'current' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('current')}
                >
                  当前
                </button>
                <button
                  type="button"
                  className={`results-mode-btn ${displayMode === 'history' ? 'active' : ''}`}
                  onClick={() => { setDisplayMode('history'); loadHistory(); }}
                >
                  历史
                </button>
              </div>
              <div className="results-list">
                {(() => {
                  const resultsList = displayMode === 'current' ? currentList : historyList;
                  if (resultsList.length === 0) {
                    return (
                      <div className="results-list-empty">
                        {displayMode === 'current'
                          ? '当前为空。点击生成后，本页会在此追加一行。刷新页面后仍为空。'
                          : '历史为空，或请先点击「历史」加载。'}
                      </div>
                    );
                  }
                  return resultsList.map((entry, index) => (
                    <div key={entry.id ?? index} className="results-list-item">
                      <div className="results-list-item-header">
                        <span className="results-list-item-title">{entry.label || `结果 #${resultsList.length - index}`}</span>
                        <span className="results-list-item-meta">#{resultsList.length - index}</span>
                        <button
                          type="button"
                          className="results-list-item-3d-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedResultIndex(index);
                            setActiveTab('3d');
                          }}
                          title="在 3D 中查看"
                          disabled={!entry.data?.point_cloud}
                        >
                          <Box size={14} /> 3D
                        </button>
                      </div>
                      <div className="results-list-item-body">
                        <div className="results-list-item-config">
                          <div className="results-list-item-config-title">配置</div>
                          <pre className="results-list-item-config-content">
                            {entry.data?.config
                              ? formatConfigAsLines(entry.data.config).join('\n')
                              : 'Loading…'}
                          </pre>
                        </div>
                        <div className="bev-container">
                          {entry.data ? (
                            <BEVViewer results={entry.data} />
                          ) : (
                            <div className="results-list-item-loading">Loading from database...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <div className="viewer-3d">
              {(() => {
                const resultsList = displayMode === 'current' ? currentList : historyList;
                const idx = selectedResultIndex !== null ? selectedResultIndex : resultsList.length - 1;
                const result = idx >= 0 && resultsList[idx] ? resultsList[idx].data : null;
                const configFor3d = result?.config || config;
                const hasPoints = result?.point_cloud && Array.isArray(result.point_cloud) && result.point_cloud.length > 0;
                return hasPoints ? (
                  <PointCloudViewer
                    inputPointCloud={result.input_point_cloud}
                    pointCloud={result.point_cloud}
                    config={configFor3d}
                  />
                ) : (
                  <div className="viewer-3d-placeholder">
                    Run generation to view 3D Point Cloud
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
