import { pick, saveDocuments, types, errorCodes, isErrorWithCode, keepLocalCopy } from '@react-native-documents/picker';
import { Platform, Share } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const MIME = 'application/vnd.gifteez.backup+json';
const UTI = 'com.gifteez.backup';

export function backupFilename(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `Gifteez backup ${date.getFullYear()}-${month}-${day}.gifteez`;
}

function fileUrl(path: string): string {
  const bare = path.startsWith('file://') ? path.slice('file://'.length) : path;
  return `file://${encodeURI(bare)}`;
}

/** Write a real .gifteez file and hand it to the share sheet (or Android's save dialog) so the name sticks. */
export async function shareBackupFile(json: string, filename = backupFilename()): Promise<boolean> {
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
  await ReactNativeBlobUtil.fs.writeFile(path, json, 'utf8');
  const url = fileUrl(path);
  if (Platform.OS === 'ios') {
    const result = await Share.share({ url, title: filename });
    return result.action === Share.sharedAction;
  }
  try {
    await saveDocuments({
      sourceUris: [url],
      fileName: filename,
      mimeType: MIME,
      copy: true,
    });
    return true;
  } catch (caught) {
    if (isErrorWithCode(caught) && caught.code === errorCodes.OPERATION_CANCELED) {
      return false;
    }
    throw caught;
  }
}

export async function pickBackupText(): Promise<string | null> {
  try {
    const [file] = await pick({
      type: [UTI, types.json, 'public.json'],
      allowMultiSelection: false,
    });
    return readBackupUri(file.uri, file.name || 'backup.gifteez');
  } catch (caught) {
    if (isErrorWithCode(caught) && caught.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw caught;
  }
}

export function isIncomingBackup(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (!lower.startsWith('file:') && !lower.startsWith('content:')) {
    return false;
  }
  return lower.includes('.gifteez') || lower.includes('.json') || lower.startsWith('content:');
}

export async function readBackupUri(uri: string, fileName = 'backup.gifteez'): Promise<string> {
  const safeName = fileName.replace(/[^\w.\- ]+/g, '') || 'backup.gifteez';
  try {
    const [copy] = await keepLocalCopy({
      files: [{ uri, fileName: safeName.endsWith('.gifteez') || safeName.endsWith('.json') ? safeName : `${safeName}.gifteez` }],
      destination: 'cachesDirectory',
    });
    if (copy.status === 'success') {
      const path = decodeURI(copy.localUri.replace(/^file:\/\//, ''));
      return ReactNativeBlobUtil.fs.readFile(path, 'utf8');
    }
  } catch {
    // Some file:// urls can be read directly.
  }
  const direct = decodeURI(uri.replace(/^file:\/\//, ''));
  return ReactNativeBlobUtil.fs.readFile(direct, 'utf8');
}
