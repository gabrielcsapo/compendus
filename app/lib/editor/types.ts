export interface ManifestItem {
  id: string;
  href: string; // relative to opfDir
  absolutePath: string; // full path in ZIP (e.g., "OEBPS/chapter-1.xhtml")
  mediaType: string;
  isSpineItem: boolean;
  spineIndex: number; // -1 if not in spine
  isNavDoc: boolean;
  isCoverImage: boolean;
}

export interface EpubMetadata {
  title: string;
  authors: string[];
  language: string;
  publisher?: string;
  description?: string;
}

export interface EpubStructure {
  opfPath: string;
  opfDir: string;
  metadata: EpubMetadata;
  manifest: ManifestItem[];
  spine: string[]; // ordered list of manifest item IDs
  navDocPath: string | null;
}
