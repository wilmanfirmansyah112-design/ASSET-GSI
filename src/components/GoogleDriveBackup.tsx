import { useState, useEffect } from "react";
import { 
  Cloud, CloudLightning, CloudOff, RefreshCw, UploadCloud, 
  DownloadCloud, Trash2, CheckCircle2, AlertCircle, Calendar, 
  Database, ShieldCheck, LogOut, Loader2, Sparkles, AlertTriangle
} from "lucide-react";
import { User } from "firebase/auth";
import { InventoryItem } from "../types";
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  listBackups, 
  createBackup, 
  restoreBackup, 
  deleteBackupFile,
  DriveBackupFile
} from "../googleDriveService";

interface GoogleDriveBackupProps {
  currentItems: InventoryItem[];
  onRestoreSuccess: (restoredItems: InventoryItem[], fileName: string) => void;
  onBackupSuccess: (message: string) => void;
}

export default function GoogleDriveBackup({ 
  currentItems, 
  onRestoreSuccess, 
  onBackupSuccess 
}: GoogleDriveBackupProps) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Drive state
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null); // tracks restore/delete file id
  const [customSuffix, setCustomSuffix] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Initialize Auth state on load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        fetchBackups(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch backups list
  const fetchBackups = async (accessToken: string) => {
    setIsLoadingBackups(true);
    setErrorMsg("");
    try {
      const files = await listBackups(accessToken);
      setBackups(files);
    } catch (error: any) {
      console.error("Error listing backups:", error);
      setErrorMsg("Gagal memuat daftar cadangan dari Google Drive.");
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Trigger login flow
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg("");
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        fetchBackups(result.accessToken);
        showTemporarySuccess("Berhasil masuk dengan Google!");
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setErrorMsg("Otorisasi Google Drive gagal. Silakan coba lagi.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout flow
  const handleLogout = async () => {
    setErrorMsg("");
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setBackups([]);
      showTemporarySuccess("Berhasil keluar.");
    } catch (err: any) {
      console.error("Logout failed:", err);
      setErrorMsg("Gagal keluar akun.");
    }
  };

  // Create standard backup
  const handleCreateBackup = async () => {
    if (!token) return;
    setIsCreatingBackup(true);
    setErrorMsg("");
    try {
      const file = await createBackup(token, currentItems, customSuffix.trim());
      setCustomSuffix("");
      showTemporarySuccess(`Cadangan baru berhasil dibuat: ${file.name}`);
      onBackupSuccess(`Database berhasil dicadangkan ke Google Drive dengan nama "${file.name}"!`);
      // Refresh list
      await fetchBackups(token);
    } catch (error: any) {
      console.error("Backup creation failed:", error);
      setErrorMsg("Gagal membuat cadangan ke Google Drive.");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Restore file contents
  const handleRestoreBackup = async (file: DriveBackupFile) => {
    if (!token) return;
    
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin MEMULIHKAN database inventaris dari file "${file.name}"?\n\nTindakan ini akan menggantikan seluruh data inventaris lokal saat ini. Perubahan yang belum dicadangkan akan hilang.`
    );
    
    if (!confirmed) return;

    setActiveActionId(file.id);
    setErrorMsg("");
    try {
      const restoredItems = await restoreBackup(token, file.id);
      onRestoreSuccess(restoredItems, file.name);
      showTemporarySuccess(`Berhasil memulihkan ${restoredItems.length} aset dari Google Drive!`);
    } catch (error: any) {
      console.error("Restore failed:", error);
      setErrorMsg("Gagal mengunduh atau membaca data cadangan.");
    } finally {
      setActiveActionId(null);
    }
  };

  // Delete backup file
  const handleDeleteBackup = async (file: DriveBackupFile) => {
    if (!token) return;

    const confirmed = window.confirm(
      `Apakah Anda yakin ingin MENGHAPUS file cadangan "${file.name}" dari Google Drive Anda?\n\nTindakan ini bersifat permanen dan data cadangan tidak dapat dipulihkan kembali.`
    );

    if (!confirmed) return;

    setActiveActionId(file.id);
    setErrorMsg("");
    try {
      await deleteBackupFile(token, file.id);
      showTemporarySuccess(`File cadangan "${file.name}" berhasil dihapus.`);
      // Refresh list
      await fetchBackups(token);
    } catch (error: any) {
      console.error("Delete failed:", error);
      setErrorMsg("Gagal menghapus file cadangan dari Google Drive.");
    } finally {
      setActiveActionId(null);
    }
  };

  // Utility helper for success text alerts
  const showTemporarySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg("");
    }, 5000);
  };

  // Helper to format file size
  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return "-";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col" id="gdrive-backup-card">
      {/* Header section of Widget */}
      <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">Google Drive Backup</h3>
            <p className="text-[11px] text-gray-500 font-medium">Cadangkan & Ambil Snapshots Database GSI</p>
          </div>
        </div>

        {user && (
          <button 
            onClick={() => fetchBackups(token!)} 
            disabled={isLoadingBackups}
            className="p-1.5 hover:bg-gray-200/80 rounded-lg text-gray-500 transition-colors cursor-pointer disabled:opacity-50"
            title="Segarkan daftar"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBackups ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Message banners inside Widget */}
      {(errorMsg || successMsg) && (
        <div className="px-5 pt-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Login State Screen */}
      {needsAuth ? (
        <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-3 bg-gray-50 text-gray-400 rounded-full">
            <CloudOff className="w-10 h-10 stroke-1" />
          </div>
          <div className="space-y-1 max-w-xs">
            <h4 className="font-bold text-xs text-gray-800">Hubungkan dengan Google Drive</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
              Amankan data inventaris Anda dengan menyimpannya langsung di akun Google Drive pribadi Anda.
            </p>
          </div>

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="gsi-material-button w-full max-w-xs flex justify-center py-2 px-4 shadow-sm text-xs font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 transition-all cursor-pointer items-center gap-2"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span>Menghubungkan...</span>
              </>
            ) : (
              <>
                <div className="w-4 h-4 flex items-center justify-center">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Authenticated View */
        <div className="p-5 space-y-5 flex-1 flex flex-col justify-between">
          
          {/* User profile card & Log out button */}
          <div className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100/30 rounded-xl">
            <div className="flex items-center gap-2.5">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  className="w-8 h-8 rounded-full ring-2 ring-indigo-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs uppercase">
                  {user?.displayName ? user.displayName.slice(0, 2) : "US"}
                </div>
              )}
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-gray-800 block leading-none">
                  {user?.displayName || "Google User"}
                </span>
                <span className="text-[10px] text-gray-500 block">
                  {user?.email}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-1.5 hover:bg-gray-200/60 rounded-lg text-gray-500 hover:text-red-600 transition-all cursor-pointer"
              title="Keluar Akun Google"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Form to create new backup */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Cadangkan Data Sekarang
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Catatan opsional (misal: penyesuaian-juni)" 
                value={customSuffix}
                onChange={(e) => setCustomSuffix(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                className="flex-1 bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
              />
              <button 
                onClick={handleCreateBackup}
                disabled={isCreatingBackup || currentItems.length === 0}
                className="px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all shrink-0 min-w-[100px]"
              >
                {isCreatingBackup ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>Backup</span>
              </button>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">
              Akan mengunggah data aktif ({currentItems.length} item) ke Google Drive Anda.
            </p>
          </div>

          {/* Backups List section */}
          <div className="space-y-2.5 flex-1 flex flex-col justify-start">
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                Daftar File Cadangan di Drive ({backups.length})
              </span>
              {isLoadingBackups && (
                <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Memuat...
                </span>
              )}
            </div>

            {backups.length === 0 ? (
              <div className="py-6 text-center border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center space-y-1">
                <Database className="w-7 h-7 text-gray-300 stroke-1" />
                <span className="text-[11px] text-gray-500 font-bold">Belum ada file cadangan</span>
                <span className="text-[10px] text-gray-400">Gunakan form di atas untuk membuat cadangan baru.</span>
              </div>
            ) : (
              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {backups.map((file) => {
                  const isBusy = activeActionId === file.id;
                  return (
                    <div 
                      key={file.id} 
                      className="p-2.5 border border-gray-150 rounded-xl bg-gray-50 hover:bg-white hover:border-gray-300 hover:shadow-xs transition-all flex items-center justify-between gap-3 text-left"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-gray-800 truncate block" title={file.name}>
                            {file.name.replace("gsi-inventory-backup-", "").replace(".json", "")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
                          <span className="flex items-center gap-0.5 shrink-0">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {new Date(file.createdTime).toLocaleDateString("id-ID", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                            })}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{formatSize(file.size)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRestoreBackup(file)}
                          disabled={isBusy}
                          className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                          title="Restore / Pulihkan data ini"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                          ) : (
                            <DownloadCloud className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(file)}
                          disabled={isBusy}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors cursor-pointer"
                          title="Hapus cadangan"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[9px] text-gray-400 font-medium justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Koneksi terenkripsi langsung ke server Google Drive API</span>
          </div>

        </div>
      )}
    </div>
  );
}
