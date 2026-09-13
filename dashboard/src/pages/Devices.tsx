import React, { useState } from 'react';
import { ApiService } from '../services/api.js';
import { Cpu, Plus, KeyRound, Copy, Check, ShieldAlert, Wifi } from 'lucide-react';
import { Modal } from '../components/Modal.js';
import { ESP32Device } from '../types/index.js';

export const Devices: React.FC<{
  devices: ESP32Device[];
  onRefresh: () => void;
}> = ({ devices, onRefresh }) => {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [esp32Id, setEsp32Id] = useState('CLASSROOM_02');
  const [deviceName, setDeviceName] = useState('ESP32 Classroom 02');
  const [classroomId, setClassroomId] = useState('ROOM_304');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await ApiService.registerDevice({
        esp32Id: esp32Id.trim().toUpperCase(),
        deviceName: deviceName.trim(),
        classroomId: classroomId.trim().toUpperCase(),
      });
      setIsRegisterModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register ESP32 device');
    } finally {
      setLoading(false);
    }
  };

  const handleRotateKey = async (id: string, deviceName: string) => {
    if (window.confirm(`Rotate cryptographic secret key for '${deviceName}'? You will need to reflash the ESP32 firmware with the new key.`)) {
      try {
        await ApiService.rotateDeviceKey(id);
        onRefresh();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to rotate key');
      }
    }
  };

  const copyArduinoConfig = (device: ESP32Device) => {
    const snippet = `// Copy & Paste into classroom_esp32/config.h
#define ESP32_DEVICE_ID     "${device.esp32_id}"
#define CLASSROOM_ID        "${device.classroom_id}"
#define DEVICE_FRIENDLY_NAME "${device.device_name}"
#define SERVICE_UUID        "${device.service_uuid}"
#define CHAR_CHALLENGE_UUID "${device.char_challenge_uuid}"
#define CHAR_RESPONSE_UUID  "${device.char_response_uuid}"
#define DEFAULT_SECRET_KEY_HEX "${device.secret_key}"`;

    navigator.clipboard.writeText(snippet);
    setCopiedKeyId(device.id);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">ESP32 Hardware Provisioning</h2>
          <p className="text-xs text-slate-500">
            Registered classroom nodes with 256-bit cryptographic identities. Never relies solely on device name.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center space-x-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New ESP32</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {devices.map((device) => (
          <div
            key={device.id}
            className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {device.classroom_id}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{device.device_name}</h3>
                  <p className="text-xs font-mono font-semibold text-blue-600">ID: {device.esp32_id}</p>
                </div>
              </div>

              <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase border ${
                device.device_status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {device.device_status}
              </span>
            </div>

            {/* Cryptographic Key & UUIDs */}
            <div className="mt-5 space-y-2 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans font-semibold text-[11px]">BLE Service UUID:</span>
                <span className="text-slate-800 font-mono text-[11px] truncate max-w-[200px]">{device.service_uuid}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-sans font-semibold text-[11px]">256-Bit Secret Key:</span>
                <span className="text-slate-800 font-mono text-[11px]">
                  {device.secret_key.slice(0, 12)}...{device.secret_key.slice(-8)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] font-sans text-slate-500">
                <span>Firmware: v{device.firmware_version}</span>
                <span>Last active: {new Date(device.last_seen_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => copyArduinoConfig(device)}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                {copiedKeyId === device.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKeyId === device.id ? 'Copied Arduino Code!' : 'Copy Arduino Config'}</span>
              </button>

              <button
                onClick={() => handleRotateKey(device.id, device.device_name)}
                title="Rotate Cryptographic Key"
                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Provision Device Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Provision Classroom ESP32 Device"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              ESP32 Device ID (Unique Identifier)
            </label>
            <input
              type="text"
              required
              value={esp32Id}
              onChange={(e) => setEsp32Id(e.target.value)}
              placeholder="e.g. CLASSROOM_02"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Device Friendly Name
            </label>
            <input
              type="text"
              required
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Lab 304 ESP32 Node"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
              Assigned Classroom / Lab ID
            </label>
            <input
              type="text"
              required
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              placeholder="e.g. ROOM_304"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800">
            <p className="font-bold mb-1">🔐 Cryptographic Identity Guarantee</p>
            <p>
              A 256-bit cryptographically secure random secret key and unique BLE Service UUID will be automatically generated.
            </p>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Provisioning...' : 'Generate & Register'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
