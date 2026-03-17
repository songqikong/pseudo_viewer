import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

function SettingsPanel({ onSettingsSaved }) {
    const [settings, setSettings] = useState({
        base_dir: '',
        output_base_dir: '',
        config_path: '',
        dataset_type: 'semantic_kitti'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/settings`);
            setSettings(res.data);
        } catch (err) {
            console.error("Failed to fetch settings:", err);
            setMessage({ type: 'error', text: 'Failed to load settings from server.' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await axios.post(`${API_BASE}/settings`, settings);
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
            if (onSettingsSaved) onSettingsSaved();
        } catch (err) {
            console.error("Failed to save settings:", err);
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <RefreshCw className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 600 }}>Global Settings</h2>
            
            <div className="glass-panel" style={{ padding: '32px' }}>
                
                {message && (
                    <div style={{ 
                        padding: '12px 16px', 
                        borderRadius: '6px', 
                        marginBottom: '24px',
                        background: message.type === 'success' ? 'rgba(46, 160, 67, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                        border: `1px solid ${message.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'}`,
                        color: message.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'
                    }}>
                        {message.text}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div className="control-item" style={{ marginBottom: 0 }}>
                        <label className="control-label" style={{ fontSize: '1rem', color: '#fff', marginBottom: '8px' }}>
                            Dataset Type
                        </label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            SemanticKITTI: sequence folders (00, 01, ...) with .ply/.bin. SemanticPOSS: dataset root containing sequences/00/velodyne, sequences/00/labels, sequences/00/tag.
                        </p>
                        <select 
                            name="dataset_type"
                            value={settings.dataset_type || 'semantic_kitti'} 
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px 12px' }}
                        >
                            <option value="semantic_kitti">SemanticKITTI</option>
                            <option value="semanticposs">SemanticPOSS</option>
                        </select>
                    </div>

                    <div className="control-item" style={{ marginBottom: 0 }}>
                        <label className="control-label" style={{ fontSize: '1rem', color: '#fff', marginBottom: '8px' }}>
                            Input Dataset Path (base_dir)
                        </label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            {settings.dataset_type === 'semanticposs'
                                ? 'Dataset root containing sequences/00/velodyne, sequences/00/labels, sequences/00/tag.'
                                : 'Directory containing the sequence folders (e.g., 00, 01, ...).'}
                        </p>
                        <input 
                            type="text" 
                            name="base_dir"
                            value={settings.base_dir} 
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px 12px' }}
                            placeholder="/path/to/dataset/sequences"
                        />
                    </div>

                    <div className="control-item" style={{ marginBottom: 0 }}>
                        <label className="control-label" style={{ fontSize: '1rem', color: '#fff', marginBottom: '8px' }}>
                            Output Save Path (output_base_dir)
                        </label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Directory where generated `.label` files and `bev_vis` images will be saved.
                        </p>
                        <input 
                            type="text" 
                            name="output_base_dir"
                            value={settings.output_base_dir} 
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px 12px' }}
                            placeholder="/path/to/output"
                        />
                    </div>

                    <div className="control-item" style={{ marginBottom: 0 }}>
                        <label className="control-label" style={{ fontSize: '1rem', color: '#fff', marginBottom: '8px' }}>
                            YAML Config Path
                        </label>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Path to `semantic-kitti.yaml` containing the label mapping.
                        </p>
                        <input 
                            type="text" 
                            name="config_path"
                            value={settings.config_path} 
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px 12px' }}
                            placeholder="/path/to/semantic-kitti.yaml"
                        />
                    </div>

                </div>

                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                        className="primary-btn" 
                        style={{ margin: 0 }}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? <RefreshCw size={18} className="spinner" /> : <Save size={18} />}
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsPanel;
