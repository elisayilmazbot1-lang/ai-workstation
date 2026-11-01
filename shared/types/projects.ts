/** Proje, dosya ve kod editörü tipleri. */
import type { ISODate, ProjectId } from './common.js';

export interface ProjectRecord {
  id: ProjectId;
  name: string;
  rootPath: string;
  description?: string;
  createdAt: ISODate;
  lastOpenedAt: ISODate;
  /** Proje bazlı varsayılan model. */
  defaultModelId?: string;
  taskCount: number;
}

export interface FileNode {
  name: string;
  /** Proje köküne göre göreli, eğik çizgi ayraçlı yol. */
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: ISODate;
  /** İçerik üretilmişse (node_modules, dist gibi) gizlenir. */
  ignored?: boolean;
  children?: FileNode[];
  extension?: string;
}

export interface FileReadResult {
  path: string;
  content: string;
  encoding: 'utf-8' | 'binary';
  size: number;
  /** Dil algılama sonucu (Monaco için). */
  language: string;
  truncated: boolean;
  modifiedAt: ISODate;
}

export interface FileWriteRequest {
  projectId: ProjectId;
  path: string;
  content: string;
  /** Onay sürecinden geçmiş değişiklik kimliği (opsiyonel). */
  changeId?: string;
  createBackup?: boolean;
}

export interface FileSearchResult {
  path: string;
  line: number;
  column: number;
  preview: string;
  matchLength: number;
}

export interface DiffHunkLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  unified: string;
  additions: number;
  removals: number;
  hunks: Array<{ header: string; lines: DiffHunkLine[] }>;
}

export interface BackupRecord {
  id: string;
  projectId: ProjectId;
  path: string;
  /** Yedek içeriği şifreli kasada / diskte tutulur. */
  storedPath: string;
  size: number;
  createdAt: ISODate;
  reason: 'pre-write' | 'pre-delete' | 'manual';
}

export const IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  'release',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  'target',
  'bin',
  'obj',
  '.idea',
  '.vscode',
];

export const BINARY_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'pdf', 'zip', 'gz', 'tar', '7z', 'rar',
  'exe', 'dll', 'so', 'dylib', 'node', 'wasm', 'mp3', 'mp4', 'wav', 'ogg', 'woff', 'woff2', 'ttf', 'otf',
  'db', 'sqlite', 'sqlite3', 'bin', 'class', 'jar', 'pyc',
];
