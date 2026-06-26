import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";
import { InventoryItem } from "./types";

// Initialize Firebase App if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Drive scopes
provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal mendapatkan access token dari Google OAuth");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign-in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Log out
export const logout = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Get current cached token
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  description?: string;
}

// List backups in Google Drive
export const listBackups = async (accessToken: string): Promise<DriveBackupFile[]> => {
  // Query to find backups
  // Search for files containing 'gsi-inventory-backup' and not in trash
  const query = "name contains 'gsi-inventory-backup-' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,size,description)&orderBy=createdTime desc`;

  const response = await fetch(url, {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
};

// Upload a backup to Google Drive
export const createBackup = async (
  accessToken: string,
  items: InventoryItem[],
  customNameSuffix?: string
): Promise<DriveBackupFile> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `gsi-inventory-backup-${timestamp}${customNameSuffix ? `-${customNameSuffix}` : ""}.json`;

  const metadata = {
    name: fileName,
    mimeType: "application/json",
    description: `GSI Inventory Backup containing ${items.length} items. Created on ${new Date().toLocaleString("id-ID")}`
  };

  const boundary = "gsi_backup_multipart_boundary";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(items) +
    closeDelim;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive Upload Error: ${response.status} - ${errText}`);
  }

  return response.json();
};

// Download backup contents
export const restoreBackup = async (accessToken: string, fileId: string): Promise<InventoryItem[]> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive Download Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("File cadangan tidak valid (format data bukan array inventaris)");
  }

  return data as InventoryItem[];
};

// Delete a backup from Google Drive
export const deleteBackupFile = async (accessToken: string, fileId: string): Promise<void> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive Delete Error: ${response.status} - ${errText}`);
  }
};
